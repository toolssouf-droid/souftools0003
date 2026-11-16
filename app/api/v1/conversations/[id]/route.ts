/**
 * /api/v1/conversations/[id]
 * 
 * GET: Retrieves a conversation with its messages and ownership verification.
 * PATCH: Updates conversation properties with optimistic concurrency version checking.
 * DELETE: Deletes conversation and its messages from Turso, broadcasting sync event.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
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

    const db = await getReadyDb();

    // Strict IDOR ownership check
    const conv = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!conv) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المحادثة غير موجودة أو لا تملك صلاحية الوصول" },
        { status: 404 }
      );
    }

    const convMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    return NextResponse.json({
      success: true,
      conversation: {
        id: conv.id,
        title: conv.title,
        modelId: conv.modelId,
        isPinned: conv.isPinned,
        isArchived: conv.isArchived,
        version: conv.version,
        metadata: conv.metadata,
        createdAt: toIsoDateString(conv.createdAt),
        updatedAt: toIsoDateString(conv.updatedAt),
      },
      messages: convMessages.map((m) => ({
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
      })),
    });
  } catch (error: any) {
    console.error("[Conversation GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "FETCH_ERROR", message: "فشل استرداد بيانات المحادثة" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const existing = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المحادثة غير موجودة" },
        { status: 404 }
      );
    }

    // Optimistic Concurrency Control
    if (typeof body.expectedVersion === "number" && body.expectedVersion < existing.version) {
      return NextResponse.json(
        {
          success: false,
          code: "CONFLICT",
          message: "حدث تعارض: تم تعديل المحادثة مسبقاً من جهاز آخر",
          currentRecord: {
            ...existing,
            createdAt: toIsoDateString(existing.createdAt),
            updatedAt: toIsoDateString(existing.updatedAt),
          },
        },
        { status: 409 }
      );
    }

    const nextVersion = existing.version + 1;
    const now = new Date();

    const [updated] = await db
      .update(conversations)
      .set({
        title: body.title !== undefined ? body.title : existing.title,
        modelId: body.modelId !== undefined ? body.modelId : existing.modelId,
        isPinned: body.isPinned !== undefined ? body.isPinned : existing.isPinned,
        isArchived: body.isArchived !== undefined ? body.isArchived : existing.isArchived,
        metadata: body.metadata !== undefined ? { ...existing.metadata, ...body.metadata } : existing.metadata,
        version: nextVersion,
        updatedAt: now,
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
      .returning();

    // Broadcast real-time sync event
    await recordSyncEvent({
      userId: user.id,
      entityType: "conversation",
      entityId: conversationId,
      operation: "updated",
      version: nextVersion,
      payload: {
        id: updated.id,
        title: updated.title,
        modelId: updated.modelId,
        isPinned: updated.isPinned,
        isArchived: updated.isArchived,
        version: updated.version,
        updatedAt: toIsoDateString(updated.updatedAt),
      },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      conversation: {
        ...updated,
        createdAt: toIsoDateString(updated.createdAt),
        updatedAt: toIsoDateString(updated.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[Conversation PATCH Error]:", error);
    return NextResponse.json(
      { success: false, code: "UPDATE_ERROR", message: "فشل تحديث المحادثة" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const { id: conversationId } = await params;
    const deviceId = req.headers.get("x-device-id");

    const db = await getReadyDb();

    const existing = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المحادثة غير موجودة" },
        { status: 404 }
      );
    }

    // Delete messages and conversation atomically from Turso
    await db.transaction(async (tx) => {
      await tx.delete(messages).where(eq(messages.conversationId, conversationId));
      await tx
        .delete(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)));
    });

    // Broadcast sync event
    await recordSyncEvent({
      userId: user.id,
      entityType: "conversation",
      entityId: conversationId,
      operation: "deleted",
      payload: { id: conversationId },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      message: "تم حذف المحادثة وكافة رسائلها نهائياً من الخادم",
      deletedId: conversationId,
    });
  } catch (error: any) {
    console.error("[Conversation DELETE Error]:", error);
    return NextResponse.json(
      { success: false, code: "DELETE_ERROR", message: "فشل حذف المحادثة" },
      { status: 500 }
    );
  }
}
