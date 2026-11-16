// Telegram Conversations API - Authenticated & Segregated per user/admin
import { NextRequest, NextResponse } from "next/server";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const authUser = authResult.user;

  try {
    await telegramManager.ensureInitialized?.();
    const conversations = telegramManager.getTelegramSessions(authUser.id, authUser.email);

    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("Failed to fetch telegram conversations:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to fetch telegram conversations",
        conversations: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const authUser = authResult.user;

  try {
    await telegramManager.ensureInitialized?.();
    const body = await req.json().catch(() => ({}));
    const { chatId, text } = body;

    if (!chatId || !text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "معرف المحادثة ونص الرسالة مطلوبان" },
        { status: 400 }
      );
    }

    const isAdmin = authUser.role === "admin" || authUser.role === "super_admin";
    if (!isAdmin) {
      const paired = telegramManager.getPairedUser(chatId);
      const isOwner =
        (paired?.userId && paired.userId === authUser.id) ||
        (paired?.email && authUser.email && paired.email.toLowerCase() === authUser.email.toLowerCase());

      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: "غير مصرح لك بإرسال رسائل لهذه المحادثة" },
          { status: 403 }
        );
      }
    }

    const result = await telegramManager.sendTelegramReplyFromWeb(chatId, text.trim());
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "فشل إرسال الرد إلى تيليجرام" },
        { status: 500 }
      );
    }

    const updatedSession = telegramManager.getTelegramSession(chatId);

    return NextResponse.json({
      success: true,
      message: "تم إرسال الرسالة إلى تيليجرام بنجاح",
      session: updatedSession,
    });
  } catch (error: any) {
    console.error("Failed to send telegram reply:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "حدث خطأ أثناء إرسال الرد" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const authUser = authResult.user;

  try {
    await telegramManager.ensureInitialized?.();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const chatId = searchParams.get("chatId");

    const target = sessionId || chatId;
    if (!target) {
      return NextResponse.json(
        { success: false, error: "معرف الجلسة مطلوب للحذف" },
        { status: 400 }
      );
    }

    const isAdmin = authUser.role === "admin" || authUser.role === "super_admin";
    if (!isAdmin) {
      const cleanChatId = target.replace(/^tg_/, "");
      const paired = telegramManager.getPairedUser(cleanChatId);
      const isOwner =
        (paired?.userId && paired.userId === authUser.id) ||
        (paired?.email && authUser.email && paired.email.toLowerCase() === authUser.email.toLowerCase());

      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: "غير مصرح لك بحذف هذه المحادثة" },
          { status: 403 }
        );
      }
    }

    const deleted = await telegramManager.deleteTelegramSession(target);

    return NextResponse.json({
      success: true,
      deleted,
      message: deleted ? "تم حذف محادثة تيليجرام بنجاح" : "لم يتم العثور على المحادثة",
    });
  } catch (error: any) {
    console.error("Failed to delete telegram conversation:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "فشل حذف محادثة تيليجرام" },
      { status: 500 }
    );
  }
}
