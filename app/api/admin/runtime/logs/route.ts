import { NextRequest, NextResponse } from "next/server";
import { getRecentRuntimeLogs } from "@/lib/runtime/runtimeDatabaseServices";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const logs = await getRecentRuntimeLogs(60);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch runtime logs" },
      { status: 500 }
    );
  }
}
