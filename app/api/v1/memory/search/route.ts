/**
 * SoufTools Memory Engine - Search & Retrieval API
 */

import { NextRequest, NextResponse } from "next/server";
import { SoufToolsMemoryEngine } from "@/lib/memory/memoryEngine";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { query, projectId, limit = 8 } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ code: "BAD_REQUEST", message: "استعلام البحث مطلوب" }, { status: 400 });
    }

    const relevant = await SoufToolsMemoryEngine.retrieveRelevantMemories(
      user.id,
      query,
      limit,
      projectId
    );

    return NextResponse.json({
      success: true,
      query,
      resultsCount: relevant.length,
      memories: relevant,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل البحث في الذاكرة", error: err.message },
      { status: 500 }
    );
  }
}
