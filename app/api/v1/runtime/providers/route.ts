/**
 * SoufAI Runtime Providers API
 * GET /api/v1/runtime/providers - List configured sandbox providers (Admin only)
 * POST /api/v1/runtime/providers - Save and toggle sandbox providers in Turso
 */
import { NextRequest, NextResponse } from "next/server";
import { SettingsRepository } from "@/lib/db";
import { RuntimeProviderConfig } from "@/lib/runtime/types";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

const DEFAULT_PROVIDERS: RuntimeProviderConfig[] = [
  {
    provider: "native_sandbox",
    name: "SoufTools Native Linux Sandbox",
    description: "بيئة تشغيل معزولة أصيلة داخل الخادم بتقنيات Linux Namespaces وCgroups وعزل كامل للموارد والملفات",
    enabled: true,
    priority: 1,
    isCloudSandbox: false,
  },
  {
    provider: "e2b",
    name: "E2B Cloud Code Sandbox",
    description: "سحابة تشغيل معزولة وسريعة لتنفيذ الأكواد في السحابة مع دعم كامل لشبكة الإنترنت",
    enabled: true,
    priority: 2,
    isCloudSandbox: true,
  },
  {
    provider: "webcontainer",
    name: "WebContainer (Browser Isolated)",
    description: "محرك تشغيل فوري يعمل محلياً داخل المتصفح كبديل احتياطي ذكي",
    enabled: true,
    priority: 3,
    isCloudSandbox: false,
  },
  {
    provider: "docker",
    name: "Docker Custom Container",
    description: "حاويات مخصصة للمشاريع الكبيرة",
    enabled: false,
    priority: 4,
    isCloudSandbox: false,
  },
];

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const stored = await SettingsRepository.getSetting<RuntimeProviderConfig[]>("runtime_providers");
    const providers = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_PROVIDERS;

    return NextResponse.json({
      success: true,
      providers,
    });
  } catch (err: any) {
    console.error("[Runtime Providers GET] Error:", err);
    return NextResponse.json({
      success: true,
      providers: DEFAULT_PROVIDERS,
    });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await request.json();
    const providers: RuntimeProviderConfig[] = body.providers;

    if (!Array.isArray(providers)) {
      return NextResponse.json(
        { success: false, error: "قائمة المزودين غير صالحة" },
        { status: 400 }
      );
    }

    await SettingsRepository.setSetting("runtime_providers", providers, false);

    return NextResponse.json({
      success: true,
      message: "تم حفظ إعدادات مزودي بيئات التشغيل في Turso بنجاح",
      providers,
    });
  } catch (err: any) {
    console.error("[Runtime Providers POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل حفظ مزودي بيئات التشغيل" },
      { status: 500 }
    );
  }
}
