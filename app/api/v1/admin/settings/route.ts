/**
 * SoufTools Admin Settings API Route
 * Persists and retrieves administrative configurations, API key sets, and provider configs in Turso.
 */

import { NextRequest, NextResponse } from "next/server";
import { SettingsRepository, AuditRepository } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { loadServerAdminConfig, updateInMemoryAdminConfig } from "@/lib/adminConfigStore";
import { encryptKey, decryptKey } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const serverConfig = await loadServerAdminConfig();
    const rawSystemConfig = (await SettingsRepository.getSetting<any>("admin_system_config")) || {};

    // Decrypt toolsConfig keys if stored encrypted inside admin_system_config
    let toolsConfig = rawSystemConfig.toolsConfig;
    if (Array.isArray(toolsConfig)) {
      toolsConfig = toolsConfig.map((t: any) => ({
        ...t,
        keys: Array.isArray(t.keys)
          ? t.keys.map((k: any) => ({
              ...k,
              ...(typeof k?.key === "string" && k.key ? { key: decryptKey(k.key) } : {}),
            }))
          : [],
      }));
    }

    const mergedConfig = {
      ...rawSystemConfig,
      ...serverConfig,
      ...(toolsConfig ? { toolsConfig } : {}),
    };

    return NextResponse.json({
      success: true,
      settings: mergedConfig,
      config: mergedConfig,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل استرجاع الإعدادات", error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const payload = body.settings || body;

    // Update core adminConfigStore (encrypts keys/secrets and writes to Turso)
    await updateInMemoryAdminConfig({
      ...(payload.modelProviders !== undefined ? { modelProviders: payload.modelProviders } : {}),
      ...(payload.keys !== undefined ? { keys: payload.keys } : {}),
      ...(payload.activeModelTiers !== undefined ? { activeModelTiers: payload.activeModelTiers } : {}),
      ...(payload.selectedAgentModel !== undefined ? { selectedAgentModel: payload.selectedAgentModel } : {}),
      ...(payload.classifierModelConfig !== undefined ? { classifierModelConfig: payload.classifierModelConfig } : {}),
      ...(payload.visionModelConfig !== undefined ? { visionModelConfig: payload.visionModelConfig } : {}),
      ...(payload.platformSupportEmail !== undefined ? { platformSupportEmail: payload.platformSupportEmail } : {}),
      ...(payload.authProviders !== undefined ? { authProviders: payload.authProviders } : {}),
      ...(payload.emailSettings !== undefined ? { emailSettings: payload.emailSettings } : {}),
    });

    // Also preserve extra fields like toolsConfig / toolsStats / custom system fields in admin_system_config
    const existing = (await SettingsRepository.getSetting<any>("admin_system_config")) || {};
    const extraPatch: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (
        ![
          "modelProviders",
          "keys",
          "activeModelTiers",
          "selectedAgentModel",
          "classifierModelConfig",
          "visionModelConfig",
          "platformSupportEmail",
          "authProviders",
          "emailSettings",
        ].includes(k)
      ) {
        if (k === "toolsConfig" && Array.isArray(v)) {
          extraPatch.toolsConfig = v.map((t: any) => ({
            ...t,
            keys: Array.isArray(t.keys)
              ? t.keys.map((kObj: any) => ({
                  ...kObj,
                  ...(typeof kObj?.key === "string" && kObj.key
                    ? { key: encryptKey(kObj.key) }
                    : {}),
                }))
              : [],
          }));
        } else {
          extraPatch[k] = v;
        }
      }
    }

    await SettingsRepository.setSetting(
      "admin_system_config",
      {
        ...existing,
        ...extraPatch,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email,
      },
      true
    );

    await AuditRepository.logAction({
      adminUserId: user.id,
      action: "UPDATE_SYSTEM_SETTINGS",
      resourceType: "settings",
      details: { fieldsUpdated: Object.keys(payload) },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "تم حفظ الإعدادات بنجاح في قاعدة البيانات",
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل حفظ الإعدادات", error: err.message },
      { status: 500 }
    );
  }
}
