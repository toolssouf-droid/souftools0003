// app/api/v1/models/[id]/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models/modelRegistry";
import { modelService } from "@/lib/models/modelService";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

/**
 * GET /api/v1/models/:id/activity?limit=20
 * Returns safe activity log items. No Chain-of-Thought or sensitive tokens exposed.
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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const authUser = await resolveAuthUser(req);
    const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";
    const userId = authUser?.id || undefined;

    const activities = await modelService.getActivity(id, limit, userId, isAdmin);

    return NextResponse.json({
      success: true,
      model_id: id,
      count: activities.length,
      activities,
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models/[id]/activity:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
