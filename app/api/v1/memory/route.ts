/**
 * SoufTools Cloud Memory API v1
 * Server-Authoritative Long-Term AI Memory & Personalization Endpoint (PostgreSQL)
 */

import { NextRequest, NextResponse } from "next/server";
import { MemoryRepository } from "@/lib/db";
import { SoufToolsMemoryEngine } from "@/lib/memory/memoryEngine";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || undefined;
    const query = url.searchParams.get("query") || undefined;
    const projectId = url.searchParams.get("projectId") || undefined;
    const status = url.searchParams.get("status") || "active";
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;

    const memories = await MemoryRepository.listByUser(user.id, {
      type,
      query,
      projectId,
      status,
      limit,
    });
    const settings = await MemoryRepository.getSettings(user.id);
    const profile = await SoufToolsMemoryEngine.getUserProfileKnowledge(user.id);
    const stats = await MemoryRepository.getStats(user.id);

    return NextResponse.json({
      success: true,
      memories,
      settings,
      profile,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل استرجاع الذاكرة السحابية", error: err.message },
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
    const { memory, item, action, settings } = body;

    // Settings update shortcut
    if (settings) {
      await MemoryRepository.saveSettings(user.id, settings);
      const updatedSettings = await MemoryRepository.getSettings(user.id);
      return NextResponse.json({ success: true, settings: updatedSettings });
    }

    const payload = memory || item;
    if (!payload || !payload.content) {
      return NextResponse.json({ code: "BAD_REQUEST", message: "محتوى الذاكرة مطلوب" }, { status: 400 });
    }

    const result = await SoufToolsMemoryEngine.storeOrDeduplicateMemory(user.id, {
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

    const profile = await SoufToolsMemoryEngine.getUserProfileKnowledge(user.id);
    const stats = await MemoryRepository.getStats(user.id);

    return NextResponse.json({
      success: true,
      action: result.action,
      memory: result.memory,
      profile,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل حفظ عنصر الذاكرة في السيرفر", error: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { memoryId, id, updates, settings } = body;
    const targetId = memoryId || id;

    if (settings) {
      await MemoryRepository.saveSettings(user.id, settings);
    }

    if (targetId && updates) {
      await MemoryRepository.updateMemory(user.id, targetId, updates);
    }

    const profile = await SoufToolsMemoryEngine.getUserProfileKnowledge(user.id);
    const stats = await MemoryRepository.getStats(user.id);
    const updatedSettings = await MemoryRepository.getSettings(user.id);

    return NextResponse.json({
      success: true,
      profile,
      stats,
      settings: updatedSettings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل تحديث الذاكرة", error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const url = new URL(req.url);
  const memoryId = url.searchParams.get("id") || url.searchParams.get("memoryId");
  const clearAll = url.searchParams.get("clearAll") === "true";

  try {
    if (clearAll) {
      await MemoryRepository.clearAll(user.id);
      return NextResponse.json({ success: true, message: "تم مسح كافة عناصر الذاكرة من السيرفر" });
    }

    if (memoryId) {
      await MemoryRepository.deleteMemory(user.id, memoryId);
      return NextResponse.json({ success: true, message: "تم حذف عنصر الذاكرة بنجاح" });
    }

    return NextResponse.json({ code: "BAD_REQUEST", message: "معرف العنصر مطلوب" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل حذف الذاكرة", error: err.message },
      { status: 500 }
    );
  }
}
