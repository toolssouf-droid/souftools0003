/**
 * SoufTools Specific Chat Session API Route
 * Handles retrieving and deleting a specific conversation by ID with ownership validation.
 * Seamlessly resolves both Web conversations and Telegram shared sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { ConversationRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { telegramManager } from "@/lib/telegram/telegramManager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "معرف المحادثة مفقود" }, { status: 400 });
  }

  try {
    // 1. Check if it's a Telegram session
    if (id.startsWith("tg_") || id.startsWith("tgchat_")) {
      const cleanChatId = id.replace(/^(tg_|tgchat_)/, "");
      const tgSession = telegramManager.getTelegramSession(cleanChatId) || telegramManager.getTelegramSession(id);
      if (tgSession) {
        return NextResponse.json({
          success: true,
          session: {
            id: tgSession.id,
            title: tgSession.title,
            modelId: tgSession.modelId || "spark",
            createdAt: tgSession.createdAt,
            updatedAt: tgSession.updatedAt,
            isTelegram: true,
            channel: "telegram",
            source: "telegram",
            telegramChatId: tgSession.chatId,
            telegramUsername: tgSession.username,
            telegramSender: tgSession.senderName,
            messages: (tgSession.messages || []).map((m) => ({
              id: m.id,
              role: m.role || (m.sender === "user" ? "user" : "model"),
              sender: m.sender || (m.role === "user" ? "user" : "assistant"),
              content: m.content,
              timestamp: m.timestamp,
              source: "telegram",
            })),
          },
        });
      }
    }

    // 2. Check ConversationRepository (PostgreSQL / Server Disk Store)
    const conv = await ConversationRepository.getConversationById(id, user.id);
    if (conv) {
      return NextResponse.json({
        success: true,
        session: conv,
      });
    }

    // 3. Fallback check telegramManager if ID was chatId without prefix
    const tgFallback = telegramManager.getTelegramSession(id);
    if (tgFallback) {
      return NextResponse.json({
        success: true,
        session: {
          id: tgFallback.id,
          title: tgFallback.title,
          modelId: tgFallback.modelId || "spark",
          createdAt: tgFallback.createdAt,
          updatedAt: tgFallback.updatedAt,
          isTelegram: true,
          channel: "telegram",
          source: "telegram",
          telegramChatId: tgFallback.chatId,
          telegramUsername: tgFallback.username,
          telegramSender: tgFallback.senderName,
          messages: (tgFallback.messages || []).map((m) => ({
            id: m.id,
            role: m.role || (m.sender === "user" ? "user" : "model"),
            sender: m.sender || (m.role === "user" ? "user" : "assistant"),
            content: m.content,
            timestamp: m.timestamp,
            source: "telegram",
          })),
        },
      });
    }

    return NextResponse.json(
      { code: "NOT_FOUND", message: "المحادثة غير موجودة" },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل جلب تفاصيل المحادثة", error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "معرف المحادثة مفقود" }, { status: 400 });
  }

  try {
    await ConversationRepository.deleteConversation(user.id, id);

    const deviceId = req.headers.get("x-device-id");
    recordSyncEvent({
      userId: user.id,
      entityType: "conversation",
      entityId: id,
      operation: "deleted",
      payload: { id },
      deviceId: deviceId || null,
    }).catch(() => null);

    return NextResponse.json({ success: true, message: "تم حذف المحادثة بنجاح" });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل حذف المحادثة", error: err.message },
      { status: 500 }
    );
  }
}
