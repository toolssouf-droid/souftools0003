import { NextRequest, NextResponse } from "next/server";
import { updateLoadedToolsStats } from "@/lib/toolsConfig";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { decryptKey } from "@/lib/encryption";
import { testProviderKeyLive } from "@/lib/providers/providerAdapters";

const SUPPORTED_TOOL_KEY_PROVIDERS = new Set(["tavily", "exa", "jina", "firecrawl", "serper", "e2b"]);

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const toolId = typeof body?.toolId === "string" ? body.toolId.trim().toLowerCase() : "";
    const rawKey = typeof body?.key === "string" ? body.key.trim() : "";

    if (!rawKey) {
      return NextResponse.json({ valid: false, message: "المفتاح فارغ" }, { status: 400 });
    }

    if (!SUPPORTED_TOOL_KEY_PROVIDERS.has(toolId)) {
      return NextResponse.json(
        { valid: false, message: `الأداة (${toolId || "غير محددة"}) لا تملك مزود فحص مفتاح حقيقي.` },
        { status: 400 }
      );
    }

    const trimmedKey = decryptKey(rawKey) || rawKey;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const result = await testProviderKeyLive(toolId, trimmedKey, controller.signal);
      if (result.valid) {
        updateLoadedToolsStats(toolId, "success", "فحص واختبار المفتاح البرمجي", result.latencyMs);
        return NextResponse.json({
          valid: true,
          latencyMs: result.latencyMs,
          message: `نشط (الاستجابة: ${result.latencyMs}ms)`,
        });
      }

      updateLoadedToolsStats(toolId, "failed", "فحص واختبار المفتاح البرمجي", result.latencyMs);
      return NextResponse.json({
        valid: false,
        latencyMs: result.latencyMs,
        message: result.error || `فشل فحص مفتاح ${toolId}`,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    return NextResponse.json({
      valid: false,
      message: `خطأ أثناء المعالجة: ${err?.message || "خطأ داخلي"}`,
    });
  }
}
