"use client";

/**
 * SoufAI Real Autonomous Background Scheduler & Agent Wake-Up Engine
 * Continuously monitors scheduled emails, tasks, and reminders.
 * Automatically executes tasks at exact due time and awakens the agent.
 */

import { useEffect, useRef } from "react";
import { useScheduleStore, ScheduledItem } from "@/store/scheduleStore";
import { useGmailStore } from "@/store/gmailStore";
import { normalizeAndFixEmailAddress } from "@/lib/utils/emailFormatter";

export interface ScheduledWakeEventDetails {
  task: ScheduledItem;
  executedAt: number;
  success: boolean;
  message: string;
}

/**
 * Play an audible chime when the agent wakes up to execute a scheduled task
 */
function playWakeChime() {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.35); // D6

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch {
    // Audio autostart policy safe fallback
  }
}

/**
 * Trigger system/browser notification if permission granted
 */
function triggerBrowserNotification(title: string, body: string) {
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icon.png",
      });
    }
  } catch {}
}

export function executeScheduledItemNow(
  item: ScheduledItem,
  gmailToken?: string | null
): Promise<{ success: boolean; message: string }> {
  const store = useScheduleStore.getState();
  store.setExecuting(item.id);

  return new Promise(async (resolve) => {
    try {
      if (item.type === "email" && item.emailData) {
        const token = gmailToken || useGmailStore.getState().accessToken;
        const normalizedTo = normalizeAndFixEmailAddress(item.emailData.to);

        if (!token) {
          const errMsg = "حساب Gmail غير متصل بتفويض OAuth. تعذر إرسال البريد المجدول تلقائياً، يرجى ربط Gmail من قائمة الأدوات.";
          store.markExecuted(item.id, false, errMsg);
          resolve({ success: false, message: errMsg });
          return;
        }

        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: normalizedTo,
            subject: item.emailData.subject,
            emailBody: item.emailData.body,
            token,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success !== false) {
          const succMsg = `تم إرسال البريد الإلكتروني المجدول بنجاح إلى (${normalizedTo}) عبر Gmail!`;
          store.markExecuted(item.id, true, succMsg, data);
          playWakeChime();
          triggerBrowserNotification("🤖 استيقاظ الوكيل الذكي (SoufAI)", succMsg);
          
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent<ScheduledWakeEventDetails>("souf_agent_scheduled_wake", {
                detail: {
                  task: item,
                  executedAt: Date.now(),
                  success: true,
                  message: succMsg,
                },
              })
            );
          }
          resolve({ success: true, message: succMsg });
        } else {
          const failMsg = data.error || "فشل خادم Gmail في تسليم البريد المجدول.";
          store.markExecuted(item.id, false, failMsg, data);
          resolve({ success: false, message: failMsg });
        }
      } else {
        // General task / reminder
        const succMsg = `حان موعد تنفيذ المهمة المجدولة: "${item.title}". الوكيل الذكي راقب الحالة بنجاح.`;
        store.markExecuted(item.id, true, succMsg);
        playWakeChime();
        triggerBrowserNotification("⏰ تذكير بمهمة مجدولة", succMsg);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent<ScheduledWakeEventDetails>("souf_agent_scheduled_wake", {
              detail: {
                task: item,
                executedAt: Date.now(),
                success: true,
                message: succMsg,
              },
            })
          );
        }
        resolve({ success: true, message: succMsg });
      }
    } catch (err: any) {
      const errText = err?.message || "خطأ غير متوقع أثناء تنفيذ الجدولة";
      store.markExecuted(item.id, false, errText);
      resolve({ success: false, message: errText });
    }
  });
}

/**
 * React Hook that runs the continuous active background scheduler
 */
export function useBackgroundScheduler() {
  const isRunningRef = useRef(false);

  useEffect(() => {
    // Request notification permission if not asked yet
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const checkInterval = setInterval(async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        const now = Date.now();
        const state = useScheduleStore.getState();
        const pendingItems = state.items.filter(
          (item) => item.status === "pending" && item.autoExecute !== false && item.targetTimestamp <= now
        );

        for (const task of pendingItems) {
          const gmailToken = useGmailStore.getState().accessToken;
          await executeScheduledItemNow(task, gmailToken);
        }
      } catch (e) {
        console.error("Scheduler tick error:", e);
      } finally {
        isRunningRef.current = false;
      }
    }, 4000); // Check every 4 seconds

    return () => clearInterval(checkInterval);
  }, []);
}
