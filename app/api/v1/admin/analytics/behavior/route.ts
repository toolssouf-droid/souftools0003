/**
 * SoufTools Admin Analytics - Product & Behavior API Route
 */
import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analyticsService";
import { AnalyticsTimeRange } from "@/lib/analytics/types";
import { requireAnalyticsAdmin } from "@/lib/analytics/analyticsAuth";

export async function GET(req: NextRequest) {
  const authorization = await requireAnalyticsAdmin(req);
  if (authorization.response) return authorization.response;
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "7d") as AnalyticsTimeRange;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const data = await AnalyticsService.getBehavior({ range, startDate, endDate });
    return NextResponse.json({ success: true, range, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load behavior analytics" },
      { status: 500 }
    );
  }
}
