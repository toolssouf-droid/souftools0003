// app/api/v1/models/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models/modelRegistry";
import { modelService } from "@/lib/models/modelService";

/**
 * GET /api/v1/models/:id
 * Returns overview, specifications, and live summary for a specific model
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
        {
          success: false,
          error: "Model not found",
          message: `Model with id '${id}' is not registered in SoufTools registry`,
        },
        { status: 404 }
      );
    }

    // Fetch brief performance snapshot and tools readiness
    const [performance, toolsStatus, recentActivity] = await Promise.all([
      modelService.getPerformance(id, "30d"),
      modelService.getToolsStatus(id),
      modelService.getActivity(id, 5),
    ]);

    return NextResponse.json({
      success: true,
      model,
      summary: {
        performance,
        toolsStatus,
        recentActivity,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve model overview",
        message: error?.message,
      },
      { status: 500 }
    );
  }
}
