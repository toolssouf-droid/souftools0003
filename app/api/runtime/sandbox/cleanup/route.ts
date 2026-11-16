import { NextRequest, NextResponse } from "next/server";
import { RuntimeSessionManager } from "@/lib/runtime/sessionManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const result = await RuntimeSessionManager.runAutoCleanup();
    return NextResponse.json({
      success: true,
      ...result,
      message: `تم تنظيف ${result.stoppedCount} جلسة خاملة بنجاح`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed auto cleanup" },
      { status: 500 }
    );
  }
}
