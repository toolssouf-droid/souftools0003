import { NextRequest, NextResponse } from "next/server";
import { getRuntimeKeys } from "@/lib/runtime/runtimeDatabaseServices";
import { KeyRotationManager } from "@/lib/runtime/keyRotationManager";
import { getSandboxProvider } from "@/lib/runtime/providers";
import { SandboxProviderId } from "@/lib/runtime/types";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { keyId, rawKey, provider = "e2b" } = body;

    // Direct raw test for unsaved keys
    if (rawKey) {
      const sandboxProvider = getSandboxProvider(provider as SandboxProviderId);
      const testRes = await sandboxProvider.testKey(rawKey);
      return NextResponse.json(testRes);
    }

    if (keyId) {
      const keys = await getRuntimeKeys();
      const match = keys.find((k) => k.id === keyId);
      if (!match) {
        return NextResponse.json({ valid: false, message: "المفتاح غير موجود" }, { status: 404 });
      }

      const result = await KeyRotationManager.testKey(match);
      return NextResponse.json(result);
    }

    return NextResponse.json({ valid: false, message: "لم يتم تمرير المفتاح للاختبار" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, message: err?.message || "خطأ أثناء فحص المفتاح", latencyMs: 0 },
      { status: 500 }
    );
  }
}
