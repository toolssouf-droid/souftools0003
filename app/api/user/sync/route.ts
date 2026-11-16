/**
 * SoufTools User Sync API Route
 * Synchronizes sessions, long-term memories, and preferences directly with the
 * Turso Database Repository Layer using verified authenticated identity.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ConversationRepository,
  MemoryRepository,
  BehaviorRepository,
} from "@/lib/db";
import { ChatSession } from "@/store/chatStore";
import { SoufAIMemory } from "@/lib/memory/types";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { requireAuth } from "@/lib/auth/serverAuth";

/**
 * GET /api/user/sync
 * Retrieves all stored sessions, memories, and preferences from Turso Repositories
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const authUser = authResult.user;
  const userKey = authUser.id;

  try {
    const [rawSessions, rawMemories, behaviorProfile] = await Promise.all([
      ConversationRepository.listByUser(userKey),
      MemoryRepository.listByUser(userKey),
      BehaviorRepository.getProfile(userKey),
    ]);

    const telegramSessions = telegramManager.getTelegramSessions(userKey, authUser.email);

    const sessionMap = new Map<string, ChatSession>();
    (rawSessions || []).forEach((s: any) => {
      sessionMap.set(s.id, {
        id: s.id,
        title: s.title,
        modelId: s.modelId || "soufai-spark",
        source: s.source || (s.id.startsWith("tg_") ? "telegram" : "web"),
        channel: s.channel || (s.id.startsWith("tg_") ? "telegram" : "web"),
        isTelegram: s.isTelegram ?? s.id.startsWith("tg_"),
        telegramChatId: s.telegramChatId,
        telegramUsername: s.telegramUsername,
        telegramSender: s.telegramSender,
        createdAt: typeof s.createdAt === "number" ? s.createdAt : new Date(s.createdAt).getTime(),
        updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : new Date(s.updatedAt).getTime(),
        messages: (s.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role || (m.sender === "user" ? "user" : "model"),
          sender: m.sender || (m.role === "user" ? "user" : "assistant"),
          content: m.content || "",
          reasoning: m.reasoning || null,
          sources: m.sources || [],
          toolCalls: m.toolCalls || [],
          attachments: m.attachments || [],
          modelUsed: m.modelUsed || s.modelId,
          timestamp: m.timestamp || (m.createdAt ? new Date(m.createdAt).getTime() : Date.now()),
        })),
      });
    });

    (telegramSessions || []).forEach((tg: any) => {
      sessionMap.set(tg.id, {
        id: tg.id,
        title: tg.title,
        modelId: (tg.modelId || "spark") as any,
        source: "telegram",
        channel: "telegram",
        isTelegram: true,
        telegramChatId: tg.chatId,
        telegramUsername: tg.username,
        telegramSender: tg.senderName,
        createdAt: tg.createdAt,
        updatedAt: tg.updatedAt,
        messages: (tg.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          sender: m.sender,
          content: m.content,
          reasoning: null,
          sources: [],
          toolCalls: [],
          attachments: [],
          modelUsed: tg.modelId || "spark",
          timestamp: m.timestamp,
        })),
      });
    });

    const sessions: ChatSession[] = Array.from(sessionMap.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );

    const memories: SoufAIMemory[] = (rawMemories || []).map((m: any) => ({
      id: m.id,
      userId: m.userId || userKey,
      type: m.type || "project",
      content: m.content,
      importance: m.importance ?? 0.8,
      confidence: m.confidence ?? 1.0,
      source: m.source || "user",
      status: m.status || "active",
      version: m.version || 1,
      projectId: m.projectId,
      projectName: m.projectName,
      enabled: m.enabled ?? true,
      createdAt: typeof m.createdAt === "number" ? m.createdAt : new Date(m.createdAt).getTime(),
      updatedAt: typeof m.updatedAt === "number" ? m.updatedAt : new Date(m.updatedAt).getTime(),
    }));

    return NextResponse.json({
      success: true,
      userKey,
      sessions,
      memories,
      settings: behaviorProfile?.preferences || {},
      schedules: [],
      source: "server_durable_repository",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load cloud state" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/sync
 * Upserts sessions, memories, and settings into Turso
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userKey = authResult.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const { sessions, memories, settings, replaceAll } = body;

    let savedSessionsCount = 0;
    let savedMemoriesCount = 0;

    if (Array.isArray(sessions) && sessions.length > 0) {
      for (const sess of sessions) {
        if (!sess || !sess.id) continue;
        await ConversationRepository.saveConversation(userKey, {
          id: sess.id,
          title: sess.title || "محادثة جديدة",
          modelId: sess.modelId || "soufai-spark",
          createdAt: sess.createdAt,
          updatedAt: sess.updatedAt || Date.now(),
          messages: sess.messages || [],
        });
        savedSessionsCount++;

        recordSyncEvent({
          userId: userKey,
          entityType: "conversation",
          entityId: sess.id,
          operation: "updated",
          payload: {
            id: sess.id,
            title: sess.title,
            modelId: sess.modelId,
            createdAt: sess.createdAt,
            updatedAt: sess.updatedAt || Date.now(),
            messages: sess.messages || [],
          },
        }).catch(() => null);
      }
    }

    if (Array.isArray(memories) && memories.length > 0) {
      if (replaceAll) {
        await MemoryRepository.clearAll(userKey);
      }
      for (const mem of memories) {
        if (!mem || !mem.content) continue;
        await MemoryRepository.saveMemory(userKey, mem);
        savedMemoriesCount++;
      }
    }

    if (settings && typeof settings === "object") {
      const existingProfile: any = (await BehaviorRepository.getProfile(userKey)) || {};
      await BehaviorRepository.saveProfile(userKey, {
        ...existingProfile,
        preferences: {
          ...(existingProfile.preferences || {}),
          ...settings,
        },
      });
    }

    return NextResponse.json({
      success: true,
      userKey,
      savedSessions: savedSessionsCount,
      savedMemories: savedMemoriesCount,
      syncedAt: Date.now(),
      target: "server_durable_repository",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to persist sync data" },
      { status: 500 }
    );
  }
}
