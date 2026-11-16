import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_TOOLS,
  normalizeToolsList,
  ensureToolsLoaded,
  getLoadedToolsCache,
  saveToolsConfigToDb,
  getCachedToolsStats,
  resetToolsStats,
} from "@/lib/toolsConfig";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await ensureToolsLoaded();
    const tools = getLoadedToolsCache();
    const stats = getCachedToolsStats();

    return NextResponse.json({ tools, stats });
  } catch (err: any) {
    return NextResponse.json({ tools: DEFAULT_TOOLS, stats: getCachedToolsStats(), warning: err?.message });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await ensureToolsLoaded();
    const body = await req.json().catch(() => ({}));
    const { tools, resetStats } = body;

    if (resetStats) {
      const freshStats = resetToolsStats();
      return NextResponse.json({ success: true, message: "تم تصفير الإحصائيات بنجاح", stats: freshStats });
    }

    if (!Array.isArray(tools)) {
      return NextResponse.json({ error: "بيانات الأدوات غير صالحة. يجب تقديم مصفوفة أدوات." }, { status: 400 });
    }

    const normalized = normalizeToolsList(tools);
    const dbSaved = await saveToolsConfigToDb(normalized);

    return NextResponse.json({
      success: true,
      message: "تم حفظ إعدادات وترتيب ومفاتيح الأدوات بنجاح",
      cloudSaved: dbSaved,
      tools: normalized,
      stats: getCachedToolsStats(),
      count: normalized.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Failed to save tools config:", err);
    return NextResponse.json({ error: `فشل حفظ إعدادات الأدوات: ${err?.message || "خطأ غير معروف"}` }, { status: 500 });
  }
}
