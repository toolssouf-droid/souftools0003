/**
 * SoufTools Admin Analytics - Export API Route (CSV / JSON)
 */
import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analyticsService";
import { AnalyticsTimeRange } from "@/lib/analytics/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleName = searchParams.get("module") || "overview";
    const format = (searchParams.get("format") || "json") as "csv" | "json";
    const range = (searchParams.get("range") || "7d") as AnalyticsTimeRange;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const exportResult = await AnalyticsService.exportReport(moduleName, format, {
      range,
      startDate,
      endDate,
    });

    return new NextResponse(exportResult.data, {
      status: 200,
      headers: {
        "Content-Type": exportResult.mimeType,
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to export report" },
      { status: 500 }
    );
  }
}
