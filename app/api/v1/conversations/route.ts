/**
 * /api/v1/conversations
 * 
 * GET: Lists paginated conversations for the authenticated user from Turso.
 * POST: Creates a new conversation and dispatches a real-time sync event.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb, UserRepository } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { toIsoDateString } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "30", 10), 1), 100);

    const db = await getReadyDb();
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      conversations: rows.map((c) => ({
        id: c.id,
        title: c.title,
        modelId: c.modelId,
        isPinned: c.isPinned,
        isArchived: c.isArchived,
        version: c.version,
        metadata: c.metadata,
        createdAt: toIsoDateString(c.createdAt),
        updatedAt: toIsoDateString(c.updatedAt),
      })),
    });
  } catch (error: any) {
    console.error("[Conversations GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "FETCH_ERROR", message: "فشل استرجاع المحادثات من الخادم" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const body = await req.json().catch(() => ({}));
    const deviceId = req.headers.get("x-device-id");

    const id = body.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const title = body.title || "محادثة جديدة";
    const modelId = body.modelId || "spark";
    const metadata = body.metadata || {};
    const now = new Date();

    const db = await getReadyDb();
    await UserRepository.upsertUser({
      id: user.id,
      email: user.email,
      displayName: user.name || undefined,
    });

    const [created] = await db
      .insert(conversations)
      .values({
        id,
        userId: user.id,
        title,
        modelId,
        isPinned: false,
        isArchived: false,
        version: 1,
        metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Broadcast real-time sync event
    await recordSyncEvent({
      userId: user.id,
      entityType: "conversation",
      entityId: id,
      operation: "created",
      version: 1,
      payload: {
        id: created.id,
        title: created.title,
        modelId: created.modelId,
        version: 1,
        createdAt: toIsoDateString(created.createdAt),
        updatedAt: toIsoDateString(created.updatedAt),
      },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      conversation: {
        ...created,
        createdAt: toIsoDateString(created.createdAt),
        updatedAt: toIsoDateString(created.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[Conversation POST Error]:", error);
    return NextResponse.json(
      { success: false, code: "CREATE_ERROR", message: "فشل إنشاء محادثة جديدة" },
      { status: 500 }
    );
  }
}
