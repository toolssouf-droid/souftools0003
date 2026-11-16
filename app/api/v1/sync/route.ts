/**
 * /api/v1/sync
 * 
 * GET: Incremental Sync Endpoint. Returns deltas (created, updated, deleted) since cursor.
 * POST: Batch Mutation / Sync push with optimistic concurrency control.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getSyncDelta, recordSyncEvent, updateDeviceCursor } from "@/lib/sync/syncEngine";
import { getReadyDb, UserRepository } from "@/lib/db";
import { conversations, userPreferences } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const deviceId = req.headers.get("x-device-id") || url.searchParams.get("deviceId");

    const result = await getSyncDelta({
      userId: user.id,
      cursor,
      limit,
    });

    if (deviceId) {
      await updateDeviceCursor(user.id, deviceId, new Date());
    }

    return NextResponse.json({
      success: true,
      events: result.events,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      serverRevision: result.serverRevision,
    });
  } catch (error: any) {
    console.error("[Sync GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "SYNC_DELTA_FAILED", message: "فشل استرجاع تحديثات المزامنة" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();
    const body = await req.json().catch(() => ({}));
    const deviceId = req.headers.get("x-device-id");
    const { mutations } = body;

    if (!Array.isArray(mutations)) {
      return NextResponse.json(
        { success: false, code: "BAD_REQUEST", message: "قائمة التعديلات (mutations) مطلوبة كـ Array" },
        { status: 400 }
      );
    }

    const results: any[] = [];

    for (const m of mutations) {
      const { entityType, entityId, operation, expectedVersion, data } = m;

      try {
        if (entityType === "conversation") {
          const existing = await database
            .select()
            .from(conversations)
            .where(and(eq(conversations.id, entityId), eq(conversations.userId, user.id)))
            .limit(1)
            .then((r) => r[0]);

          if (!existing && operation !== "created") {
            results.push({ entityId, success: false, error: "المحادثة غير موجودة", code: "NOT_FOUND" });
            continue;
          }

          if (existing && typeof expectedVersion === "number" && expectedVersion < existing.version) {
            // 409 Conflict: Server has newer version
            results.push({
              entityId,
              success: false,
              conflict: true,
              code: "VERSION_CONFLICT",
              currentServerRecord: existing,
            });
            continue;
          }

          if (operation === "deleted") {
            await database
              .delete(conversations)
              .where(and(eq(conversations.id, entityId), eq(conversations.userId, user.id)));
            await recordSyncEvent({
              userId: user.id,
              entityType: "conversation",
              entityId,
              operation: "deleted",
              deviceId,
            });
            results.push({ entityId, success: true, operation: "deleted" });
          } else if (operation === "updated") {
            const nextVersion = (existing?.version || 1) + 1;
            const updated = await database
              .update(conversations)
              .set({
                title: data.title !== undefined ? data.title : existing?.title,
                isPinned: data.isPinned !== undefined ? data.isPinned : existing?.isPinned,
                isArchived: data.isArchived !== undefined ? data.isArchived : existing?.isArchived,
                version: nextVersion,
                updatedAt: new Date(),
              })
              .where(and(eq(conversations.id, entityId), eq(conversations.userId, user.id)))
              .returning()
              .then((r) => r[0]);

            await recordSyncEvent({
              userId: user.id,
              entityType: "conversation",
              entityId,
              operation: "updated",
              version: nextVersion,
              payload: updated,
              deviceId,
            });

            results.push({ entityId, success: true, version: nextVersion, record: updated });
          }
        } else if (entityType === "preference") {
          let existing = await database
            .select()
            .from(userPreferences)
            .where(eq(userPreferences.userId, user.id))
            .limit(1)
            .then((r) => r[0]);

          if (!existing) {
            existing = await database
              .select()
              .from(userPreferences)
              .where(eq(userPreferences.id, `pref_${user.id}`))
              .limit(1)
              .then((r) => r[0]);
          }

          const nextVersion = (existing?.version || 1) + 1;
          let updated: any;
          if (existing) {
            updated = await database
              .update(userPreferences)
              .set({
                theme: data.theme || existing?.theme,
                locale: data.locale || existing?.locale,
                soundEnabled: data.soundEnabled !== undefined ? data.soundEnabled : existing?.soundEnabled,
                autoScroll: data.autoScroll !== undefined ? data.autoScroll : existing?.autoScroll,
                webSearchEnabled: data.webSearchEnabled !== undefined ? data.webSearchEnabled : existing?.webSearchEnabled,
                version: nextVersion,
                updatedAt: new Date(),
              })
              .where(eq(userPreferences.id, existing.id))
              .returning()
              .then((r) => r[0]);
          } else {
            await UserRepository.upsertUser({ id: user.id, email: user.email || `${user.id}@souftools.app` });
            const [newPref] = await database
              .insert(userPreferences)
              .values({
                id: `pref_${user.id}`,
                userId: user.id,
                theme: data.theme || "dark",
                locale: data.locale || "ar",
                soundEnabled: data.soundEnabled !== undefined ? data.soundEnabled : true,
                autoScroll: data.autoScroll !== undefined ? data.autoScroll : true,
                webSearchEnabled: data.webSearchEnabled !== undefined ? data.webSearchEnabled : false,
                version: 1,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: userPreferences.id,
                set: {
                  theme: data.theme || "dark",
                  locale: data.locale || "ar",
                  soundEnabled: data.soundEnabled !== undefined ? data.soundEnabled : true,
                  autoScroll: data.autoScroll !== undefined ? data.autoScroll : true,
                  webSearchEnabled: data.webSearchEnabled !== undefined ? data.webSearchEnabled : false,
                  updatedAt: new Date(),
                },
              })
              .returning();
            updated = newPref;
          }

          await recordSyncEvent({
            userId: user.id,
            entityType: "preference",
            entityId: user.id,
            operation: "updated",
            version: nextVersion,
            payload: updated,
            deviceId,
          });

          results.push({ entityId: user.id, success: true, version: nextVersion, record: updated });
        } else {
          results.push({ entityId, success: true, message: "Accepted" });
        }
      } catch (mutationErr: any) {
        results.push({ entityId, success: false, error: mutationErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (error: any) {
    console.error("[Sync POST Error]:", error);
    return NextResponse.json(
      { success: false, code: "SYNC_PUSH_FAILED", message: "فشل تطبيق التعديلات على الخادم" },
      { status: 500 }
    );
  }
}
