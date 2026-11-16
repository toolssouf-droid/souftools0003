// lib/efficiency/smartMemoryOptimizer.ts
/**
 * Smart Memory Optimizer
 * Partitions memory into Short-term (recent conversation) and Long-term (key facts),
 * filtering out irrelevant historical data to save token overhead.
 */

import { getEfficiencyConfig } from "./efficiencyStore";

export interface OptimizedMemoryResult {
  shortTermMessages: Array<{ role: "user" | "model" | "assistant" | "system"; content: string }>;
  relevantLongTermFacts: string[];
  tokensSavedEstimate: number;
  isPruned: boolean;
}

/**
 * Optimizes conversation history and long-term memory blocks
 */
export function optimizeMemoryPayload(
  prompt: string,
  messages: Array<{ role: "user" | "model" | "assistant" | "system"; content: string }> = [],
  rawLongTermMemories: Array<{ content: string; type?: string; projectName?: string }> = []
): OptimizedMemoryResult {
  const config = getEfficiencyConfig();

  if (!config.memoryOptimizationEnabled) {
    return {
      shortTermMessages: messages,
      relevantLongTermFacts: rawLongTermMemories.map((m) => m.content),
      tokensSavedEstimate: 0,
      isPruned: false,
    };
  }

  // 1. Short-Term Memory: Keep only last 4-6 most relevant turns
  const maxTurns = 6;
  const shortTermMessages = messages.length > maxTurns ? messages.slice(-maxTurns) : messages;

  // 2. Long-Term Memory: Semantic & Keyword Matching
  const promptKeywords = prompt
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟?]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const relevantFacts: string[] = [];
  let excludedFactsCount = 0;

  for (const memory of rawLongTermMemories) {
    const memLower = memory.content.toLowerCase();
    // Always include critical user preferences or user identity
    if (memory.type === "user" || memory.type === "preference") {
      relevantFacts.push(memory.content);
      continue;
    }

    // Match keywords with prompt
    const matches = promptKeywords.some((kw) => memLower.includes(kw));
    if (matches) {
      relevantFacts.push(memory.content);
    } else {
      excludedFactsCount += 1;
    }
  }

  // Estimate tokens saved by pruning
  const prunedMessagesTokens = Math.max(0, messages.length - shortTermMessages.length) * 40;
  const prunedMemoriesTokens = excludedFactsCount * 25;
  const tokensSavedEstimate = prunedMessagesTokens + prunedMemoriesTokens;

  return {
    shortTermMessages,
    relevantLongTermFacts: relevantFacts.slice(0, 5),
    tokensSavedEstimate,
    isPruned: tokensSavedEstimate > 0,
  };
}
