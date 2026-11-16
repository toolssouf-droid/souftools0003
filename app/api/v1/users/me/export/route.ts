/**
 * POST /api/v1/users/me/export
 * 
 * Exports all user data stored in Turso into a single structured JSON file:
 * - Profile & Quota info
 * - Conversations & full Message history
 * - Memories & Behavior profile
 * - Projects & metadata
 * - Preferences & Settings
 * - Active & Historic Devices
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import {
  users,
  conversations,
  messages,
  projects,
  memories,
  userPreferences,
  userDevices,
  notifications,
} from "@/lib/db/schema";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { toIsoDateString, safeToIsoDate } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;

    const db = await getReadyDb();

    // 1. Fetch user profile
    const profile = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((r) => r[0]);

    // 2. Fetch preferences
    const preferences = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
      .then((r) => r[0]);

    // 3. Fetch all conversations
    const userConvs = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.createdAt));

    // 4. Fetch messages scoped strictly to user's conversations in SQLite-safe chunks
    const convIds = userConvs.map((c) => c.id);
    let allMessages: any[] = [];
    for (let i = 0; i < convIds.length; i += 200) {
      const chunk = convIds.slice(i, i + 200);
      const rows = await db
        .select()
        .from(messages)
        .where(inArray(messages.conversationId, chunk))
        .orderBy(asc(messages.createdAt));
      allMessages.push(...rows);
    }

    // 5. Fetch memories
    const userMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id))
      .orderBy(desc(memories.createdAt));

    // 6. Fetch projects
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.createdAt));

    // 7. Fetch devices
    const devices = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, user.id));

    // 8. Fetch notifications
    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt));

    // Assemble export package
    const exportData = {
      exportMetadata: {
        platform: "SoufTools Enterprise",
        exportedAt: new Date().toISOString(),
        formatVersion: "1.0.0",
        userEmail: user.email,
        userId: user.id,
      },
      user: {
        id: profile?.id || user.id,
        name: profile?.name || user.name,
        email: profile?.email || user.email,
        role: profile?.role || user.role,
        createdAt: safeToIsoDate(profile?.createdAt),
      },
      preferences: preferences || null,
      conversations: userConvs.map((conv) => ({
        ...conv,
        createdAt: toIsoDateString(conv.createdAt),
        updatedAt: toIsoDateString(conv.updatedAt),
        messages: allMessages
          .filter((m) => m.conversationId === conv.id)
          .map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            reasoning: m.reasoning,
            sources: m.sources,
            toolCalls: m.toolCalls,
            createdAt: toIsoDateString(m.createdAt),
          })),
      })),
      memories: userMemories.map((m) => ({
        ...m,
        createdAt: toIsoDateString(m.createdAt),
        updatedAt: toIsoDateString(m.updatedAt),
      })),
      projects: userProjects.map((p) => ({
        ...p,
        createdAt: toIsoDateString(p.createdAt),
        updatedAt: toIsoDateString(p.updatedAt),
      })),
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        status: d.status,
        lastSeenAt: toIsoDateString(d.lastSeenAt),
      })),
      notifications: notifs.map((n) => ({
        ...n,
        createdAt: toIsoDateString(n.createdAt),
        readAt: safeToIsoDate(n.readAt),
      })),
    };

    return NextResponse.json({
      success: true,
      exportData,
    });
  } catch (error: any) {
    console.error("[User Export Error]:", error);
    return NextResponse.json(
      { success: false, code: "EXPORT_ERROR", message: "فشل تصدير بيانات الحساب" },
      { status: 500 }
    );
  }
}
