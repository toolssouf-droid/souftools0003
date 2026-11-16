/**
 * SoufAI Global Runtime Logs API
 * GET /api/v1/runtime/logs - Retrieve latest system & sandbox execution logs (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { SettingsRepository } from "@/lib/db";
import { RuntimeLogItem } from "@/lib/runtime/types";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "60", 10);

    const allLogs = (await SettingsRepository.getSetting<RuntimeLogItem[]>("runtime_logs")) || [];
    const logs = Array.isArray(allLogs) ? allLogs.slice(0, Math.min(limit, 250)) : [];

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (err: any) {
    console.error("[Runtime Logs GET] Error:", err);
    return NextResponse.json({
      success: true,
      logs: [],
    });
  }
}
