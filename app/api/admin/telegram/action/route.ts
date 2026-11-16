import { NextRequest, NextResponse } from "next/server";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await telegramManager.ensureInitialized();
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { action, token, webhookUrl, chatId, message } = body;

    if (action === "verify_token") {
      const result = await telegramManager.verifyToken(token);
      await telegramManager.flushPendingWrites();
      return NextResponse.json({
        success: result.success,
        bot: result.bot,
        error: result.error,
        config: telegramManager.getConfig(),
      });
    }

    if (action === "set_webhook") {
      const result = await telegramManager.setWebhook(webhookUrl);
      await telegramManager.flushPendingWrites();
      return NextResponse.json({
        success: result.success,
        description: result.description,
        error: result.error,
        config: telegramManager.getConfig(),
      });
    }

    if (action === "get_webhook_info") {
      const result = await telegramManager.getWebhookInfo();
      return NextResponse.json({
        success: result.success,
        info: result.info,
        error: result.error,
      });
    }

    if (action === "delete_webhook") {
      const result = await telegramManager.deleteWebhook();
      await telegramManager.flushPendingWrites();
      return NextResponse.json({
        success: result.success,
        error: result.error,
        config: telegramManager.getConfig(),
      });
    }

    if (action === "send_test_message") {
      if (!chatId || !message) {
        return NextResponse.json({ success: false, error: "يرجى تحديد معرف المحادثة (Chat ID) ونص الرسالة." }, { status: 400 });
      }
      const result = await telegramManager.sendMessage(chatId, message);
      return NextResponse.json({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        config: telegramManager.getConfig(),
      });
    }

    if (action === "test_ai_response") {
      const testMsg = message || "مرحباً، هل الذكاء الاصطناعي يعمل بشكل سليم؟";
      const targetChat = chatId || "admin_diagnostic_channel";
      
      // Admin Diagnostics: Simulate inbound Telegram payload to test AI reasoning pipeline
      const diagnosticProbeUpdate = {
        update_id: Date.now(),
        message: {
          message_id: Math.floor(Math.random() * 100000),
          from: {
            id: targetChat,
            first_name: "المسؤول (فحص تشخيصي)",
            username: "admin_diagnostic",
          },
          chat: {
            id: targetChat,
            first_name: "المسؤول (فحص تشخيصي)",
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: testMsg,
        },
      };

      const result = await telegramManager.processInboundMessage(diagnosticProbeUpdate);
      await telegramManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        handled: result.handled,
        replyText: result.replyText,
        config: telegramManager.getConfig(),
        logs: telegramManager.getLogs().slice(0, 10),
      });
    }

    if (action === "disconnect") {
      telegramManager.updateConfig({
        connectionStatus: "disconnected",
        botToken: "",
        botUsername: "",
        webhookActive: false,
      });
      await telegramManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        config: telegramManager.getConfig(),
      });
    }

    return NextResponse.json({ success: false, error: "الإجراء غير معروف" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "حدث خطأ في عملية تيليجرام" },
      { status: 500 }
    );
  }
}
