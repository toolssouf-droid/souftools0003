// app/api/v1/models/[id]/performance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models/modelRegistry";
import { modelService } from "@/lib/models/modelService";

/**
 * GET /api/v1/models/:id/performance?range=today|7d|30d|90d
 * Returns real telemetry, latency percentiles, token throughput, and success rate
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const model = getModelById(id);

    if (!model) {
      return NextResponse.json(
        { success: false, error: "Model not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";

    const performance = await modelService.getPerformance(id, range);

    return NextResponse.json({
      success: true,
      performance,
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models/[id]/performance:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
