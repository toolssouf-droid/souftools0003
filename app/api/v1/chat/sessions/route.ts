/**
 * SoufTools Chat Sessions API Route
 * Handles listing conversations and saving/updating sessions directly in the private PostgreSQL/Drizzle Repository.
 */

import { NextRequest, NextResponse } from "next/server";
import { ConversationRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/security/rateLimiter";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { telegramManager } from "@/lib/telegram/telegramManager";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const rate = checkRateLimit(`chat_list_${user.id}`, 120, 120);
  if (!rate.allowed) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "تم تجاوز معدل الطلبات المسموح", retryAfter: rate.retryAfterSeconds },
      { status: 429 }
    );
  }

  try {
    await telegramManager.ensureInitialized();
    const sessions = await ConversationRepository.listByUser(user.id);
    const telegramSessions = telegramManager.getTelegramSessions(user.id, user.email);

    // Merge sessions, deduplicate by ID, and sort by updatedAt descending
    const sessionMap = new Map<string, any>();
    (sessions || []).forEach((s: any) => {
      sessionMap.set(s.id, {
        ...s,
        source: s.source || (s.id.startsWith("tg_") ? "telegram" : "web"),
        isTelegram: s.isTelegram ?? s.id.startsWith("tg_"),
      });
    });

    (telegramSessions || []).forEach((tg: any) => {
      sessionMap.set(tg.id, {
        ...tg,
        source: "telegram",
        channel: "telegram",
        isTelegram: true,
      });
    });

    const merged = Array.from(sessionMap.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );

    return NextResponse.json({ success: true, sessions: merged });
  } catch (err: any) {

    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل استرجاع المحادثات من قاعدة البيانات", error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const session = body.session;

    if (!session || !session.id) {
      return NextResponse.json({ code: "BAD_REQUEST", message: "بيانات الجلسة غير مكتملة" }, { status: 400 });
    }

    await ConversationRepository.saveConversation(user.id, session);

    // Broadcast sync event to all active browsers and devices of this user
    const deviceId = req.headers.get("x-device-id");
    recordSyncEvent({
      userId: user.id,
      entityType: "conversation",
      entityId: session.id,
      operation: "updated",
      payload: {
        id: session.id,
        title: session.title,
        modelId: session.modelId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt || Date.now(),
        messages: session.messages || [],
      },
      deviceId: deviceId || null,
    }).catch(() => null);

    return NextResponse.json({ success: true, message: "تم حفظ المحادثة بنجاح" });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل حفظ المحادثة في قاعدة البيانات", error: err.message },
      { status: 500 }
    );
  }
}
