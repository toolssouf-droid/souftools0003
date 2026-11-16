/**
 * SoufTools Archive.org Media Resolver API Endpoint
 * Handles official search and direct item resolution for Archive.org video and audio.
 */

import { NextRequest, NextResponse } from "next/server";
import { ArchiveOrgProvider } from "@/lib/media/providers/archiveOrgProvider";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "resolve";
    const query = searchParams.get("q") || "";
    const identifier = searchParams.get("id") || "";
    const mediaType = (searchParams.get("type") as "movies" | "audio" | "all") || "movies";
    const startTime = parseFloat(searchParams.get("t") || "0");

    if (action === "search") {
      if (!query.trim()) {
        return NextResponse.json({ success: false, error: "Missing search query parameter 'q'" }, { status: 400 });
      }
      const searchRes = await ArchiveOrgProvider.search(query, { mediaType, limit: 12 });
      return NextResponse.json(searchRes);
    }

    if (action === "resolve") {
      const targetId = identifier || query;
      if (!targetId.trim()) {
        return NextResponse.json({ success: false, error: "Missing 'id' or 'q' parameter for resolution" }, { status: 400 });
      }
      const playbackRes = await ArchiveOrgProvider.resolveItemToPlayback(targetId, {
        initialPositionSeconds: isNaN(startTime) ? 0 : startTime,
      });
      if (playbackRes.success && playbackRes.data) {
        return NextResponse.json({
          success: true,
          data: playbackRes.data,
          payload: playbackRes.data,
        });
      }
      return NextResponse.json(playbackRes);
    }

    if (action === "search_and_resolve") {
      if (!query.trim()) {
        return NextResponse.json({ success: false, error: "Missing search query parameter 'q'" }, { status: 400 });
      }
      const autoRes = await ArchiveOrgProvider.searchAndResolveFirst(query, {
        mediaType,
        initialPositionSeconds: isNaN(startTime) ? 0 : startTime,
      });
      if (autoRes.success && autoRes.data) {
        return NextResponse.json({
          success: true,
          data: autoRes.data,
          payload: autoRes.data,
        });
      }
      return NextResponse.json(autoRes);
    }

    return NextResponse.json({ success: false, error: `Unsupported action '${action}'` }, { status: 400 });
  } catch (error: any) {
    console.error("[API /api/v1/media/archive-org] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error resolving Archive.org media",
      },
      { status: 500 }
    );
  }
}
