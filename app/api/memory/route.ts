/**
 * SoufTools Memory API (Legacy Route Adapter)
 * Delegates all memory persistence strictly to Turso via MemoryRepository & SoufToolsMemoryEngine.
 */

import { NextRequest, NextResponse } from "next/server";
import { MemoryRepository } from "@/lib/db";
import { SoufToolsMemoryEngine } from "@/lib/memory/memoryEngine";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const memories = await MemoryRepository.listByUser(userId, { status: "active" });
    const settings = await MemoryRepository.getSettings(userId);
    const userProfile = await SoufToolsMemoryEngine.getUserProfileKnowledge(userId);
    const stats = await MemoryRepository.getStats(userId);

    return NextResponse.json({ memories, settings, userProfile, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch memories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const { memory, item, action } = body;
    const payload = memory || item;

    if (action === "prune") {
      const memories = await MemoryRepository.listByUser(userId, { status: "active" });
      return NextResponse.json({ success: true, count: memories.length });
    }

    if (!payload || !payload.content) {
      return NextResponse.json({ error: "memory object required" }, { status: 400 });
    }

    const result = await SoufToolsMemoryEngine.storeOrDeduplicateMemory(userId, {
      type: payload.type || "USER_FACT",
      content: payload.content,
      projectId: payload.projectId,
      projectName: payload.projectName,
      userName: payload.userName,
      importance: payload.importance,
      confidence: payload.confidence,
      source: payload.source || "user",
      tags: payload.tags,
      category: payload.category,
    });

    const userProfile = await SoufToolsMemoryEngine.getUserProfileKnowledge(userId);
    return NextResponse.json({ success: true, memory: result.memory, userProfile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save memory" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const { memoryId, updates, settings } = body;

    if (settings) {
      await MemoryRepository.saveSettings(userId, settings);
    }

    if (memoryId && updates) {
      await MemoryRepository.updateMemory(userId, memoryId, updates);
    }

    const userProfile = await SoufToolsMemoryEngine.getUserProfileKnowledge(userId);
    return NextResponse.json({ success: true, userProfile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update memory" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const { searchParams } = new URL(req.url);
    const memoryId = searchParams.get("memoryId") || searchParams.get("id");
    const clearAll = searchParams.get("clearAll") === "true";

    if (clearAll) {
      await MemoryRepository.clearAll(userId);
      return NextResponse.json({ success: true, clearedAll: true });
    }

    if (!memoryId) {
      return NextResponse.json({ error: "memoryId or clearAll required" }, { status: 400 });
    }

    await MemoryRepository.deleteMemory(userId, memoryId);
    return NextResponse.json({ success: true, deletedId: memoryId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete memory" }, { status: 500 });
  }
}
