import { NextRequest, NextResponse } from "next/server";
import { whatsappManager } from "@/lib/whatsapp/whatsappManager";
import {
  startBaileysSession,
  sendRealWhatsAppMessage,
  clearAuthSession,
} from "@/lib/whatsapp/baileysService";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { action } = body;

    if (action === "generate_qr") {
      // Initiate real Baileys WebSocket handshake with WhatsApp servers
      const baileysRes = await startBaileysSession("qr");
      const currentConfig = whatsappManager.getConfig();

      return NextResponse.json({
        success: baileysRes.success,
        qrDataUrl: baileysRes.qrDataUrl || currentConfig.qrCodeData,
        expiresAt: currentConfig.qrExpiresAt || Date.now() + 50000,
        config: currentConfig,
        message: baileysRes.message || "تم طلب رمز الاستجابة السريعة من خوادم واتساب",
      });
    }

    if (action === "request_pairing_code") {
      const { phoneNumber } = body;
      if (!phoneNumber) {
        return NextResponse.json(
          { success: false, error: "يرجى تقديم رقم الهاتف مع مفتاح الدولة الدولي (مثال: +966501234567)" },
          { status: 400 }
        );
      }

      const formattedPhone = whatsappManager.normalizePhoneNumber(phoneNumber);

      // Request real 8-character Pairing Code from WhatsApp Multi-Device servers
      const baileysRes = await startBaileysSession("code", formattedPhone);
      const currentConfig = whatsappManager.getConfig();

      if (!baileysRes.pairingCode && !currentConfig.pairingCode) {
        return NextResponse.json(
          {
            success: false,
            error: baileysRes.message || "جاري الاتصال بخوادم واتساب لتوليد رمز الاقتران، يرجى المحاولة بعد لحظات.",
            config: currentConfig,
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        code: baileysRes.pairingCode || currentConfig.pairingCode,
        formattedPhone,
        config: currentConfig,
      });
    }

    if (action === "confirm_connection") {
      const { phoneNumber } = body;
      const config = whatsappManager.confirmConnection(phoneNumber);
      return NextResponse.json({
        success: true,
        config,
        message: "تم تأكيد ربط الواتساب بنجاح!",
      });
    }

    if (action === "disconnect") {
      clearAuthSession();
      const config = whatsappManager.disconnect();
      return NextResponse.json({
        success: true,
        config,
        message: "تم قطع الاتصال بجلسة واتساب وتسجيل الخروج بنجاح",
      });
    }

    if (action === "send_test") {
      const { to, message } = body;
      if (!to || !message) {
        return NextResponse.json(
          { success: false, error: "رقم المستلم ونص الرسالة مطلوبان" },
          { status: 400 }
        );
      }
      
      const res = await sendRealWhatsAppMessage(to, message);
      
      if (!res.success) {
        return NextResponse.json(
          {
            success: false,
            error: res.error || "تعذر إرسال الرسالة. تأكد من أن جلسة الواتساب متصلة بنجاح.",
            config: whatsappManager.getConfig(),
            logs: whatsappManager.getLogs(),
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        messageId: res.messageId,
        config: whatsappManager.getConfig(),
        logs: whatsappManager.getLogs(),
        message: "تم إرسال الرسالة بنجاح عبر بوابة واتساب!",
      });
    }

    return NextResponse.json(
      { success: false, error: "إجراء غير معروف" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشلت عملية جلسة واتساب" },
      { status: 500 }
    );
  }
}
