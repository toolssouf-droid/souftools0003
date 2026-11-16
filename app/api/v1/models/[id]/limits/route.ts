// app/api/v1/models/[id]/limits/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models/modelRegistry";

/**
 * GET /api/v1/models/:id/limits
 * Returns real platform limits: context window, rate limits (RPM, TPM, RPD),
 * tool concurrency limits, and agent execution boundaries.
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

    return NextResponse.json({
      success: true,
      model_id: model.model_id,
      display_name: model.display_name,
      limits: model.limits,
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models/[id]/limits:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
