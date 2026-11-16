/**
 * SoufTools Media Progress API Route (/api/v1/media/progress)
 * Persists and retrieves user playback position in PostgreSQL.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuthUser } from "@/lib/auth/serverAuth";
import { WatchHistoryRepository } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const authUser = await resolveAuthUser(req);
    const mediaId = req.nextUrl.searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json({ error: "معرف الوسائط مطلوب" }, { status: 400 });
    }

    const userId = authUser?.id || "guest_anonymous";
    const history = await WatchHistoryRepository.getProgress(userId, mediaId);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/media/progress:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await resolveAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const { mediaId, positionSeconds = 0, durationSeconds = 0, completed = false, metadata = {} } = body;

    if (!mediaId) {
      return NextResponse.json({ error: "معرف الوسائط مطلوب" }, { status: 400 });
    }

    const userId = authUser?.id || "guest_anonymous";
    const saved = await WatchHistoryRepository.saveProgress(
      userId,
      mediaId,
      positionSeconds,
      durationSeconds,
      completed,
      metadata
    );

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    console.error("Error in POST /api/v1/media/progress:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
