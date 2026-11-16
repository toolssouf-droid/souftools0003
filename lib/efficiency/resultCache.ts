// lib/efficiency/resultCache.ts
/**
 * Result Cache Engine
 * Evaluates incoming queries against in-memory cached responses with TTL
 * to return instantaneous answers with 0 API calls for repeated questions.
 */

import { getCachedResult, setCachedResult, getEfficiencyConfig } from "./efficiencyStore";
import { CachedResultItem } from "./types";

/**
 * Normalizes prompt text for consistent cache lookup
 */
export function normalizePromptForCache(prompt: string): string {
  return (prompt || "")
    .toLowerCase()
    .trim()
    .replace(/[؟?.,!،]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Creates deterministic hash key for prompt + model combination
 */
export function createCacheKey(prompt: string, modelTier: string = "core"): string {
  const normalized = normalizePromptForCache(prompt);
  return `res_${modelTier}_${normalized}`;
}

/**
 * Checks if a valid cached response exists
 */
export function checkResultCache(prompt: string, modelTier: string = "core"): CachedResultItem | null {
  const config = getEfficiencyConfig();
  if (!config.resultCacheEnabled) return null;

  // Don't cache dynamic queries with current time, date, news
  const lower = prompt.toLowerCase();
  if (/الساعة|كم الوقت|تاريخ اليوم|أخبار اليوم|الطقس الآن|time now|date today/i.test(lower)) {
    return null;
  }

  const cacheKey = createCacheKey(prompt, modelTier);
  return getCachedResult(cacheKey);
}

/**
 * Stores response into the Result Cache
 */
export function storeResultCache(
  prompt: string,
  modelTier: string,
  responseText: string,
  modelUsed: string,
  providerUsed: string,
  metadata?: { sourcesCount?: number; toolsUsed?: string[] }
): void {
  const config = getEfficiencyConfig();
  if (!config.resultCacheEnabled) return;

  const normalized = normalizePromptForCache(prompt);
  if (!responseText || responseText.length < 10) return;

  const cacheKey = createCacheKey(prompt, modelTier);
  setCachedResult(cacheKey, normalized, responseText, modelUsed, providerUsed, metadata);
}
