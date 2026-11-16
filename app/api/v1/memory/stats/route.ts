/**
 * SoufTools Memory Engine - User Memory Statistics API
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
    const stats = await MemoryRepository.getStats(user.id);
    const profile = await SoufToolsMemoryEngine.getUserProfileKnowledge(user.id);
    const settings = await MemoryRepository.getSettings(user.id);

    return NextResponse.json({
      success: true,
      stats,
      profile,
      settings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل استرجاع إحصائيات الذاكرة", error: err.message },
      { status: 500 }
    );
  }
}
