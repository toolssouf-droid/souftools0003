/**
 * /api/v1/notifications
 * 
 * GET: Lists notifications with unread count.
 * PATCH: Marks specific or all notifications as read.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { toIsoDateString, safeToIsoDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "30", 10), 1), 100);

    const rows = await database
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const unreadCount = await database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .then((r) => r[0]?.count || 0);

    return NextResponse.json({
      success: true,
      notifications: rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        metadata: n.metadata,
        createdAt: toIsoDateString(n.createdAt),
        readAt: safeToIsoDate(n.readAt),
      })),
      unreadCount,
    });
  } catch (error: any) {
    console.error("[Notifications GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "NOTIFICATIONS_FETCH_ERROR", message: "فشل استرداد الإشعارات" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();
    const body = await req.json().catch(() => ({}));
    const deviceId = req.headers.get("x-device-id");
    const { notificationId, markAllRead } = body;

    const now = new Date();

    if (markAllRead) {
      await database
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

      await recordSyncEvent({
        userId: user.id,
        entityType: "notification",
        entityId: "all",
        operation: "updated",
        payload: { action: "mark_all_read" },
        deviceId,
      });

      return NextResponse.json({
        success: true,
        message: "تم تعيين جميع الإشعارات كمقروءة",
      });
    }

    if (notificationId) {
      await database
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)));

      await recordSyncEvent({
        userId: user.id,
        entityType: "notification",
        entityId: notificationId,
        operation: "updated",
        payload: { id: notificationId, isRead: true },
        deviceId,
      });

      return NextResponse.json({
        success: true,
        message: "تم تعيين الإشعار كمقروء",
      });
    }

    return NextResponse.json(
      { success: false, code: "BAD_REQUEST", message: "حدد notificationId أو markAllRead" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Notifications PATCH Error]:", error);
    return NextResponse.json(
      { success: false, code: "NOTIFICATION_UPDATE_ERROR", message: "فشل تحديث الإشعار" },
      { status: 500 }
    );
  }
}
