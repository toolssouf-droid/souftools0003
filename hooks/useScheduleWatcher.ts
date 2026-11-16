"use client";

import { useEffect, useRef } from "react";
import { useScheduleStore, ScheduledItem } from "@/store/scheduleStore";
import { useGmailStore } from "@/store/gmailStore";
import { useChatStore } from "@/store/chatStore";

/**
 * Play a subtle, elegant futuristic chime when the Agent wakes up and completes a task
 */
function playWakeupChime(isSuccess: boolean = true) {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    if (isSuccess) {
      // Ascending pleasant chord
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.38); // C6
    } else {
      // Gentle warning chord
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(349.23, now + 0.2);
    }

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    // Ignore audio context autoplay restrictions gracefully
  }
}

export function useScheduleWatcher() {
  const isExecutingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(async () => {
      const { items, setExecuting, markExecuted } = useScheduleStore.getState();
      const now = Date.now();

      // Find pending items that reached or passed target timestamp
      const dueItems = items.filter(
        (item) =>
          item.status === "pending" &&
          item.targetTimestamp <= now &&
          !isExecutingRef.current.has(item.id)
      );

      for (const item of dueItems) {
        if (!item.autoExecute) {
          // If autoExecute is disabled, just complete or notify user to send manually
          continue;
        }

        // Lock item from parallel execution
        isExecutingRef.current.add(item.id);
        setExecuting(item.id);

        const isEmail = item.type === "email" || !!item.emailData;

        if (isEmail && item.emailData) {
          const accessToken = useGmailStore.getState().accessToken;

          if (!accessToken) {
            // Gmail not connected
            const errMsg = "حساب Gmail غير متصل بتفويض OAuth. يرجى تفعيل الربط عبر قائمة الأدوات.";
            markExecuted(item.id, false, errMsg);
            isExecutingRef.current.delete(item.id);
            playWakeupChime(false);

            useChatStore.getState().addMessage({
              role: "model",
              content: `⚠️ **[تنبيه الوكيل الذكي - استيقاظ لمراقبة إرسال البريد المجدول]**\n\nحاولت تنفيذ المهمة المجدولة **"${item.title}"** الآن، لكن حساب Gmail غير متصل حالياً.\n\n- **المستلم:** \`${item.emailData.to}\`\n- **الموضوع:** \`${item.emailData.subject}\`\n- **الحالة:** تم الاحتفاظ بالمسودة كاملة في بطاقة الجدولة، ويمكنك ربط الحساب ثم الضغط على **إعادة المحاولة / إرسال الآن** بنقرة واحدة.`,
            });
            continue;
          }

          // Attempt autonomous sending via /api/gmail/send
          try {
            const res = await fetch("/api/gmail/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: item.emailData.to,
                subject: item.emailData.subject,
                emailBody: item.emailData.body,
                token: accessToken,
              }),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok || !data || !data.success) {
              throw new Error(data?.error || "استجابة غير متوقعة من خادم Gmail");
            }

            // SUCCESS!
            const successMsg = "تم تسليم الرسالة إلى خادم Gmail بنجاح ومراقبة العملية وتأكيد الإرسال.";
            markExecuted(item.id, true, successMsg, { gmailMessageId: data.messageId });
            playWakeupChime(true);

            useChatStore.getState().addMessage({
              role: "model",
              content: `🤖 **[تقرير الوكيل الذكي - استيقاظ ومراقبة تنفيذ الجدولة]**\n\n✨ **تم استيقاظ الوكيل وتنفيذ إرسال البريد الإلكتروني المجدول بنجاح تام!**\n\n- **المستلم:** \`${item.emailData.to}\`\n- **الموضوع:** \`${item.emailData.subject}\`\n- **التوقيت:** ${new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}\n- **نتيجة المراقبة:** ✅ نجحت المهمة 100% وتم استلام رمز التأكيد بنجاح من خادم Gmail.\n- **حالة المهمة:** مكتملة وموثقة في سجل الجدولة.`,
            });

            // Dispatch automated notification to WhatsApp Gateway
            fetch("/api/admin/whatsapp/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "send_test",
                to: item.emailData.to,
                message: `🤖 *إشعار إنجاز من SoufAI*:\nتم إرسال بريدك الإلكتروني المجدول بنجاح: "${item.emailData.subject}".`,
              }),
            }).catch(() => null);
          } catch (err: any) {
            // FAILURE
            const errMsg = err.message || "حدث خطأ غير معروف أثناء الإرسال التلقائي";
            markExecuted(item.id, false, errMsg);
            playWakeupChime(false);

            useChatStore.getState().addMessage({
              role: "model",
              content: `⚠️ **[تقرير الوكيل الذكي - تنبيه فشل الإرسال المجدول]**\n\nاستيقظت لتنفيذ المهمة **"${item.title}"** لكن واجهت مشكلة أثناء الاتصال:\n\n- **السبب:** ${errMsg}\n- **المستلم:** \`${item.emailData.to}\`\n- **الموضوع:** \`${item.emailData.subject}\`\n- **مراقبة الوضع:** لم يتم فقدان أي بيانات، البطاقة جاهزة في المحادثة لإعادة الإرسال أو التعديل.`,
            });
          } finally {
            isExecutingRef.current.delete(item.id);
          }
        } else {
          // Standard task / reminder autonomous wakeup
          markExecuted(item.id, true, "استيقظ الوكيل وأطلق التنبيه المطلوب للمهمة بنجاح.");
          isExecutingRef.current.delete(item.id);
          playWakeupChime(true);

          useChatStore.getState().addMessage({
            role: "model",
            content: `⏰ **[استيقاظ الوكيل الذكي - حان موعد المهمة المجدولة!]**\n\n📌 **${item.title}**\n${
              item.description ? `\n> ${item.description}\n` : ""
            }\n- **التوقيت:** ${new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}\n- **الأولوية:** ${
              item.priority === "high" ? "عالية 🔴" : "عادية 🟡"
            }\n- **مراقبة الوضع:** ✅ تم التنبيه بنجاح واكتمال الجدولة. هل ترغب في أن أقوم بأي إجراء إضافي متعلق بهذه المهمة؟`,
          });
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);
}
