import { NextRequest, NextResponse } from "next/server";
import {
  loadCloudflareKeys,
  generateViaCloudflareKey,
  saveCloudflareKeys,
} from "@/lib/providers/imageProviderManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { keyId } = body;

    if (!keyId) {
      return NextResponse.json({ valid: false, message: "مُعرّف المفتاح مطلوب" }, { status: 400 });
    }

    const keys = await loadCloudflareKeys();
    const targetKey = keys.find((k) => k.id === keyId);

    if (!targetKey) {
      return NextResponse.json({ valid: false, message: "المفتاح غير موجود" }, { status: 404 });
    }

    const startTime = Date.now();
    const testPrompt = "a simple red geometric cube on black background";

    const res = await generateViaCloudflareKey(targetKey, testPrompt);
    const latencyMs = Date.now() - startTime;

    if (res.success) {
      targetKey.status = "healthy";
      targetKey.failureCount = 0;
      targetKey.lastUsedAt = new Date().toISOString();
      await saveCloudflareKeys(keys);

      return NextResponse.json({
        valid: true,
        message: `المفتاح يعمل بكفاءة عالية على Cloudflare Workers AI (${res.modelUsed}) - زمن الاستجابة: ${latencyMs}ms`,
        latencyMs,
      });
    } else {
      targetKey.status = "failed";
      targetKey.lastError = res.error;
      await saveCloudflareKeys(keys);

      return NextResponse.json({
        valid: false,
        message: `فشل المفتاح: ${res.error || "استجابة غير صالحة من Cloudflare"}`,
        latencyMs,
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      valid: false,
      message: `خطأ في الاتصال: ${err.message}`,
    });
  }
}
