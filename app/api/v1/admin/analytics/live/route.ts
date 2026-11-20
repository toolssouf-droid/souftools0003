/**
 * SoufTools Admin Analytics - Live Real-Time Pulse API Route
 */
import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analyticsService";
import { requireAnalyticsAdmin } from "@/lib/analytics/analyticsAuth";

export async function GET(req: NextRequest) {
  const authorization = await requireAnalyticsAdmin(req);
  if (authorization.response) return authorization.response;
  try {
    const pulse = AnalyticsService.getLivePulse();
    return NextResponse.json({ success: true, pulse });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load live pulse" },
      { status: 500 }
    );
  }
}
