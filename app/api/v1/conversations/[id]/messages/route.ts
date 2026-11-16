/**
 * /api/v1/conversations/[id]/messages
 * 
 * GET: Lists paginated messages for a conversation ordered by createdAt ASC.
 * POST: Creates a message in Turso and broadcasts a sync event to connected devices.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { toIsoDateString } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const { id: conversationId } = await params;
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 100);

    const db = await getReadyDb();

    // Verify conversation ownership
    const conv = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!conv) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المحادثة غير موجودة" },
        { status: 404 }
      );
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      messages: rows.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        sender: m.sender,
        content: m.content,
        reasoning: m.reasoning,
        sources: m.sources,
        toolCalls: m.toolCalls,
        version: m.version,
        metadata: m.metadata,
        createdAt: toIsoDateString(m.createdAt),
        updatedAt: toIsoDateString(m.updatedAt),
      })),
    });
  } catch (error: any) {
    console.error("[Messages GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "FETCH_ERROR", message: "فشل استرداد رسائل المحادثة" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const { id: conversationId } = await params;
    const body = await req.json().catch(() => ({}));
    const deviceId = req.headers.get("x-device-id");

    const db = await getReadyDb();

    // Verify conversation ownership
    const conv = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!conv) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المحادثة غير موجودة" },
        { status: 404 }
      );
    }

    const id = body.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sender = body.sender || "user";
    const content = body.content || "";
    const reasoning = body.reasoning || null;
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const toolCalls = Array.isArray(body.toolCalls) ? body.toolCalls : [];
    const metadata = body.metadata || {};

    const now = new Date();
    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(messages)
        .values({
          id,
          conversationId,
          sender,
          content,
          reasoning,
          sources,
          toolCalls,
          version: 1,
          metadata,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx
        .update(conversations)
        .set({ updatedAt: now })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)));

      return inserted;
    });

    // Broadcast sync event to all other user devices
    await recordSyncEvent({
      userId: user.id,
      entityType: "message",
      entityId: id,
      operation: "created",
      version: 1,
      payload: {
        id: created.id,
        conversationId,
        sender: created.sender,
        content: created.content,
        reasoning: created.reasoning,
        sources: created.sources,
        toolCalls: created.toolCalls,
        createdAt: toIsoDateString(created.createdAt),
      },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      message: {
        ...created,
        createdAt: toIsoDateString(created.createdAt),
        updatedAt: toIsoDateString(created.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[Message POST Error]:", error);
    return NextResponse.json(
      { success: false, code: "CREATE_ERROR", message: "فشل حفظ الرسالة في السحابة" },
      { status: 500 }
    );
  }
}
