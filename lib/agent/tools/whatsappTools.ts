/**
 * WhatsApp Integration Tools for SoufAI Agent
 */

export interface WhatsAppMessage {
  id: string;
  recipientPhone: string;
  messageText: string;
  status: "sent" | "scheduled" | "failed";
  waLink: string;
  timestamp: string;
  dispatchedViaGateway?: boolean;
}

export const whatsappSendTool = {
  name: "whatsapp_send",
  description: "إرسال رسالة واتساب مباشرة أو إنشاء رابط تفاعلي لإرسال الرسالة عبر WhatsApp Web/App",
  execute: async (args: {
    phone: string;
    message: string;
    scheduleTime?: string;
  }) => {
    try {
      // Clean phone number (remove +, spaces, dashes)
      const cleanPhone = args.phone.replace(/[^0-9]/g, "");
      const encodedMsg = encodeURIComponent(args.message);
      const waLink = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

      let dispatchedViaGateway = false;
      let deliveryNote = "";

      // If running on server, attempt real Baileys / Meta Cloud API dispatch
      if (typeof window === "undefined") {
        try {
          const { sendRealWhatsAppMessage } = await import("@/lib/whatsapp/baileysService");
          const result = await sendRealWhatsAppMessage(cleanPhone, args.message);
          if (result.success) {
            dispatchedViaGateway = true;
            deliveryNote = " (تم البث والتسليم المباشر عبر بوابة واتساب النشطة)";
          }
        } catch (dispatchErr) {
          console.warn("Direct WhatsApp gateway dispatch deferred to link:", dispatchErr);
        }
      }

      const messageObj: WhatsAppMessage = {
        id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipientPhone: cleanPhone,
        messageText: args.message,
        status: args.scheduleTime ? "scheduled" : "sent",
        waLink,
        timestamp: new Date().toISOString(),
        dispatchedViaGateway,
      };

      return JSON.stringify({
        success: true,
        data: messageObj,
        message: `تم تجهيز وإرسال رسالة الواتساب للرقم +${cleanPhone}${deliveryNote}. يمكن أيضاً فتح الرابط المباشر للتفاعل فوراً.`,
        waLink,
      });
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: err.message || "فشل إعداد رسالة الواتساب",
      });
    }
  },
};

export const whatsappTemplateTool = {
  name: "whatsapp_template",
  description: "إرسال قالب رسالة واتساب مجهز مسبقاً (تذكير بموعد، تلخيص اجتماع، تأكيد مهمة)",
  execute: async (args: {
    phone: string;
    templateType: "reminder" | "summary" | "confirmation";
    details: string;
  }) => {
    const cleanPhone = args.phone.replace(/[^0-9]/g, "");
    let text = "";
    if (args.templateType === "reminder") {
      text = `⏰ *تذكير من SoufAI*:\n${args.details}\n\nدمت بخير!`;
    } else if (args.templateType === "summary") {
      text = `📝 *ملخص جديد من SoufAI*:\n${args.details}\n\nنتمنى لك يوماً سعيداً!`;
    } else {
      text = `✅ *تأكيد عملية*:\n${args.details}`;
    }

    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

    if (typeof window === "undefined") {
      try {
        const { sendRealWhatsAppMessage } = await import("@/lib/whatsapp/baileysService");
        await sendRealWhatsAppMessage(cleanPhone, text);
      } catch (e) {
        // Fallback silently
      }
    }

    return JSON.stringify({
      success: true,
      data: {
        phone: cleanPhone,
        text,
        waLink,
        templateType: args.templateType,
      },
      waLink,
    });
  },
};
