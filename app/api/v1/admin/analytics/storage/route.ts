/**
 * SoufTools Admin Analytics - Storage API Route
 */
import { NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analyticsService";

export async function GET() {
  try {
    const data = await AnalyticsService.getStorage();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load storage analytics" },
      { status: 500 }
    );
  }
}
