/**
 * GET /api/v1/sync/bootstrap
 * 
 * Initial Bootstrap API Endpoint:
 * Fetches the entire initial user state directly from Turso:
 * - User Profile & Storage quotas
 * - User Preferences & Custom settings
 * - Active Sessions & Registered Devices
 * - Recent Conversations & Message summaries
 * - Active Projects & Memories
 * - Unread Notifications count & recent alerts
 * - Current Sync Cursor and Server Revision
 * 
 * Strict rule: The SERVER is the Source of Truth. No persistent browser storage required.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb, UserRepository } from "@/lib/db";
import {
  users,
  userPreferences,
  userDevices,
  conversations,
  messages,
  projects,
  memories,
  notifications,
  syncEvents,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { updateDeviceCursor } from "@/lib/sync/syncEngine";
import { toIsoDateString, safeToIsoDate } from "@/lib/utils";
import { extractClientIp, parseDeviceDetails } from "@/lib/auth/deviceParser";
import { telegramManager } from "@/lib/telegram/telegramManager";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const deviceId = req.headers.get("x-device-id") || req.nextUrl.searchParams.get("deviceId");
    const now = new Date();
    const db = await getReadyDb();

    // Ensure user record exists before FK-dependent inserts (preferences/devices)
    await UserRepository.upsertUser({
      id: user.id,
      email: user.email,
      displayName: user.name || undefined,
    });

    // 1. Fetch User Record
    const dbUser = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((r) => r[0]);

    // 2. Fetch or initialize User Preferences safely with race condition handling
    let pref = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
      .then((r) => r[0]);

    if (!pref) {
      pref = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.id, `pref_${user.id}`))
        .limit(1)
        .then((r) => r[0]);
    }

    if (!pref) {
      try {
        const [newPref] = await db
          .insert(userPreferences)
          .values({
            id: `pref_${user.id}`,
            userId: user.id,
            theme: "dark",
            locale: "ar",
            defaultModelId: "spark",
            soundEnabled: true,
            autoScroll: true,
            webSearchEnabled: false,
            version: 1,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: userPreferences.id,
            set: {
              userId: user.id,
              updatedAt: now,
            },
          })
          .returning();
        pref = newPref;
      } catch (insertErr) {
        console.warn("[Sync Bootstrap] userPreferences upsert conflict handled gracefully:", insertErr);
        pref = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, user.id))
          .limit(1)
          .then((r) => r[0]);
        if (!pref) {
          pref = await db
            .select()
            .from(userPreferences)
            .where(eq(userPreferences.id, `pref_${user.id}`))
            .limit(1)
            .then((r) => r[0]);
        }
      }
    }

    // Bulletproof fallback object to ensure bootstrap never crashes if DB is recovering
    if (!pref) {
      pref = {
        id: `pref_${user.id}`,
        userId: user.id,
        theme: "dark",
        locale: "ar",
        defaultModelId: "spark",
        soundEnabled: true,
        autoScroll: true,
        webSearchEnabled: false,
        customSettings: {},
        version: 1,
        updatedAt: now,
      } as any;
    }

    // 3. Register or update current device if deviceId provided
    if (deviceId) {
      const userAgent = req.headers.get("user-agent") || "Unknown Device";
      const ip = extractClientIp(req.headers);
      const parsed = parseDeviceDetails(userAgent, ip);

      try {
        const existingDevice = await db
          .select()
          .from(userDevices)
          .where(and(eq(userDevices.userId, user.id), eq(userDevices.id, deviceId)))
          .limit(1)
          .then((r) => r[0]);

        if (existingDevice) {
          await db
            .update(userDevices)
            .set({
              name: parsed.name || existingDevice.name,
              deviceType: parsed.deviceType || existingDevice.deviceType,
              browser: parsed.browser || existingDevice.browser,
              os: parsed.os || existingDevice.os,
              lastSeenAt: now,
              ipAddress: ip,
              status: "active",
              updatedAt: now,
            })
            .where(eq(userDevices.id, existingDevice.id));
        } else {
          await db
            .insert(userDevices)
            .values({
              id: deviceId,
              userId: user.id,
              name: parsed.name,
              deviceType: parsed.deviceType,
              browser: parsed.browser,
              os: parsed.os,
              ipAddress: ip,
              status: "active",
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: userDevices.id,
              set: {
                userId: user.id,
                name: parsed.name,
                deviceType: parsed.deviceType,
                browser: parsed.browser,
                os: parsed.os,
                ipAddress: ip,
                status: "active",
                lastSeenAt: now,
                updatedAt: now,
              },
            });
        }
      } catch (devErr) {
        console.warn("[Sync Bootstrap] device upsert handled gracefully:", devErr);
      }

      await updateDeviceCursor(user.id, deviceId, now).catch(() => {});
    }

    // 4. Fetch Active Devices
    const activeDevices = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.userId, user.id), eq(userDevices.status, "active")))
      .orderBy(desc(userDevices.lastSeenAt))
      .limit(10);

    // 5. Fetch Recent Conversations
    const userConvs = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(30);

    // 6. Fetch Messages for the most recent conversation (if any)
    let initialMessages: any[] = [];
    if (userConvs.length > 0) {
      const latestConvId = userConvs[0].id;
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, latestConvId))
        .orderBy(asc(messages.createdAt))
        .limit(60);

      initialMessages = msgs.map((m) => ({
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
      }));
    }

    // 7. Fetch Active Projects
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.updatedAt))
      .limit(20);

    // 8. Fetch Memories
    const userMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id))
      .orderBy(desc(memories.updatedAt))
      .limit(20);

    // 9. Fetch Notifications and unread count
    const recentNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(15);

    const unreadCount = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .then((r) => r[0]?.count || 0);

    // 10. Fetch latest sync event timestamp to serve as cursor
    const latestEvent = await db
      .select({ createdAt: syncEvents.createdAt })
      .from(syncEvents)
      .where(eq(syncEvents.userId, user.id))
      .orderBy(desc(syncEvents.createdAt))
      .limit(1)
      .then((r) => r[0]);

    const syncCursor = latestEvent ? toIsoDateString(latestEvent.createdAt) : toIsoDateString(now);
    const serverRevision = Date.now();

    await telegramManager.ensureInitialized();

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: dbUser?.name || user.name,
          role: user.role,
          storageUsedBytes: dbUser?.storageUsedBytes || user.storageUsedBytes,
          storageLimitBytes: dbUser?.storageLimitBytes || user.storageLimitBytes,
          createdAt: safeToIsoDate(dbUser?.createdAt),
        },
        preferences: {
          theme: pref.theme,
          locale: pref.locale,
          defaultModelId: pref.defaultModelId,
          soundEnabled: pref.soundEnabled,
          autoScroll: pref.autoScroll,
          webSearchEnabled: pref.webSearchEnabled,
          customSettings: pref.customSettings || {},
          version: pref.version,
          updatedAt: toIsoDateString(pref.updatedAt),
        },
        devices: activeDevices.map((d) => ({
          id: d.id,
          name: d.name,
          deviceType: d.deviceType,
          browser: d.browser,
          os: d.os,
          ipAddress: d.ipAddress,
          status: d.status,
          isCurrent: d.id === deviceId,
          lastSeenAt: toIsoDateString(d.lastSeenAt),
        })),
        conversations: (() => {
          const convMap = new Map<string, any>();
          userConvs.forEach((c) => {
            convMap.set(c.id, {
              id: c.id,
              title: c.title,
              modelId: c.modelId,
              isPinned: c.isPinned,
              isArchived: c.isArchived,
              source: c.id.startsWith("tg_") ? "telegram" : "web",
              channel: c.id.startsWith("tg_") ? "telegram" : "web",
              isTelegram: c.id.startsWith("tg_"),
              version: c.version,
              metadata: c.metadata,
              createdAt: toIsoDateString(c.createdAt),
              updatedAt: toIsoDateString(c.updatedAt),
            });
          });
          const tgSessions = telegramManager.getTelegramSessions(user.id, user.email);
          tgSessions.forEach((tg) => {
            convMap.set(tg.id, {
              id: tg.id,
              title: tg.title,
              modelId: tg.modelId || "spark",
              isPinned: false,
              isArchived: false,
              source: "telegram",
              channel: "telegram",
              isTelegram: true,
              version: 1,
              metadata: {
                chatId: tg.chatId,
                username: tg.username,
                senderName: tg.senderName,
              },
              createdAt: new Date(tg.createdAt).toISOString(),
              updatedAt: new Date(tg.updatedAt).toISOString(),
            });
          });
          return Array.from(convMap.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        })(),
        initialMessages,
        activeConversationId: userConvs.length > 0 ? userConvs[0].id : null,
        projects: userProjects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          framework: p.framework,
          version: p.version,
          createdAt: toIsoDateString(p.createdAt),
          updatedAt: toIsoDateString(p.updatedAt),
        })),
        memories: userMemories.map((m) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          importance: m.importance,
          projectId: m.projectId,
          createdAt: toIsoDateString(m.createdAt),
        })),
        notifications: {
          items: recentNotifications.map((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            isRead: n.isRead,
            metadata: n.metadata,
            createdAt: toIsoDateString(n.createdAt),
          })),
          unreadCount,
        },
        sync: {
          cursor: syncCursor,
          serverRevision,
          sourceOfTruth: "turso_server",
        },
      },
    });
  } catch (error: any) {
    console.error("[Sync Bootstrap Error]:", error);
    return NextResponse.json(
      { success: false, code: "BOOTSTRAP_FAILED", message: "فشل استرداد بيانات التهيئة من الخادم", error: error.message },
      { status: 500 }
    );
  }
}
