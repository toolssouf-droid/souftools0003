/**
 * SoufTools Admin Analytics - Infrastructure & Health API Route
 */
import { NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analyticsService";

export async function GET() {
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
