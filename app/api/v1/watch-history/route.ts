/**
 * SoufTools Watch History API Route (/api/v1/watch-history)
 * Lists or clears user watch history across sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { WatchHistoryRepository } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "60", 10);
    const history = await WatchHistoryRepository.listUserHistory(userId, limit);

    return NextResponse.json({
      success: true,
      data: history || [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/watch-history:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const mediaId = req.nextUrl.searchParams.get("mediaId");
    const clearAll = req.nextUrl.searchParams.get("clearAll") === "true";

    if (clearAll) {
      const userHistory = await WatchHistoryRepository.listUserHistory(userId, 100);
      for (const item of userHistory) {
        await WatchHistoryRepository.deleteHistory(userId, item.mediaId);
      }
      return NextResponse.json({
        success: true,
        message: "تم مسح سجل المشاهدة بالكامل",
      });
    }

    if (!mediaId) {
      return NextResponse.json({ error: "معرف الوسائط غير صالح" }, { status: 400 });
    }

    await WatchHistoryRepository.deleteHistory(userId, mediaId);

    return NextResponse.json({
      success: true,
      message: "تم حذف سجل المشاهدة بنجاح",
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/v1/watch-history:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
