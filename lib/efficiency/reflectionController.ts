// lib/efficiency/reflectionController.ts
/**
 * Reflection Controller
 * Controls post-action self-critique and verification depth to avoid redundant agent loops.
 */

import { getEfficiencyConfig } from "./efficiencyStore";
import { ReflectionLevel } from "./types";

export interface ReflectionDecision {
  shouldReflect: boolean;
  maxReflectionCycles: number;
  reason: string;
}

/**
 * Determine reflection strategy for current task and error state
 */
export function determineReflectionStrategy(
  hasErrors: boolean,
  currentIteration: number,
  taskType: string
): ReflectionDecision {
  const config = getEfficiencyConfig();
  const level: ReflectionLevel = config.reflectionLevel;

  if (level === "off") {
    return {
      shouldReflect: false,
      maxReflectionCycles: 0,
      reason: "المراجعة الذاتية معطلة (Reflection: Off)",
    };
  }

  if (level === "fast") {
    const shouldReflect = hasErrors || taskType === "coding_tool";
    return {
      shouldReflect,
      maxReflectionCycles: 1,
      reason: "مراجعة سريعة موجهة للأخطاء فقط (Reflection: Fast)",
    };
  }

  if (level === "normal") {
    const shouldReflect = hasErrors || currentIteration > 1 || taskType === "coding_tool";
    return {
      shouldReflect,
      maxReflectionCycles: Math.min(2, config.maxReflectionSteps || 2),
      reason: "مراجعة متوازنة للتحقق من جودة المخرجات (Reflection: Normal)",
    };
  }

  // Deep
  return {
    shouldReflect: true,
    maxReflectionCycles: Math.min(4, config.maxReflectionSteps || 4),
    reason: "مراجعة استدلالية متقدمة وتدقيق شامل (Reflection: Deep)",
  };
}
