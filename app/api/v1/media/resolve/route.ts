/**
 * SoufTools Media Resolver API Route (/api/v1/media/resolve)
 * Resolves media URLs into structured playback info with SSRF protection,
 * checks watch progress history, and returns valid typed response.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuthUser } from "@/lib/auth/serverAuth";
import { MediaResolver } from "@/lib/media/mediaResolver";
import { WatchHistoryRepository } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const authUser = await resolveAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const { url, title, positionSeconds, subtitlesUrl, subtitleLanguage, posterUrl } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "الرجاء توفير رابط وسائط صالح (url)" },
        { status: 400 }
      );
    }

    const resolveResult = await MediaResolver.resolveMedia({
      url,
      title,
      initialPositionSeconds: positionSeconds,
      subtitlesUrl,
      subtitleLanguage,
      posterUrl,
    });

    if (!resolveResult.success || !resolveResult.data) {
      return NextResponse.json(
        { error: resolveResult.error || "تعذر معالجة رابط الوسائط" },
        { status: 400 }
      );
    }

    const playbackData = resolveResult.data;

    // Check if user has watch history to offer resume
    if (authUser?.id) {
      try {
        const history = await WatchHistoryRepository.getProgress(authUser.id, playbackData.mediaId);
        if (history && history.positionSeconds > 0 && !history.completed) {
          playbackData.initialPositionSeconds = history.positionSeconds;
          playbackData.metadata = {
            ...playbackData.metadata,
            hasPreviousProgress: true,
            savedPosition: history.positionSeconds,
            duration: history.durationSeconds,
          };
        }
      } catch (err) {
        console.warn("Error fetching watch history for resume:", err);
      }
    }

    return NextResponse.json({
      success: true,
      data: playbackData,
    });
  } catch (error: any) {
    console.error("Error in /api/v1/media/resolve:", error);
    return NextResponse.json(
      { error: error?.message || "حدث خطأ أثناء معالجة الوسائط" },
      { status: 500 }
    );
  }
}
