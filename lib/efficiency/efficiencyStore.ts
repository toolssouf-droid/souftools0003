// lib/efficiency/efficiencyStore.ts
/**
 * AI Efficiency Manager Store
 * Handles in-memory caching, analytics aggregation, and persistent configuration (Turso + Memory)
 */

import {
  EfficiencyConfig,
  EfficiencyAnalyticsSummary,
  EfficiencyAnalyticsEvent,
  CachedResultItem,
} from "./types";

export const DEFAULT_EFFICIENCY_CONFIG: EfficiencyConfig = {
  promptCacheEnabled: true,
  modelRouterEnabled: true,
  parallelToolsEnabled: true,
  resultCacheEnabled: true,
  memoryOptimizationEnabled: true,
  maxStepsMode: "balanced",
  reflectionLevel: "fast",
  maxReflectionSteps: 1,
  toolBudgets: {
    webSearch: 5,
    vision: 3,
    coding: 5,
    imageGen: 2,
    calculator: 5,
    gmail: 5,
  },
  resultCacheTtlMinutes: 15,
  compressToolOutputs: true,
  version: "1.2.0",
};

// Global In-Memory Configuration State
let currentConfig: EfficiencyConfig = { ...DEFAULT_EFFICIENCY_CONFIG };

// Global In-Memory Result Cache: Key -> CachedResultItem
const resultCacheStore = new Map<string, CachedResultItem>();

// Global Analytics State
let analyticsState: EfficiencyAnalyticsSummary = {
  totalRequests: 0,
  cachedRequests: 0,
  tokensUsed: 0,
  tokensSaved: 0,
  savingsPercentage: 0,
  avgLatencyMs: 0,
  toolExecutions: {},
  modelUsage: {},
  cacheHitsCount: 0,
  recentEvents: [],
};

// Prompt Cache Storage: Hash -> System instructions / Definitions
const promptCacheStore = new Map<string, { content: string; version: string; timestamp: number }>();

// Initialization lock
let isStoreInitialized = false;

/**
 * Initialize store from Turso settings if available
 */
export async function initEfficiencyStoreFromDb(): Promise<void> {
  if (isStoreInitialized) return;
  isStoreInitialized = true;
  try {
    const { SettingsRepository } = await import("@/lib/db");
    const savedConfig = await SettingsRepository.getSetting<EfficiencyConfig>("efficiency_config");
    if (savedConfig) {
      currentConfig = {
        ...DEFAULT_EFFICIENCY_CONFIG,
        ...savedConfig,
        toolBudgets: {
          ...DEFAULT_EFFICIENCY_CONFIG.toolBudgets,
          ...(savedConfig.toolBudgets || {}),
        },
      };
    }
    const savedAnalytics = await SettingsRepository.getSetting<EfficiencyAnalyticsSummary>("efficiency_analytics");
    if (savedAnalytics) {
      analyticsState = {
        ...analyticsState,
        ...savedAnalytics,
        recentEvents: Array.isArray(savedAnalytics.recentEvents) ? savedAnalytics.recentEvents : [],
      };
    }
  } catch (err) {
    // Graceful fallback to memory
  }
}

/**
 * Get current efficiency configuration
 */
export function getEfficiencyConfig(): EfficiencyConfig {
  return { ...currentConfig };
}

/**
 * Update efficiency configuration
 */
export function updateEfficiencyConfig(partial: Partial<EfficiencyConfig>): EfficiencyConfig {
  currentConfig = {
    ...currentConfig,
    ...partial,
    toolBudgets: {
      ...currentConfig.toolBudgets,
      ...(partial.toolBudgets || {}),
    },
  };

  // Persist to Turso SettingsRepository
  try {
    import("@/lib/db")
      .then(({ SettingsRepository }) => {
        SettingsRepository.setSetting("efficiency_config", currentConfig).catch(() => {});
      })
      .catch(() => {});
  } catch {}

  return { ...currentConfig };
}

/**
 * Helper to estimate tokens from string (1 token ≈ 3.5 characters for multilingual/Arabic)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/**
 * Get all analytics data
 */
export function getEfficiencyAnalytics(): EfficiencyAnalyticsSummary {
  const total = analyticsState.totalRequests || 0;
  const savedRatio = total > 0
    ? (analyticsState.cachedRequests / total) * 100
    : 0;

  return {
    ...analyticsState,
    savingsPercentage: Math.round(savedRatio * 10) / 10,
    recentEvents: [...analyticsState.recentEvents].slice(-25),
  };
}

let lastAnalyticsPersistTime = 0;
function debouncedPersistAnalytics() {
  const now = Date.now();
  if (now - lastAnalyticsPersistTime > 5000) {
    lastAnalyticsPersistTime = now;
    try {
      import("@/lib/db")
        .then(({ SettingsRepository }) => {
          SettingsRepository.setSetting("efficiency_analytics", analyticsState).catch(() => {});
        })
        .catch(() => {});
    } catch {}
  }
}

/**
 * Record a real telemetry event during AI operations
 */
export function recordEfficiencyEvent(event: Omit<EfficiencyAnalyticsEvent, "id" | "timestamp">) {
  const fullEvent: EfficiencyAnalyticsEvent = {
    ...event,
    promptSummary: event.promptSummary || "AI task telemetry",
    id: `eff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  analyticsState.totalRequests += 1;
  if (event.type === "cache_hit") {
    analyticsState.cachedRequests += 1;
    analyticsState.cacheHitsCount += 1;
  }

  analyticsState.tokensUsed += event.tokensEstimated || 0;
  analyticsState.tokensSaved += event.tokensSaved || 0;

  // Update Model usage
  if (event.modelUsed) {
    analyticsState.modelUsage[event.modelUsed] = (analyticsState.modelUsage[event.modelUsed] || 0) + 1;
  }

  // Update Tools execution count
  if (Array.isArray(event.toolsUsed)) {
    event.toolsUsed.forEach((tool) => {
      analyticsState.toolExecutions[tool] = (analyticsState.toolExecutions[tool] || 0) + 1;
    });
  }

  // Rolling Average Latency
  if (event.latencyMs > 0) {
    if (analyticsState.avgLatencyMs === 0) {
      analyticsState.avgLatencyMs = event.latencyMs;
    } else {
      analyticsState.avgLatencyMs = Math.round((analyticsState.avgLatencyMs * 0.85) + (event.latencyMs * 0.15));
    }
  }

  // Add to recent events queue (max 50)
  analyticsState.recentEvents.push(fullEvent);
  if (analyticsState.recentEvents.length > 50) {
    analyticsState.recentEvents.shift();
  }

  debouncedPersistAnalytics();
}

/**
 * Result Cache Operations
 */
export function getCachedResult(promptKey: string): CachedResultItem | null {
  if (!currentConfig.resultCacheEnabled) return null;

  const item = resultCacheStore.get(promptKey);
  if (!item) return null;

  // Check TTL
  const now = Date.now();
  if (now - item.timestamp > item.ttlMs) {
    resultCacheStore.delete(promptKey);
    return null;
  }

  item.hitCount += 1;
  return item;
}

export function setCachedResult(
  promptKey: string,
  normalizedPrompt: string,
  text: string,
  modelUsed: string,
  providerUsed: string,
  metadata?: { sourcesCount?: number; toolsUsed?: string[] }
) {
  if (!currentConfig.resultCacheEnabled) return;

  const ttlMs = (currentConfig.resultCacheTtlMinutes || 15) * 60 * 1000;
  const estimatedTokensSaved = estimateTokens(text) + estimateTokens(normalizedPrompt);

  const item: CachedResultItem = {
    id: `cache_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    promptHash: promptKey,
    normalizedPrompt,
    text,
    modelUsed,
    providerUsed,
    timestamp: Date.now(),
    ttlMs,
    hitCount: 0,
    estimatedTokensSaved,
    metadata,
  };

  resultCacheStore.set(promptKey, item);

  // Evict older entries if cache size exceeds 200
  if (resultCacheStore.size > 200) {
    const oldestKey = resultCacheStore.keys().next().value;
    if (oldestKey) resultCacheStore.delete(oldestKey);
  }
}

export function clearResultCache(): { count: number } {
  const count = resultCacheStore.size;
  resultCacheStore.clear();
  return { count };
}

export function resetEfficiencyAnalytics(): void {
  analyticsState = {
    totalRequests: 0,
    cachedRequests: 0,
    tokensUsed: 0,
    tokensSaved: 0,
    savingsPercentage: 0,
    avgLatencyMs: 0,
    toolExecutions: {},
    modelUsage: {},
    cacheHitsCount: 0,
    recentEvents: [],
  };

  try {
    import("@/lib/db")
      .then(({ SettingsRepository }) => {
        SettingsRepository.setSetting("efficiency_analytics", analyticsState).catch(() => {});
      })
      .catch(() => {});
  } catch {}
}

/**
 * Prompt Cache Operations
 */
export function getCachedPromptBlock(cacheKey: string): string | null {
  if (!currentConfig.promptCacheEnabled) return null;
  const cached = promptCacheStore.get(cacheKey);
  return cached ? cached.content : null;
}

export function setCachedPromptBlock(cacheKey: string, content: string, version: string = "1.0"): void {
  if (!currentConfig.promptCacheEnabled) return;
  promptCacheStore.set(cacheKey, {
    content,
    version,
    timestamp: Date.now(),
  });
}
