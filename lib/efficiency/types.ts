// lib/efficiency/types.ts
/**
 * AI Efficiency Manager Data Types and Configuration Interfaces
 * Production-grade runtime optimization contracts for SoufTools AI Engine
 */

export type MaxStepsMode = "quick" | "balanced" | "deep";
export type ReflectionLevel = "off" | "fast" | "normal" | "deep";

export interface ToolBudgets {
  webSearch: number;
  vision: number;
  coding: number;
  imageGen: number;
  calculator: number;
  gmail: number;
}

export interface EfficiencyConfig {
  promptCacheEnabled: boolean;
  modelRouterEnabled: boolean;
  parallelToolsEnabled: boolean;
  resultCacheEnabled: boolean;
  memoryOptimizationEnabled: boolean;
  maxStepsMode: MaxStepsMode;
  reflectionLevel: ReflectionLevel;
  maxReflectionSteps: number;
  toolBudgets: ToolBudgets;
  resultCacheTtlMinutes: number;
  compressToolOutputs: boolean;
  version: string;
}

export interface CachedResultItem {
  id: string;
  promptHash: string;
  normalizedPrompt: string;
  modelUsed: string;
  providerUsed: string;
  text: string;
  timestamp: number;
  ttlMs: number;
  hitCount: number;
  estimatedTokensSaved: number;
  metadata?: {
    sourcesCount?: number;
    toolsUsed?: string[];
  };
}

export interface EfficiencyAnalyticsEvent {
  id: string;
  timestamp: number;
  type: "cache_hit" | "api_call" | "optimized_route" | "parallel_execution" | "budget_throttled" | "memory_pruned";
  promptSummary?: string;
  modelUsed: string;
  providerUsed?: string;
  latencyMs: number;
  tokensEstimated: number;
  tokensSaved: number;
  toolsUsed: string[];
}

export interface EfficiencyAnalyticsSummary {
  totalRequests: number;
  cachedRequests: number;
  tokensUsed: number;
  tokensSaved: number;
  savingsPercentage: number;
  avgLatencyMs: number;
  toolExecutions: Record<string, number>;
  modelUsage: Record<string, number>;
  cacheHitsCount: number;
  recentEvents: EfficiencyAnalyticsEvent[];
}

export interface RequestOptimizationDecision {
  requiresModel: boolean;
  taskType: "direct_answer" | "web_search" | "coding_tool" | "vision_analysis" | "math_calc" | "complex_agent";
  recommendedModelTier: "spark" | "vision" | "core" | "pro" | "ultra" | "coder" | "writer" | "lite_free";
  recommendedTools: string[];
  isCacheable: boolean;
  maxStepsAllowed: number;
  cleanedPrompt: string;
  redundancyRemovedChars: number;
  reasoning: string;
}
