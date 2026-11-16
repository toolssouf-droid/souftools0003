// lib/efficiency/smartModelRouter.ts
/**
 * Smart Model Router
 * Intelligently chooses the most efficient and cost-effective model tier
 * based on task requirements, speed, cost, and provider availability.
 */

import { getEfficiencyConfig } from "./efficiencyStore";
import { RequestOptimizationDecision } from "./types";
import { getInMemoryAdminConfig } from "../adminConfigStore";
import { SOUFAI_MODELS } from "../providers";

export type ModelTier = "spark" | "core" | "pro" | "ultra";

export interface ModelRouteDecision {
  selectedTier: ModelTier;
  targetModelName: string;
  speedRating: "ultra-fast" | "fast" | "balanced" | "deep";
  costRating: "free" | "low" | "standard" | "high";
  reason: string;
}

/**
 * Route request to the best model tier based on task type and efficiency settings
 */
export function routeModelTier(
  requestedTier: ModelTier,
  optimizationDecision: RequestOptimizationDecision,
  hasImageAttachment: boolean = false
): ModelRouteDecision {
  const config = getEfficiencyConfig();

  // If Smart Model Router is disabled, respect the requested tier directly
  if (!config.modelRouterEnabled) {
    return {
      selectedTier: requestedTier,
      targetModelName: getModelNameForTier(requestedTier),
      speedRating: "balanced",
      costRating: "standard",
      reason: "تم استخدام النموذج المحدد يدوياً (Smart Router معطل)",
    };
  }

  // 1. Multimodal / Vision Tasks use Ultra
  if (hasImageAttachment || optimizationDecision.taskType === "vision_analysis") {
    return {
      selectedTier: "ultra",
      targetModelName: getModelNameForTier("ultra"),
      speedRating: "fast",
      costRating: "low",
      reason: "مهمة رؤية بصرية - توجيه تلقائي لمحرك Ultra المتخصص",
    };
  }

  // 2. Coding and Full-Stack App building -> Pro
  if (optimizationDecision.taskType === "coding_tool") {
    return {
      selectedTier: "pro",
      targetModelName: getModelNameForTier("pro"),
      speedRating: "fast",
      costRating: "standard",
      reason: "مهمة برمجية - اختيار نموذج Pro للاستدلال البرمجي",
    };
  }

  // 3. Simple Definitions / Math / Direct Q&A -> Spark Model
  if (optimizationDecision.taskType === "math_calc" || (optimizationDecision.taskType === "direct_answer" && optimizationDecision.cleanedPrompt.length < 80)) {
    return {
      selectedTier: "spark",
      targetModelName: getModelNameForTier("spark"),
      speedRating: "ultra-fast",
      costRating: "free",
      reason: "استفسار بسيط ومباشر - توجيه لنموذج Spark فائق السرعة",
    };
  }

  // 4. Default to requestedTier or Core for general queries
  const effectiveTier = requestedTier || "core";
  return {
    selectedTier: effectiveTier,
    targetModelName: getModelNameForTier(effectiveTier),
    speedRating: "fast",
    costRating: "low",
    reason: "مهمة معرفية قياسية - استخدام نموذج التوازن الذكي",
  };
}

function getModelNameForTier(tier: ModelTier): string {
  try {
    const adminConfig = getInMemoryAdminConfig();
    if (adminConfig.modelProviders && adminConfig.modelProviders[tier]) {
      const providers = adminConfig.modelProviders[tier];
      if (Array.isArray(providers) && providers.length > 0) {
        const p = providers[0];
        const activeModel = p.activeModels?.[0] || p.models?.[0] || p.defaultAgentModel || p.model;
        if (activeModel) return activeModel;
      }
    }
  } catch {}

  const def = SOUFAI_MODELS[tier];
  if (def && def.defaultProviders && def.defaultProviders.length > 0) {
    return def.defaultProviders[0].model;
  }
  return "";
}
