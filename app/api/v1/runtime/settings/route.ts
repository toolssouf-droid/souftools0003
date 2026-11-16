/**
 * SoufAI Runtime Global Settings API
 * GET /api/v1/runtime/settings - Get global sandbox limits and timeouts (Admin only)
 * POST /api/v1/runtime/settings - Update global sandbox limits in Turso
 */
import { NextRequest, NextResponse } from "next/server";
import { SettingsRepository } from "@/lib/db";
import { RuntimeSettings } from "@/lib/runtime/types";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: RuntimeSettings = {
  autoCleanupMinutes: 15,
  idleTimeoutMs: 10 * 60 * 1000,
  defaultProvider: "native_sandbox",
  saveStateBeforeStop: true,
  enableHealthCheck: true,
  limits: {
    ramMb: 500,
    cpuCores: 1,
    diskMb: 2048,
    timeoutMinutes: 10,
    maxProcesses: 50,
    networkMode: "restricted",
    maxFileSizeMb: 30,
  },
};

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const stored = await SettingsRepository.getSetting<RuntimeSettings>("runtime_settings");
    const settings = stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: any) {
    console.error("[Runtime Settings GET] Error:", err);
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS,
    });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await request.json();
    const incoming: Partial<RuntimeSettings> = body.settings || body;

    const current = (await SettingsRepository.getSetting<RuntimeSettings>("runtime_settings")) || DEFAULT_SETTINGS;
    const defaultLimits = DEFAULT_SETTINGS.limits ?? {
      ramMb: 500,
      cpuCores: 1,
      diskMb: 2048,
      timeoutMinutes: 10,
      maxProcesses: 50,
      networkMode: "restricted",
      maxFileSizeMb: 30,
    };
    const merged: RuntimeSettings = {
      ...current,
      ...incoming,
      limits: {
        ramMb: incoming.limits?.ramMb ?? current.limits?.ramMb ?? defaultLimits.ramMb,
        cpuCores: incoming.limits?.cpuCores ?? current.limits?.cpuCores ?? defaultLimits.cpuCores,
        diskMb: incoming.limits?.diskMb ?? current.limits?.diskMb ?? defaultLimits.diskMb,
        timeoutMinutes: incoming.limits?.timeoutMinutes ?? current.limits?.timeoutMinutes ?? defaultLimits.timeoutMinutes,
        maxProcesses: incoming.limits?.maxProcesses ?? current.limits?.maxProcesses ?? defaultLimits.maxProcesses,
        networkMode: incoming.limits?.networkMode ?? current.limits?.networkMode ?? defaultLimits.networkMode,
        maxFileSizeMb: incoming.limits?.maxFileSizeMb ?? current.limits?.maxFileSizeMb ?? defaultLimits.maxFileSizeMb,
      },
    };

    await SettingsRepository.setSetting("runtime_settings", merged, false);

    return NextResponse.json({
      success: true,
      message: "تم حفظ إعدادات وحدود بيئات التشغيل في Turso بنجاح",
      settings: merged,
    });
  } catch (err: any) {
    console.error("[Runtime Settings POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل حفظ إعدادات التشغيل في قاعدة البيانات" },
      { status: 500 }
    );
  }
}
