import { NextRequest, NextResponse } from "next/server";
import {
  SUPPORTED_VISION_MODELS,
  VisionCapabilityLayer,
  VisionSelectionStrategy,
  VisionModelDef,
} from "@/lib/vision/visionCapabilityLayer";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { SettingsRepository } from "@/lib/db";

const VISION_CONFIG_KEY = "vision_providers_config";

interface StoredVisionConfig {
  strategy?: VisionSelectionStrategy;
  customModelConfigs?: Record<string, Partial<VisionModelDef>>;
}

async function loadPersistedVisionConfig(): Promise<{
  strategy: VisionSelectionStrategy;
  customModelConfigs: Record<string, Partial<VisionModelDef>>;
}> {
  const stored = (await SettingsRepository.getSetting<StoredVisionConfig>(VISION_CONFIG_KEY)) || {};
  const strategy = (stored.strategy || VisionCapabilityLayer.getStrategy() || "fastest") as VisionSelectionStrategy;
  const customModelConfigs = stored.customModelConfigs || {};

  VisionCapabilityLayer.setStrategy(strategy);
  for (const [modelId, cfg] of Object.entries(customModelConfigs)) {
    const baseModel = SUPPORTED_VISION_MODELS.find((m) => m.id === modelId);
    if (baseModel && cfg) {
      if (cfg.status !== undefined) baseModel.status = cfg.status;
      if (cfg.priority !== undefined) baseModel.priority = cfg.priority;
    }
  }

  return { strategy, customModelConfigs };
}

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const { strategy, customModelConfigs } = await loadPersistedVisionConfig();

    const models = SUPPORTED_VISION_MODELS.map((m) => {
      const custom = customModelConfigs[m.id] || {};
      return {
        ...m,
        ...custom,
      };
    });

    const activeCount = models.filter((m) => m.status === "active" && m.visionSupport).length;

    return NextResponse.json({
      strategy,
      activeCount,
      totalCount: models.length,
      models,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch AI Vision Providers config" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { strategy, modelId, status, priority } = body;

    const current = await loadPersistedVisionConfig();
    let nextStrategy = current.strategy;
    const nextCustomConfigs = { ...current.customModelConfigs };

    if (strategy) {
      nextStrategy = strategy as VisionSelectionStrategy;
      VisionCapabilityLayer.setStrategy(nextStrategy);
    }

    if (modelId) {
      const existing = { ...(nextCustomConfigs[modelId] || {}) };
      if (status !== undefined) existing.status = status;
      if (priority !== undefined) existing.priority = priority;
      nextCustomConfigs[modelId] = existing;

      const baseModel = SUPPORTED_VISION_MODELS.find((m) => m.id === modelId);
      if (baseModel) {
        if (status !== undefined) baseModel.status = status;
        if (priority !== undefined) baseModel.priority = priority;
      }
    }

    await SettingsRepository.setSetting(
      VISION_CONFIG_KEY,
      {
        strategy: nextStrategy,
        customModelConfigs: nextCustomConfigs,
        updatedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.json({
      success: true,
      strategy: nextStrategy,
      customModelConfigs: nextCustomConfigs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update AI Vision Providers config" },
      { status: 500 }
    );
  }
}
