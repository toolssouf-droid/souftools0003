import { NextRequest, NextResponse } from "next/server";
import { KeyRotationManager } from "@/lib/runtime/keyRotationManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const results = await KeyRotationManager.testAllKeys();
    return NextResponse.json({
      success: true,
      results,
      message: `تم فحص واختبار ${results.length} مفاتيح بنجاح`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "فشل اختبار المفاتيح" },
      { status: 500 }
    );
  }
}
