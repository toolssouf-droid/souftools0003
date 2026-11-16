import { NextRequest, NextResponse } from "next/server";
import { loadServerAdminConfig, updateInMemoryAdminConfig } from "@/lib/adminConfigStore";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const config = await loadServerAdminConfig();

  return NextResponse.json({
    keys: config.keys,
    modelProviders: config.modelProviders,
    activeModelTiers: config.activeModelTiers,
    selectedAgentModel: config.selectedAgentModel,
    classifierModelConfig: config.classifierModelConfig,
    visionModelConfig: config.visionModelConfig,
    authProviders: config.authProviders,
    emailSettings: config.emailSettings,
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
    const { keys, modelProviders, activeModelTiers, selectedAgentModel, classifierModelConfig, visionModelConfig, authProviders, emailSettings } = body;

    let extractedKeys = keys;
    if ((!extractedKeys || Object.keys(extractedKeys).length === 0) && modelProviders && typeof modelProviders === "object") {
      extractedKeys = {};
      Object.keys(modelProviders).forEach((mId) => {
        const provs = modelProviders[mId] || [];
        provs.forEach((p: any) => {
          if (p.providerId && Array.isArray(p.keys)) {
            if (!extractedKeys![p.providerId]) extractedKeys![p.providerId] = [];
            p.keys.forEach((kObj: any) => {
              const rawKey = typeof kObj === "string" ? kObj : (kObj?.key || "");
              if (rawKey && !extractedKeys![p.providerId].includes(rawKey)) {
                extractedKeys![p.providerId].push(rawKey);
              }
            });
          }
        });
      });
    }

    await updateInMemoryAdminConfig({
      modelProviders,
      keys: extractedKeys,
      activeModelTiers,
      selectedAgentModel,
      classifierModelConfig,
      visionModelConfig,
      authProviders,
      emailSettings,
    });

    return NextResponse.json({ 
      success: true, 
      message: "تم حفظ ومزامنة المفاتيح وإعدادات النماذج ونموذج التصنيف ونموذج تحليل الصور بنجاح في قاعدة بيانات Turso المشفرة" 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "فشل مزامنة وحفظ المفاتيح" }, { status: 500 });
  }
}

