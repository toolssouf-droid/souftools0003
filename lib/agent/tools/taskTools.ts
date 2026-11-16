/**
 * Task, Reminder, and Action Scheduling Tools for SoufAI Multi-Agent System
 * Advanced natural language parser, multi-channel support (Telegram, WhatsApp, Web),
 * and 100% persistent database storage via Turso.
 */

import { ScheduledTaskRepository } from "@/lib/db";
import { normalizeAndFixEmailAddress } from "@/lib/utils/emailFormatter";
import { getInMemoryAdminConfig } from "@/lib/adminConfigStore";

/**
 * Parses natural Arabic and English date/time expressions into exact timestamps
 */
export function parseNaturalDateToTimestamp(input: string): {
  timestamp: number;
  formatted: string;
  recurrence: "once" | "daily" | "weekly" | "monthly" | "workdays";
} {
  const now = new Date();
  const text = (input || "").trim().toLowerCase();

  let targetDate = new Date(now.getTime());
  let recurrence: "once" | "daily" | "weekly" | "monthly" | "workdays" = "once";

  // Check recurring patterns
  if (/(كل يوم|يوميا|يومياً|daily|every day)/i.test(text)) {
    recurrence = "daily";
  } else if (/(كل أسبوع|أسبوعيا|أسبوعياً|weekly|every week)/i.test(text)) {
    recurrence = "weekly";
  } else if (/(أيام العمل|workdays|weekdays)/i.test(text)) {
    recurrence = "workdays";
  } else if (/(كل شهر|شهريا|شهرياً|monthly|every month)/i.test(text)) {
    recurrence = "monthly";
  }

  // Relative minutes / hours / days
  const relativeMatch = text.match(/بعد\s+(\d+)\s*(دقيقة|دقائق|د|ساعة|ساعات|س|يوم|أيام|اسبوع|أسبوع|شهر)/i);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1], 10) || 1;
    const unit = relativeMatch[2];
    if (unit.includes("دقيق") || unit === "د") {
      targetDate.setMinutes(targetDate.getMinutes() + num);
    } else if (unit.includes("ساع") || unit === "س") {
      targetDate.setHours(targetDate.getHours() + num);
    } else if (unit.includes("يوم") || unit.includes("أيام")) {
      targetDate.setDate(targetDate.getDate() + num);
    } else if (unit.includes("اسبوع") || unit.includes("أسبوع")) {
      targetDate.setDate(targetDate.getDate() + num * 7);
    } else if (unit.includes("شهر")) {
      targetDate.setMonth(targetDate.getMonth() + num);
    }
  } else if (text.includes("بعد دقيقة") || text.includes("في دقيقة") || text.includes("in 1 min")) {
    targetDate.setMinutes(targetDate.getMinutes() + 1);
  } else if (text.includes("بعد 5 دقائق") || text.includes("in 5 min")) {
    targetDate.setMinutes(targetDate.getMinutes() + 5);
  } else if (text.includes("بعد 10 دقائق") || text.includes("in 10 min")) {
    targetDate.setMinutes(targetDate.getMinutes() + 10);
  } else if (text.includes("بعد ربع ساعة") || text.includes("بعد 15 دقيقة") || text.includes("in 15 min")) {
    targetDate.setMinutes(targetDate.getMinutes() + 15);
  } else if (text.includes("بعد نصف ساعة") || text.includes("بعد 30 دقيقة") || text.includes("in 30 min")) {
    targetDate.setMinutes(targetDate.getMinutes() + 30);
  } else if (text.includes("بعد ساعة") || text.includes("in an hour")) {
    targetDate.setHours(targetDate.getHours() + 1);
  } else if (text.includes("بعد ساعتين") || text.includes("in 2 hours")) {
    targetDate.setHours(targetDate.getHours() + 2);
  } else if (text.includes("بعد 3 ساعات") || text.includes("in 3 hours")) {
    targetDate.setHours(targetDate.getHours() + 3);
  } else if (text.includes("غدا") || text.includes("غداً") || text.includes("tomorrow")) {
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(9, 0, 0, 0);
  } else if (text.includes("بعد غد") || text.includes("بعد بكرة")) {
    targetDate.setDate(targetDate.getDate() + 2);
    targetDate.setHours(9, 0, 0, 0);
  } else if (text.includes("الليلة") || text.includes("هذه الليلة") || text.includes("tonight")) {
    targetDate.setHours(21, 0, 0, 0);
  } else if (text.includes("مساء اليوم") || text.includes("عصر اليوم") || text.includes("this evening")) {
    targetDate.setHours(17, 0, 0, 0);
  }

  // Parse exact hour (e.g. "الساعة 9", "الساعة 10:30 مساء", "at 4pm")
  const hourMatch = text.match(/(?:الساعة|at)\s*(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباحاً|مساء|مساءً|am|pm)?/i);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1], 10);
    const minute = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
    const period = hourMatch[3] ? hourMatch[3].toLowerCase() : "";
    const isPm = period.includes("مساء") || period === "pm" || text.includes("مساء") || text.includes("ليلا") || text.includes("عصرا");
    const isAm = period.includes("صباح") || period === "am" || text.includes("صباحا") || text.includes("فجرا");

    if (isPm && hour < 12) hour += 12;
    if (isAm && hour === 12) hour = 0;

    targetDate.setHours(hour, minute, 0, 0);

    // If time has already passed today and no explicit future day mentioned, schedule for tomorrow
    if (targetDate.getTime() <= now.getTime() && !text.includes("غد") && !text.includes("tomorrow") && !text.includes("بعد")) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
  }

  // Check ISO direct parse
  const parsedDirect = Date.parse(input);
  if (!isNaN(parsedDirect) && parsedDirect > now.getTime()) {
    targetDate = new Date(parsedDirect);
  }

  // Safe fallback if past: schedule 1 hour from now
  if (targetDate.getTime() <= now.getTime()) {
    targetDate = new Date(now.getTime() + 60 * 60 * 1000);
  }

  const formatted = targetDate.toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    timestamp: targetDate.getTime(),
    formatted,
    recurrence,
  };
}

export const taskCreateTool = {
  name: "task_create",
  description: "جدولة مهمة أو تذكير أو فحص دوري أو تقرير استباقي في وقت محدد وحفظها في قاعدة البيانات للتنفيذ التلقائي",
  execute: async (args: {
    title: string;
    dueDate?: string;
    type?: "reminder" | "email" | "research" | "code" | "general_task" | "whatsapp_message";
    prompt?: string;
    channel?: "telegram" | "whatsapp" | "web" | "email";
    chatId?: string;
    userId?: string;
    priority?: "high" | "medium" | "low";
    category?: string;
    description?: string;
    recurrence?: "once" | "daily" | "weekly" | "monthly" | "workdays";
  }) => {
    try {
      const { timestamp, formatted, recurrence: parsedRecurrence } = parseNaturalDateToTimestamp(
        args.dueDate || "بعد ساعة"
      );

      const recurrence = args.recurrence || parsedRecurrence || "once";
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const activeUserId = args.userId || "default_user";
      const activeChannel = args.channel || (args.chatId?.startsWith("+") ? "whatsapp" : args.chatId ? "telegram" : "web");
      const taskType = args.type === "whatsapp_message" ? "general_task" : (args.type || "reminder");

      const taskRecord = await ScheduledTaskRepository.createTask({
        id: taskId,
        userId: activeUserId,
        chatId: args.chatId || undefined,
        channel: activeChannel,
        title: args.title,
        type: taskType,
        prompt: args.prompt || args.description || args.title,
        payload: {
          priority: args.priority || "medium",
          category: args.category || "general",
          description: args.description || "",
        },
        targetTimestamp: timestamp,
        targetDateIso: new Date(timestamp).toISOString(),
        recurrence,
        autoExecute: true,
      });

      return JSON.stringify({
        success: true,
        taskId: taskRecord.id,
        task: taskRecord,
        formattedDate: formatted,
        message: `تمت جدولة المهمة بنجاح: "${args.title}" للموعد (${formatted}) عبر قناة (${activeChannel}) بنمط (${recurrence}). سيتولى الوكيل المستقل المراقبة والاستيقاظ والتنفيذ في الموعد المحدد.`,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "فشل في جدولة المهمة في قاعدة البيانات",
      });
    }
  },
};

export const scheduleEmailTool = {
  name: "schedule_email",
  description: "جدولة إرسال بريد إلكتروني لاحقاً (Send Later) في وقت وموعد محدد عبر Gmail وحفظه في قاعدة البيانات",
  execute: async (args: {
    to: string;
    subject: string;
    body: string;
    scheduledTime: string;
    userId?: string;
    priority?: "high" | "medium" | "low";
  }) => {
    try {
      let rawTo = (args.to || "").trim();
      const lower = rawTo.toLowerCase();
      if (
        !rawTo ||
        lower === "support" ||
        lower === "support email" ||
        lower.includes("الدعم") ||
        lower.includes("دعم المنصة") ||
        lower.includes("خدمة العملاء")
      ) {
        const adminConfig = getInMemoryAdminConfig();
        rawTo = adminConfig.platformSupportEmail || "souftoolsheb@gmail.com";
      }

      const cleanTo = normalizeAndFixEmailAddress(rawTo);
      const { timestamp, formatted, recurrence } = parseNaturalDateToTimestamp(
        args.scheduledTime || "غداً الساعة 9 صباحاً"
      );
      const scheduleId = `email_sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const activeUserId = args.userId || "default_user";

      const taskRecord = await ScheduledTaskRepository.createTask({
        id: scheduleId,
        userId: activeUserId,
        channel: "email",
        title: `إرسال بريد إلى: ${cleanTo} - ${args.subject}`,
        type: "email",
        prompt: args.body,
        payload: {
          emailData: {
            to: cleanTo,
            subject: args.subject,
            body: args.body,
          },
          priority: args.priority || "medium",
        },
        targetTimestamp: timestamp,
        targetDateIso: new Date(timestamp).toISOString(),
        recurrence,
        autoExecute: true,
      });

      return JSON.stringify({
        success: true,
        taskId: taskRecord.id,
        task: taskRecord,
        scheduledTimeFormatted: formatted,
        message: `تمت جدولة إرسال البريد الإلكتروني بنجاح إلى (${cleanTo}) في موعد: ${formatted}. الوكيل المستقل سيتولى الاستيقاظ التلقائي وإرسال الرسالة في الموعد المحدد.`,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "فشل في جدولة إرسال البريد الإلكتروني",
      });
    }
  },
};

export const taskListTool = {
  name: "task_list",
  description: "عرض قائمة بجميع المهام والرسائل المجدولة النشطة من قاعدة البيانات وحالتها ومواعيد تنفيذها",
  execute: async (args?: { userId?: string; filter?: "all" | "pending" | "completed" | "email" | "task" }) => {
    try {
      const activeUserId = args?.userId || "default_user";
      const statusFilter = args?.filter === "completed" ? "completed" : args?.filter === "all" ? undefined : "pending";
      const tasks = await ScheduledTaskRepository.listTasksByUser(activeUserId, statusFilter, 30);

      const formattedTasks = (tasks || []).map((t: any) => {
        const diffMs = t.targetTimestamp - Date.now();
        const diffMins = Math.max(0, Math.round(diffMs / 60000));
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          channel: t.channel,
          status: t.status,
          targetDate: t.targetDateIso,
          minutesRemaining: diffMins,
          recurrence: t.recurrence,
        };
      });

      return JSON.stringify({
        success: true,
        count: formattedTasks.length,
        tasks: formattedTasks,
        message: `تم استعراض ${formattedTasks.length} من المهام المجدولة النشطة.`,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "فشل في قراءة قائمة المهام المجدولة من قاعدة البيانات",
      });
    }
  },
};

export const scheduleCancelTool = {
  name: "schedule_cancel",
  description: "إلغاء مهمة مجدولة أو تذكير بواسطة معرف المهمة (Task ID) وحذف جدولتها من قاعدة البيانات",
  execute: async (args: { taskId: string; reason?: string }) => {
    try {
      if (!args.taskId) {
        return JSON.stringify({ success: false, error: "معرف المهمة مطلوب للإلغاء" });
      }
      const ok = await ScheduledTaskRepository.cancelTask(args.taskId, args.reason);
      return JSON.stringify({
        success: ok,
        taskId: args.taskId,
        message: ok
          ? `تم إلغاء الجدولة للمهمة (${args.taskId})${args.reason ? ` - السبب: ${args.reason}` : ""}`
          : "تعذر العثور على المهمة أو تحديث حالتها.",
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "فشل في إلغاء الجدولة",
      });
    }
  },
};
