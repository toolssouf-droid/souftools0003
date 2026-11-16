// app/api/admin/efficiency/route.ts
/**
 * AI Efficiency Manager Admin API Route
 * Handles configuration reading/updating and analytics telemetry fetching
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getEfficiencyConfig,
  updateEfficiencyConfig,
  getEfficiencyAnalytics,
  clearResultCache,
  resetEfficiencyAnalytics,
  initEfficiencyStoreFromDb,
} from "@/lib/efficiency";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await initEfficiencyStoreFromDb();
    const config = getEfficiencyConfig();
    const analytics = getEfficiencyAnalytics();

    return NextResponse.json({
      success: true,
      config,
      analytics,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch efficiency data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const updated = updateEfficiencyConfig(body);
    const analytics = getEfficiencyAnalytics();

    return NextResponse.json({
      success: true,
      message: "تم تحديث إعدادات نظام إدارة الكفاءة بنجاح",
      config: updated,
      analytics,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update efficiency configuration" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "analytics") {
      resetEfficiencyAnalytics();
      return NextResponse.json({
        success: true,
        message: "تمت إعادة ضبط إحصائيات الاستهلاك بنجاح",
      });
    }

    const res = clearResultCache();
    return NextResponse.json({
      success: true,
      message: `تم تفريغ الـ Result Cache بنجاح (${res.count} عنصر)`,
      clearedCount: res.count,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to clear cache" },
      { status: 500 }
    );
  }
}
