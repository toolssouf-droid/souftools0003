// app/api/v1/models/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllModels } from "@/lib/models/modelRegistry";
import { getAllRegisteredModelProfiles } from "@/lib/models/providerModelRegistry";
import { SettingsRepository } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";

    const allModels = getAllModels();
    const providerMatrix = getAllRegisteredModelProfiles();

    let filteredModels = allModels;
    let activeTiers: string[] | undefined;

    if (!isAdmin) {
      const config = await SettingsRepository.getSetting<any>("admin_system_config").catch(() => null);
      activeTiers = config?.activeModelTiers;

      if (Array.isArray(activeTiers) && activeTiers.length > 0) {
        filteredModels = allModels.filter((m: any) => activeTiers!.includes(m.id) || activeTiers!.includes(m.tier));
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: filteredModels.length,
      models: filteredModels,
      activeTiers,
      providerMatrixCount: isAdmin ? providerMatrix.length : undefined,
      providerMatrix: isAdmin ? providerMatrix : undefined,
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve models from registry",
        message: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
