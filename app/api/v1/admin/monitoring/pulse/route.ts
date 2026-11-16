/**
 * SoufTools Admin Live Monitoring & Watchdog API
 * Telemetry endpoint for Server Vitals, PostgreSQL Connection Pool, and Query Latencies.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { getLivePulseSnapshot, getPulseHistory } from "@/lib/monitoring/watchdog";
import { resetQueryProfiler } from "@/lib/monitoring/queryProfiler";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const pulse = await getLivePulseSnapshot();
    const history = getPulseHistory();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      pulse,
      history,
    });
  } catch (error: any) {
    console.error("[Watchdog API GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "فشل استرجاع بيانات نبض السيرفر وقاعدة البيانات",
        message: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "RESET_PROFILER") {
      resetQueryProfiler();
      return NextResponse.json({
        success: true,
        message: "تمت إعادة ضبط سجل استعلامات قاعدة البيانات بنجاح",
      });
    }

    if (action === "TRIGGER_SNAPSHOT") {
      const pulse = await getLivePulseSnapshot();
      return NextResponse.json({
        success: true,
        message: "تم أخذ لقطة فورية لنبض السيرفر وقاعدة البيانات",
        pulse,
      });
    }

    return NextResponse.json(
      { success: false, error: "إجراء غير معروف" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
