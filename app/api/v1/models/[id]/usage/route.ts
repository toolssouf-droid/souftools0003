// app/api/v1/models/[id]/usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models/modelRegistry";
import { modelService } from "@/lib/models/modelService";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

/**
 * GET /api/v1/models/:id/usage?range=today|7d|30d|90d
 * Strict RBAC: Standard users only receive their personal usage stats.
 * Admins receive platform-wide aggregate usage.
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

    // Authenticate user
    const authUser = await resolveAuthUser(req);
    const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";
    const userId = authUser?.id || undefined;

    const usage = await modelService.getUsage(id, range, userId, isAdmin);

    return NextResponse.json({
      success: true,
      usage,
      userRole: authUser?.role || "anonymous",
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models/[id]/usage:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
