// app/api/v1/models/[id]/capabilities/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models/modelRegistry";

/**
 * GET /api/v1/models/:id/capabilities
 * Returns full capabilities breakdown and benchmark specifications
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
      provider: model.provider,
      version: model.version,
      status: model.status,
      capabilities: model.capabilities,
      features: model.features,
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models/[id]/capabilities:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
