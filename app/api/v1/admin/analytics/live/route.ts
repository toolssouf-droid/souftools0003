/**
 * SoufTools Admin Analytics - Live Real-Time Pulse API Route
 */
import { NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analyticsService";

export async function GET() {
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
