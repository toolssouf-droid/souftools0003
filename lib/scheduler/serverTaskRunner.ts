/**
 * SoufAI Autonomous Server Task Runner & Background Daemon
 * Continuously evaluates pending scheduled tasks from Turso database using atomic Claim/Lease,
 * executes intelligent workflows (Reminders, Web Research, Code, AI Tasks, Messages),
 * and dispatches notifications seamlessly across Telegram, WhatsApp, and Web channels.
 */

import { ScheduledTaskRepository, NotificationRepository } from "@/lib/db";
import { executeRoutedPrompt } from "@/lib/router";
import { executeRawSearchQuery } from "@/lib/agent/webResearchAgent";
import { whatsappManager } from "@/lib/whatsapp/whatsappManager";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import os from "os";

const RUNNER_WORKER_ID = `sched_${os.hostname()}_${process.pid}`;
const runningTaskLocks = new Set<string>();

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  message: string;
  resultData?: any;
}

export class ServerTaskRunner {
  /**
   * Atomically claims and executes all due pending (or expired-lease) tasks
   */
  public static async processDueTasks(): Promise<TaskExecutionResult[]> {
    const now = Date.now();
    const dueTasks = await ScheduledTaskRepository.claimDueTasks(RUNNER_WORKER_ID, 90_000, now, 20);

    if (!dueTasks || dueTasks.length === 0) {
      return [];
    }

    const results: TaskExecutionResult[] = [];

    for (const task of dueTasks) {
      if (runningTaskLocks.has(task.id)) continue;
      runningTaskLocks.add(task.id);

      try {
        const execResult = await this.executeSingleTask(task);

        if (execResult.success) {
          if (task.recurrence && task.recurrence !== "once") {
            const nextTime = this.calculateNextRecurrenceTime(task.targetTimestamp, task.recurrence);
            await ScheduledTaskRepository.rescheduleRecurringTask(
              task.id,
              nextTime,
              new Date(nextTime).toISOString(),
              { lastExecution: execResult }
            );
          } else {
            await ScheduledTaskRepository.updateTaskStatus(
              task.id,
              "completed",
              { message: execResult.message, data: execResult.resultData }
            );
          }
        } else {
          await ScheduledTaskRepository.updateTaskStatus(
            task.id,
            "failed",
            { lastAttempt: Date.now() },
            execResult.message
          );
        }

        results.push(execResult);
      } catch (err: any) {
        console.error(`[ServerTaskRunner] Task ${task.id} failure:`, err);
        await ScheduledTaskRepository.updateTaskStatus(
          task.id,
          "failed",
          undefined,
          err?.message || "Execution exception"
        );
        results.push({
          taskId: task.id,
          success: false,
          message: err?.message || "Execution error",
        });
      } finally {
        runningTaskLocks.delete(task.id);
      }
    }

    return results;
  }

  /**
   * Executes a specific task on demand immediately (e.g. from user click or API)
   */
  public static async executeSingleTaskById(taskId: string): Promise<TaskExecutionResult> {
    const task = await ScheduledTaskRepository.getTaskById(taskId);
    if (!task) {
      return { taskId, success: false, message: "المهمة المجدولة غير موجودة في قاعدة البيانات." };
    }
    await ScheduledTaskRepository.updateTaskStatus(task.id, "executing");
    const result = await this.executeSingleTask(task);
    if (result.success) {
      if (task.recurrence && task.recurrence !== "once") {
        const nextTime = this.calculateNextRecurrenceTime(Date.now(), task.recurrence);
        await ScheduledTaskRepository.rescheduleRecurringTask(
          task.id,
          nextTime,
          new Date(nextTime).toISOString(),
          { lastExecution: result }
        );
      } else {
        await ScheduledTaskRepository.updateTaskStatus(
          task.id,
          "completed",
          { message: result.message, data: result.resultData }
        );
      }
    } else {
      await ScheduledTaskRepository.updateTaskStatus(
        task.id,
        "failed",
        { lastAttempt: Date.now() },
        result.message
      );
    }
    return result;
  }

  /**
   * Executes a single task workflow based on its type and dispatches to destination channel
   */
  private static async executeSingleTask(task: any): Promise<TaskExecutionResult> {
    let resultMessage = "";
    let resultData: any = {};

    // 1. RESEARCH & WEB EXPLORATION TASK
    if (task.type === "research") {
      const query = task.prompt || task.title;
      try {
        const searchRes = await executeRawSearchQuery(query);
        const searchContext =
          searchRes.results
            ?.map((r: any) => `- ${r.title}: ${r.snippet} (${r.url})`)
            .join("\n") || "لم يتم العثور على نتائج جديدة.";

        const aiSummary = await executeRoutedPrompt({
          prompt: `قم بتلخيص هذه النتائج المستخرجة للبحث المجدول "${query}" بأسلوب ذكي ومنظم وواضح ومفيد:\n${searchContext}`,
          modelId: "spark",
          systemInstruction: "أنت مساعد بحثي خبير ومستقل. قدم ملخصاً استراتيجياً سريعاً وواضحاً بالعربية.",
        });

        resultMessage = `🔍 **[تقرير البحث الاستباقي المجدول: ${task.title}]**\n\n${aiSummary.text}`;
        resultData = { searchResults: searchRes.results };
      } catch (e: any) {
        resultMessage = `تعذر إكمال البحث المجدول: ${e?.message}`;
      }
    }

    // 2. EMAIL SCHEDULED TASK
    else if (task.type === "email" && task.payload?.emailData) {
      const email = task.payload.emailData;
      resultMessage = `📧 **[تذكير بالبريد المجدول]**\n\n- **المستلم:** \`${email.to}\`\n- **الموضوع:** ${email.subject}\n- **المحتوى:**\n${email.body}`;
      resultData = { emailData: email };
    }

    // 3. WHATSAPP MESSAGE DISPATCH
    else if (task.type === "whatsapp_message") {
      resultMessage = `💬 **[رسالة واتساب مجدولة]**\n\n📌 **${task.title}**\n${task.prompt || ""}`;
      resultData = { prompt: task.prompt };
    }

    // 4. CODE EXECUTION OR GENERAL AI TASK
    else if (task.type === "code" || task.type === "general_task") {
      try {
        const aiResponse = await executeRoutedPrompt({
          prompt: task.prompt || task.title,
          modelId: "spark",
          systemInstruction: "أنت مساعد SoufAI المنفذ للمهام المجدولة. نفذ المطلوب بدقة واحترافية.",
        });
        resultMessage = `🤖 **${task.title}**\n\n${aiResponse.text}`;
        resultData = { response: aiResponse.text };
      } catch (e: any) {
        resultMessage = `تعذر إكمال المطلوب في الوقت الحالي.`;
      }
    }

    // 5. STANDARD REMINDER
    else {
      resultMessage = `🔔 **تذكيرك الآن:**\n\n📌 **${task.title}**${task.prompt && task.prompt !== task.title ? `\n\n📝 ${task.prompt}` : ""}`;
    }

    // ----------------------------------------------------
    // MULTI-CHANNEL DISPATCHING
    // ----------------------------------------------------

    // A. TELEGRAM DISPATCH
    if (task.channel === "telegram" && task.chatId) {
      try {
        const { telegramManager } = await import("@/lib/telegram/telegramManager");
        const inlineKeyboard = [
          [
            { text: "✅ تم الإنجاز", callback_data: `task_done_${task.id}` },
            { text: "⏰ بعد 15 دقيقة", callback_data: `task_snooze_15_${task.id}` },
          ],
          [
            { text: "⏳ بعد ساعة", callback_data: `task_snooze_60_${task.id}` },
            { text: "🗑️ حذف", callback_data: `task_delete_${task.id}` },
          ],
        ];

        await telegramManager.sendMessageWithInlineKeyboard(
          task.chatId,
          resultMessage,
          inlineKeyboard
        );
      } catch (tgErr) {
        console.error("[ServerTaskRunner] Telegram delivery notice:", tgErr);
      }
    }

    // B. WHATSAPP DISPATCH
    else if (task.channel === "whatsapp" && (task.chatId || task.userId)) {
      try {
        const targetPhone = task.chatId || task.userId;
        const { sendRealWhatsAppMessage } = await import("@/lib/whatsapp/baileysService");
        await sendRealWhatsAppMessage(targetPhone, resultMessage);
      } catch (waErr) {
        console.error("[ServerTaskRunner] WhatsApp delivery notice:", waErr);
      }
    }

    // C. WEB PLATFORM DISPATCH (PERSISTENT NOTIFICATION & CLOUD SYNC)
    else {
      try {
        const targetUserId = task.userId || "default_user";
        await NotificationRepository.createNotification({
          userId: targetUserId,
          title: `⏰ تذكير بمهمة: ${task.title}`,
          message: resultMessage,
          type: "info",
          metadata: {
            taskId: task.id,
            taskType: task.type,
            resultData,
          },
        });

        // Broadcast sync event to all active client tabs
        await recordSyncEvent({
          userId: targetUserId,
          entityType: "notification",
          entityId: `notif_${task.id}`,
          operation: "created",
          payload: {
            taskId: task.id,
            title: task.title,
            message: resultMessage,
            timestamp: Date.now(),
          },
        });

        // Web Push Notification to all subscribed user devices
        try {
          const { webPushManager } = await import("@/lib/notifications/webPushManager");
          await webPushManager.sendPushNotification(targetUserId, {
            title: `⏰ تذكير بمهمة: ${task.title}`,
            body: resultMessage,
            url: "/ar/chat",
            id: task.id,
          });
        } catch (pushErr) {
          console.warn("[ServerTaskRunner] Push notification notice:", pushErr);
        }
      } catch (webErr) {
        console.error("[ServerTaskRunner] Web notification dispatch notice:", webErr);
      }
    }

    return {
      taskId: task.id,
      success: true,
      message: resultMessage,
      resultData,
    };
  }

  /**
   * Computes the next epoch timestamp for recurring tasks
   */
  private static calculateNextRecurrenceTime(
    currentTimestamp: number,
    recurrence: string
  ): number {
    const now = Date.now();
    let base = Math.max(currentTimestamp, now);
    const date = new Date(base);

    switch (recurrence) {
      case "daily":
        date.setDate(date.getDate() + 1);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "workdays": {
        date.setDate(date.getDate() + 1);
        while (date.getDay() === 0 || date.getDay() === 6) {
          date.setDate(date.getDate() + 1);
        }
        break;
      }
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      default:
        date.setDate(date.getDate() + 1);
    }

    return date.getTime();
  }
}

// ====================================================
// AUTONOMOUS CONTINUOUS BACKGROUND DAEMON SERVICE
// ====================================================

declare global {
  var _soufServerTaskDaemonStarted: boolean | undefined;
}

if (
  typeof window === "undefined" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !global._soufServerTaskDaemonStarted
) {
  global._soufServerTaskDaemonStarted = true;

  // Run initial check after 5 seconds, then every 12 seconds continuously
  setTimeout(() => {
    if (process.env.TURSO_DATABASE_URL) {
      ServerTaskRunner.processDueTasks().catch(() => {});
    }

    const t = setInterval(() => {
      if (!process.env.TURSO_DATABASE_URL) return;
      ServerTaskRunner.processDueTasks().catch(() => {});
    }, 12000);
    if (t.unref) t.unref();
  }, 5000);
}
