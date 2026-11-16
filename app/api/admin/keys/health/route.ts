import { NextRequest, NextResponse } from "next/server";
import { healthManager } from "@/lib/healthManager";
import { keyPoolManager } from "@/lib/providers/keyPoolManager";
import { responseCache } from "@/lib/providers/responseCache";
import { requestDispatcher } from "@/lib/providers/requestDispatcher";
import { requireAdmin } from "@/lib/auth/serverAuth";

/**
 * Health API Route for Model, Key, Cache & Dispatcher Telemetry
 * GET: returns live health status, cooldown timers, Key Pool, Cache, and Traffic Dispatcher stats
 * POST: allows unbanning, cache flushing, or resetting cooldowns
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const summary = healthManager.getHealthSummary();
  const poolStats = keyPoolManager.getPoolStats();
  const cacheStats = responseCache.getStats();
  const dispatcherStats = requestDispatcher.getStats();

  return NextResponse.json({
    ...summary,
    poolStats,
    cacheStats,
    dispatcherStats,
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { action, providerId, model, key } = body;

    const buildFullSummary = () => ({
      ...healthManager.getHealthSummary(),
      poolStats: keyPoolManager.getPoolStats(),
      cacheStats: responseCache.getStats(),
      dispatcherStats: requestDispatcher.getStats(),
    });

    if (action === "flush_cache") {
      responseCache.clear();
      return NextResponse.json({
        success: true,
        message: "تم مسح وتفريغ كاش الردود الفوري بنجاح ⚡",
        summary: buildFullSummary(),
      });
    }

    if (action === "unban_model" && providerId && model) {
      healthManager.unbanModel(providerId, model);
      return NextResponse.json({
        success: true,
        message: `تم إلغاء الحظر وتصفير عداد الإخفاق للنموذج ${model} بنجاح`,
        summary: buildFullSummary(),
      });
    }

    if (action === "unban_key" && providerId && key) {
      healthManager.unbanKey(providerId, key);
      keyPoolManager.resetCooldowns(providerId);
      return NextResponse.json({
        success: true,
        message: `تم إلغاء الحظر وتصفير عداد الإخفاق للمفتاح بنجاح`,
        summary: buildFullSummary(),
      });
    }

    if (action === "unban_all") {
      healthManager.unbanAll();
      keyPoolManager.resetCooldowns();
      return NextResponse.json({
        success: true,
        message: "تم إلغاء حظر وتصفير تبريد جميع النماذج ومفاتيح المجمّع بنجاح",
        summary: buildFullSummary(),
      });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "فشلت معالجة الطلب" }, { status: 500 });
  }
}
