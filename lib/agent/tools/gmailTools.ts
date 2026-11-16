import { Tool } from "../agentActivityTypes";

export const gmailSearchTool: Tool = {
  name: "gmail_search",
  description: "Search for emails in the user's Gmail account. Use standard Gmail search queries like 'from:google', 'newer_than:7d', 'subject:invoice'.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The Gmail search query." },
      maxResults: { type: "number", description: "Maximum number of results to return (default: 10)." },
    },
    required: ["query"],
  },
  execute: async (args: any, context?: any) => {
    const token = context?.gmailToken;
    if (!token) {
      return JSON.stringify({
        success: false,
        error: "حساب Gmail غير متصل أو انتهت صلاحية الجلسة. يرجى تفعيل وربط Gmail من قائمة الأدوات (Tools Menu).",
      });
    }
    
    try {
      const q = encodeURIComponent(args.query || "");
      const limit = Math.min(Math.max(Number(args.maxResults) || 10, 1), 20);
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawErrMsg = errJson?.error?.message || "";
        
        if (res.status === 401) {
          return JSON.stringify({
            success: false,
            error: "انتهت صلاحية رمز الوصول لـ Gmail (401 Unauthorized). يرجى إعادة النقر على أداة Gmail في قائمة الأدوات لإعادة تسجيل الدخول.",
          });
        }
        if (res.status === 403) {
          if (rawErrMsg.toLowerCase().includes("disabled") || rawErrMsg.toLowerCase().includes("has not been used")) {
            return JSON.stringify({
              success: false,
              error: `خدمة Gmail API غير مفعلة في مشروع Google Cloud الخاص بالتطبيق! يرجى تفعيل Gmail API من Google Cloud Console: (${rawErrMsg})`,
            });
          }
          return JSON.stringify({
            success: false,
            error: `خطأ في الصلاحيات (403 Forbidden): ${rawErrMsg || "يرجى التأكد من الضغط على زر المتابعة (Continue) في أسفل شاشة أذونات Google وإعادة المحاولة."}`,
          });
        }
        return JSON.stringify({
          success: false,
          error: `تعذر جلب الرسائل من Gmail (HTTP ${res.status}): ${rawErrMsg || ""}`,
        });
      }
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) {
        return JSON.stringify({
          success: true,
          messages: [],
          count: 0,
          note: `لم يتم العثور على رسائل مطابقة للبحث: "${args.query}"`,
        });
      }
      
      // Fetch details for each message
      const messagesWithDetails = await Promise.all(data.messages.map(async (m: any) => {
        try {
          const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (mRes.ok) {
            const mData = await mRes.json();
            const subjectHeader = mData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject');
            const fromHeader = mData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from');
            const dateHeader = mData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'date');
            return {
              id: m.id,
              threadId: m.threadId,
              from: fromHeader?.value || "مجهول",
              subject: subjectHeader?.value || "بدون عنوان",
              date: dateHeader?.value || "",
              snippet: mData.snippet || ""
            };
          }
        } catch {}
        return null;
      }));
      
      const cleanMessages = messagesWithDetails.filter(Boolean);
      return JSON.stringify({
        success: true,
        messages: cleanMessages,
        count: cleanMessages.length,
      });
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: err.message || "حدث خطأ غير متوقع أثناء البحث في Gmail",
      });
    }
  },
};

export const gmailReadTool: Tool = {
  name: "gmail_read",
  description: "Read the full content of a specific email message by its ID.",
  parameters: {
    type: "object",
    properties: {
      messageId: { type: "string", description: "The ID of the email message to read." },
    },
    required: ["messageId"],
  },
  execute: async (args: any, context?: any) => {
    const token = context?.gmailToken;
    if (!token) {
      return JSON.stringify({
        success: false,
        error: "حساب Gmail غير متصل.",
      });
    }
    
    try {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${args.messageId}?format=full`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawErrMsg = errJson?.error?.message || "";
        return JSON.stringify({
          success: false,
          error: `تعذر قراءة محتوى الرسالة (${res.status}): ${rawErrMsg}`,
        });
      }
      const data = await res.json();
      
      // Basic body parsing
      let bodyData = "";
      if (data.payload?.parts) {
        const textPart = data.payload.parts.find((p: any) => p.mimeType === "text/plain");
        if (textPart && textPart.body?.data) {
          bodyData = Buffer.from(textPart.body.data, 'base64').toString('utf8');
        } else if (data.payload.parts[0]?.body?.data) {
           bodyData = Buffer.from(data.payload.parts[0].body.data, 'base64').toString('utf8');
        }
      } else if (data.payload?.body?.data) {
        bodyData = Buffer.from(data.payload.body.data, 'base64').toString('utf8');
      }
      
      const headers = data.payload?.headers || [];
      const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || "مجهول";
      const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || "";
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || "بدون عنوان";
      const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || "";
      
      return JSON.stringify({
        success: true,
        id: data.id,
        threadId: data.threadId,
        from,
        to,
        subject,
        date,
        snippet: data.snippet,
        body: bodyData.substring(0, 6000)
      });
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: err.message || "فشلت قراءة الرسالة",
      });
    }
  },
};

import { normalizeAndFixEmailAddress } from "@/lib/utils/emailFormatter";
import { getInMemoryAdminConfig } from "@/lib/adminConfigStore";

function resolveRecipientEmail(toInput?: string): string {
  if (!toInput || !toInput.trim()) {
    const adminConfig = getInMemoryAdminConfig();
    return adminConfig.platformSupportEmail || "souftoolsheb@gmail.com";
  }
  const cleanInput = toInput.trim();
  const lower = cleanInput.toLowerCase();
  if (
    lower === "support" ||
    lower === "support email" ||
    lower === "platform support" ||
    lower.includes("الدعم") ||
    lower.includes("دعم المنصة") ||
    lower.includes("خدمة العملاء")
  ) {
    const adminConfig = getInMemoryAdminConfig();
    return adminConfig.platformSupportEmail || "souftoolsheb@gmail.com";
  }
  return normalizeAndFixEmailAddress(cleanInput);
}

export const gmailDraftTool: Tool = {
  name: "gmail_draft",
  description: "Prepare an email draft with interactive preview widget for user review. Do NOT claim the email has been sent; inform the user the draft is ready for review.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address. If user wants support, specify 'support'." },
      subject: { type: "string", description: "Email subject." },
      body: { type: "string", description: "Email body text." },
    },
    required: ["to", "subject", "body"],
  },
  execute: async (args: any, context?: any) => {
    const resolvedTo = resolveRecipientEmail(args.to);
    return JSON.stringify({
      success: true,
      __souftools_approval_required: true,
      type: "gmail_draft",
      isDraft: true,
      data: {
        to: resolvedTo,
        subject: args.subject,
        body: args.body,
      },
      message: `تم تجهيز مسودة البريد الإلكتروني للمستلم (${resolvedTo}). ظهرت بطاقة مراجعة تفاعلية للمستخدم للتأكيد والإرسال.`,
    });
  },
};

export const gmailSendTool: Tool = {
  name: "gmail_send",
  description: "Directly send an email using Gmail API with authorization token.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address." },
      subject: { type: "string", description: "Email subject." },
      body: { type: "string", description: "Email body text." },
    },
    required: ["to", "subject", "body"],
  },
  execute: async (args: any, context?: any) => {
    const token = context?.gmailToken;
    const resolvedTo = resolveRecipientEmail(args.to);

    if (!token) {
      return JSON.stringify({
        success: false,
        requiresAuth: true,
        error: "حساب Gmail غير متصل بتفويض OAuth. يرجى ربط حساب Gmail من قائمة الأدوات ليتمكن الوكيل من الإرسال الفعلي.",
      });
    }

    try {
      const emailLines = [
        `To: ${resolvedTo}`,
        `Subject: =?utf-8?B?${Buffer.from(args.subject || "رسالة من منصة SoufAI").toString("base64")}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        args.body || "",
      ];

      const email = emailLines.join("\r\n");
      const base64EncodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: base64EncodedEmail,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return JSON.stringify({
          success: false,
          error: errData.error?.message || `فشل إرسال البريد (${response.status})`,
        });
      }

      const sendData = await response.json().catch(() => ({}));
      return JSON.stringify({
        success: true,
        messageId: sendData.id,
        threadId: sendData.threadId,
        recipient: resolvedTo,
        message: `تم إرسال البريد الإلكتروني فعلياً ونجاح تام إلى (${resolvedTo}) عبر خادم Gmail الرسمي.`,
      });
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: err.message || "فشل إرسال البريد الإلكتروني",
      });
    }
  },
};

export const gmailSummarizeTool: Tool = {
  name: "gmail_summarize",
  description: "Get recent unread or important emails from Gmail and generate a concise summary of key updates.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query for emails to summarize, e.g., 'is:unread', 'newer_than:1d', 'category:primary'." },
      maxEmails: { type: "number", description: "Maximum number of emails to summarize (default: 5)." },
    },
  },
  execute: async (args: any, context?: any) => {
    const token = context?.gmailToken;
    if (!token) {
      return JSON.stringify({
        success: false,
        error: "حساب Gmail غير متصل. يرجى تفعيل Gmail من قائمة الأدوات.",
      });
    }

    try {
      const q = encodeURIComponent(args.query || "is:unread");
      const limit = Math.min(Math.max(Number(args.maxEmails) || 5, 1), 10);
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawErrMsg = errJson?.error?.message || "";
        return JSON.stringify({
          success: false,
          error: `خطأ في جلب الرسائل (${res.status}): ${rawErrMsg}`,
        });
      }
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) {
        return JSON.stringify({
          success: true,
          summary: "لا توجد رسائل بريد جديدة مطابقة للاستعلام المحدد.",
          messages: [],
        });
      }

      const summaries = await Promise.all(data.messages.map(async (m: any) => {
        try {
          const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (mRes.ok) {
            const mData = await mRes.json();
            const subject = mData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject')?.value || "بدون عنوان";
            const from = mData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from')?.value || "مجهول";
            const date = mData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'date')?.value || "";
            return {
              id: m.id,
              threadId: m.threadId,
              from,
              subject,
              date,
              snippet: mData.snippet || "",
              brief: `📩 *من*: ${from}\n📌 *العنوان*: ${subject}\n🕒 *التاريخ*: ${date}\n💬 *الموجز*: ${mData.snippet || "لا يوجد ملخص"}`
            };
          }
        } catch {}
        return null;
      }));

      const cleanItems = summaries.filter(Boolean) as any[];
      const cleanSummariesText = cleanItems.map(item => item.brief).join("\n\n---\n\n");
      return JSON.stringify({
        success: true,
        messages: cleanItems,
        summary: cleanSummariesText,
        count: cleanItems.length,
      });
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: err.message || "فشل تلخيص رسائل Gmail",
      });
    }
  },
};
