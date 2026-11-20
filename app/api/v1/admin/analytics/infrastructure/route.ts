/**
 * SoufTools Admin Analytics - Infrastructure & Health API Route
 */
import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analyticsService";
import { requireAnalyticsAdmin } from "@/lib/analytics/analyticsAuth";

export async function GET(req: NextRequest) {
  const authorization = await requireAnalyticsAdmin(req);
  if (authorization.response) return authorization.response;
  try {
    const data = await AnalyticsService.getInfrastructure();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load infrastructure analytics" },
      { status: 500 }
    );
  }
}
