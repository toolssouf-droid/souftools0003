import { NextRequest, NextResponse } from "next/server";
import { validateKeySyntax } from "@/lib/keyFormats";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { decryptKey } from "@/lib/encryption";
import { testProviderKeyLive } from "@/lib/providers/providerAdapters";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const providerId = typeof body?.providerId === "string" ? body.providerId.trim().toLowerCase() : "";
    const key = typeof body?.key === "string" ? body.key : "";

    if (!providerId) {
      return NextResponse.json({ status: "failed", error: "معرّف المزود مطلوب" }, { status: 400 });
    }

    if (providerId !== "ollama" && key.trim() === "") {
      return NextResponse.json({ status: "failed", error: "المفتاح فارغ" }, { status: 400 });
    }

    const rawKey = key.trim();
    const trimmedKey = rawKey ? (decryptKey(rawKey) || rawKey) : "";

    const syntaxCheck = validateKeySyntax(providerId, trimmedKey);
    if (!syntaxCheck.valid) {
      return NextResponse.json(
        { status: "failed", error: syntaxCheck.messageAr || "صيغة المفتاح غير صحيحة" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await testProviderKeyLive(providerId, trimmedKey, controller.signal);
      if (result.valid) {
        return NextResponse.json({
          status: "active",
          latencyMs: result.latencyMs,
        });
      }
      const httpStatus = result.statusCode && result.statusCode >= 500 ? 502 : 400;
      return NextResponse.json(
        {
          status: "failed",
          latencyMs: result.latencyMs,
          error: result.error || `فشل التحقق من ${providerId}`,
        },
        { status: httpStatus }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e: any) {
    return NextResponse.json(
      { status: "failed", error: e?.message || "خطأ أثناء محاولة الفحص" },
      { status: 500 }
    );
  }
}
