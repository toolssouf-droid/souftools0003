// lib/models/providerModelRegistry.ts
/**
 * Provider Model Capability Matrix & Registry
 * 
 * Provides O(1) in-memory capability lookup for any model across all 40+ providers.
 * Accurately determines:
 * - Parameter Size / Tier (nano: <4B, micro: 4-14B, balanced: 14-72B, frontier: >70B/MoE)
 * - Function Calling (Tool) Support
 * - Vision / Multimodal Support
 * - Context Window Tokens
 * - Latency & Cost Grades
 * - Zero-overhead heuristic fallback for dynamically added models
 */

export type ModelSizeTier = "nano" | "micro" | "balanced" | "frontier";
export type LatencyGrade = "instant" | "fast" | "moderate" | "deliberate";
export type CostGrade = "free" | "ultra_low" | "standard" | "high";

export interface ModelCapabilityProfile {
  modelId: string;
  normalizedName: string;
  sizeTier: ModelSizeTier;
  approxParamsB: number; // approximate parameter count in Billions
  supportsFunctionCalling: boolean;
  supportsStructuredOutput?: boolean;
  supportsVision: boolean;
  supportsSystemPrompt: boolean;
  contextWindowTokens: number;
  maxOutputTokens: number;
  latencyGrade: LatencyGrade;
  costGrade: CostGrade;
  specialties: ("chat" | "coding" | "reasoning" | "vision" | "tools" | "multilingual")[];
  recommendedForSmallTasks: boolean;
}

/**
 * Static In-Memory Matrix of Known Global Models
 * Pre-compiled for O(1) instant memory lookup with 0 CPU overhead.
 */
const KNOWN_MODEL_CAPABILITIES: Record<string, ModelCapabilityProfile> = {
  // --- Google Gemini Series ---
  "gemini-3-flash-preview": {
    modelId: "gemini-3-flash-preview",
    normalizedName: "Gemini 3 Flash Preview",
    sizeTier: "balanced",
    approxParamsB: 35,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 1048576,
    maxOutputTokens: 8192,
    latencyGrade: "instant",
    costGrade: "ultra_low",
    specialties: ["chat", "coding", "reasoning", "vision", "tools", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "gemini-flash-lite-latest": {
    modelId: "gemini-flash-lite-latest",
    normalizedName: "Gemini Flash Lite",
    sizeTier: "micro",
    approxParamsB: 8,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 1048576,
    maxOutputTokens: 8192,
    latencyGrade: "instant",
    costGrade: "ultra_low",
    specialties: ["chat", "tools", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "gemini-3.5-flash-lite": {
    modelId: "gemini-3.5-flash-lite",
    normalizedName: "Gemini 3.5 Flash Lite",
    sizeTier: "micro",
    approxParamsB: 8,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 1048576,
    maxOutputTokens: 8192,
    latencyGrade: "instant",
    costGrade: "ultra_low",
    specialties: ["chat", "tools", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "gemini-flash-latest": {
    modelId: "gemini-flash-latest",
    normalizedName: "Gemini Flash Latest",
    sizeTier: "balanced",
    approxParamsB: 35,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 1048576,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "ultra_low",
    specialties: ["chat", "coding", "reasoning", "vision", "tools", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "gemini-3.1-flash-lite": {
    modelId: "gemini-3.1-flash-lite",
    normalizedName: "Gemini 3.1 Flash Lite",
    sizeTier: "micro",
    approxParamsB: 8,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 1048576,
    maxOutputTokens: 8192,
    latencyGrade: "instant",
    costGrade: "ultra_low",
    specialties: ["chat", "tools", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "gemini-3.8-flash": {
    modelId: "gemini-3.8-flash",
    normalizedName: "Gemini 3.8 Flash",
    sizeTier: "balanced",
    approxParamsB: 35,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 1048576,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "ultra_low",
    specialties: ["chat", "coding", "reasoning", "vision", "tools", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "gemini-3.7-flash": {
    modelId: "gemini-3.7-flash",
    normalizedName: "Gemini 3.7 Flash Hybrid",
    sizeTier: "balanced",
    approxParamsB: 40,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 1048576,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "standard",
    specialties: ["reasoning", "coding", "vision", "tools"],
    recommendedForSmallTasks: false,
  },
  "gemini-3.1-pro-preview": {
    modelId: "gemini-3.1-pro-preview",
    normalizedName: "Gemini 3.1 Pro",
    sizeTier: "frontier",
    approxParamsB: 120,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 2097152,
    maxOutputTokens: 8192,
    latencyGrade: "moderate",
    costGrade: "standard",
    specialties: ["reasoning", "coding", "vision", "tools"],
    recommendedForSmallTasks: false,
  },

  // --- Meta Llama Series (Groq, Cerebras, Together, DeepInfra, Ollama) ---
  "llama-3.1-8b-instant": {
    modelId: "llama-3.1-8b-instant",
    normalizedName: "Llama 3.1 8B Instant",
    sizeTier: "micro",
    approxParamsB: 8,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 131072,
    maxOutputTokens: 8192,
    latencyGrade: "instant",
    costGrade: "ultra_low",
    specialties: ["chat", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "llama-3.3-70b-versatile": {
    modelId: "llama-3.3-70b-versatile",
    normalizedName: "Llama 3.3 70B Versatile",
    sizeTier: "balanced",
    approxParamsB: 70,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 131072,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "standard",
    specialties: ["chat", "coding", "reasoning", "tools"],
    recommendedForSmallTasks: false,
  },
  "meta-llama/llama-3.3-70b-instruct": {
    modelId: "meta-llama/llama-3.3-70b-instruct",
    normalizedName: "Meta Llama 3.3 70B Instruct",
    sizeTier: "balanced",
    approxParamsB: 70,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 131072,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "standard",
    specialties: ["coding", "reasoning", "tools"],
    recommendedForSmallTasks: false,
  },

  // --- OpenAI Series ---
  "gpt-4o-mini": {
    modelId: "gpt-4o-mini",
    normalizedName: "GPT-4o Mini",
    sizeTier: "micro",
    approxParamsB: 12,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 128000,
    maxOutputTokens: 16384,
    latencyGrade: "fast",
    costGrade: "ultra_low",
    specialties: ["chat", "tools", "vision"],
    recommendedForSmallTasks: true,
  },
  "gpt-4o": {
    modelId: "gpt-4o",
    normalizedName: "GPT-4o Omni",
    sizeTier: "frontier",
    approxParamsB: 180,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 128000,
    maxOutputTokens: 16384,
    latencyGrade: "moderate",
    costGrade: "high",
    specialties: ["reasoning", "coding", "vision", "tools"],
    recommendedForSmallTasks: false,
  },
  "o1": {
    modelId: "o1",
    normalizedName: "OpenAI o1 Reasoning",
    sizeTier: "frontier",
    approxParamsB: 200,
    supportsFunctionCalling: false, // o1 focuses strictly on pure thought tokens
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 200000,
    maxOutputTokens: 100000,
    latencyGrade: "deliberate",
    costGrade: "high",
    specialties: ["reasoning", "coding"],
    recommendedForSmallTasks: false,
  },
  "o3-mini": {
    modelId: "o3-mini",
    normalizedName: "OpenAI o3 Mini",
    sizeTier: "balanced",
    approxParamsB: 30,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 200000,
    maxOutputTokens: 100000,
    latencyGrade: "fast",
    costGrade: "standard",
    specialties: ["reasoning", "coding", "tools"],
    recommendedForSmallTasks: false,
  },

  // --- Anthropic Claude Series ---
  "claude-3-5-sonnet-latest": {
    modelId: "claude-3-5-sonnet-latest",
    normalizedName: "Claude 3.5 Sonnet",
    sizeTier: "frontier",
    approxParamsB: 150,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 200000,
    maxOutputTokens: 8192,
    latencyGrade: "moderate",
    costGrade: "high",
    specialties: ["coding", "reasoning", "vision", "tools"],
    recommendedForSmallTasks: false,
  },
  "claude-3-5-haiku-latest": {
    modelId: "claude-3-5-haiku-latest",
    normalizedName: "Claude 3.5 Haiku",
    sizeTier: "micro",
    approxParamsB: 14,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 200000,
    maxOutputTokens: 8192,
    latencyGrade: "instant",
    costGrade: "ultra_low",
    specialties: ["chat", "coding", "tools"],
    recommendedForSmallTasks: true,
  },

  // --- DeepSeek Series ---
  "deepseek-chat": {
    modelId: "deepseek-chat",
    normalizedName: "DeepSeek V3",
    sizeTier: "frontier",
    approxParamsB: 671, // MoE with 37B active
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 65536,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "ultra_low",
    specialties: ["chat", "coding", "reasoning", "multilingual"],
    recommendedForSmallTasks: true,
  },
  "deepseek-reasoner": {
    modelId: "deepseek-reasoner",
    normalizedName: "DeepSeek R1",
    sizeTier: "frontier",
    approxParamsB: 671,
    supportsFunctionCalling: false, // Pure CoT reasoning
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 65536,
    maxOutputTokens: 8192,
    latencyGrade: "deliberate",
    costGrade: "ultra_low",
    specialties: ["reasoning", "coding"],
    recommendedForSmallTasks: false,
  },
  "deepseek-coder": {
    modelId: "deepseek-coder",
    normalizedName: "DeepSeek Coder V2",
    sizeTier: "balanced",
    approxParamsB: 236,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 131072,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "ultra_low",
    specialties: ["coding", "tools"],
    recommendedForSmallTasks: false,
  },

  // --- Alibaba Qwen Series ---
  "qwen2.5-coder-32b": {
    modelId: "qwen2.5-coder-32b",
    normalizedName: "Qwen 2.5 Coder 32B",
    sizeTier: "balanced",
    approxParamsB: 32,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 131072,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "ultra_low",
    specialties: ["coding", "tools"],
    recommendedForSmallTasks: false,
  },
  "qwen-max": {
    modelId: "qwen-max",
    normalizedName: "Qwen Max",
    sizeTier: "frontier",
    approxParamsB: 110,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsSystemPrompt: true,
    contextWindowTokens: 32768,
    maxOutputTokens: 8192,
    latencyGrade: "moderate",
    costGrade: "standard",
    specialties: ["reasoning", "coding", "multilingual"],
    recommendedForSmallTasks: false,
  },

  // --- Mistral AI Series ---
  "mistral-large-latest": {
    modelId: "mistral-large-latest",
    normalizedName: "Mistral Large",
    sizeTier: "frontier",
    approxParamsB: 123,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 131072,
    maxOutputTokens: 8192,
    latencyGrade: "fast",
    costGrade: "standard",
    specialties: ["reasoning", "coding", "multilingual", "tools"],
    recommendedForSmallTasks: false,
  },
  "codestral-latest": {
    modelId: "codestral-latest",
    normalizedName: "Codestral 22B",
    sizeTier: "balanced",
    approxParamsB: 22,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsSystemPrompt: true,
    contextWindowTokens: 32768,
    maxOutputTokens: 8192,
    latencyGrade: "instant",
    costGrade: "ultra_low",
    specialties: ["coding", "tools"],
    recommendedForSmallTasks: false,
  },
};

/**
 * Dynamic Custom Model Registry
 * Allows custom models registered by user/admin to be stored with fine-grained capabilities.
 */
const dynamicRegistry = new Map<string, ModelCapabilityProfile>();

/**
 * Zero-Compute Heuristic Classifier
 * Legacy callers may request a heuristic for display/triage. Routing decisions
 * must use getRegisteredModelCapabilityProfile instead.
 */
export function deduceModelCapability(rawModelId: string): ModelCapabilityProfile {
  const cleanId = (rawModelId || "").toLowerCase().trim();

  // 1. Direct Cache Lookup
  if (KNOWN_MODEL_CAPABILITIES[cleanId]) {
    return KNOWN_MODEL_CAPABILITIES[cleanId];
  }
  if (dynamicRegistry.has(cleanId)) {
    return dynamicRegistry.get(cleanId)!;
  }

  // 2. Fast Parameter Size Detection from Name Patterns
  let sizeTier: ModelSizeTier = "balanced";
  let approxParamsB = 20;

  if (/(?:1b|2b|3b|nano|tiny|pico)/i.test(cleanId)) {
    sizeTier = "nano";
    approxParamsB = 2;
  } else if (/(?:7b|8b|9b|12b|13b|14b|mini|small|lite|flash-lite|haiku)/i.test(cleanId)) {
    sizeTier = "micro";
    approxParamsB = 8;
  } else if (/(?:70b|72b|plus|pro|versatile)/i.test(cleanId)) {
    sizeTier = "balanced";
    approxParamsB = 70;
  } else if (/(?:405b|r1|opus|max|ultra|large|o1|gpt-4o$)/i.test(cleanId)) {
    sizeTier = "frontier";
    approxParamsB = 150;
  }

  // 3. Capability Flags Detection
  const isReasoningOnly = /o1|reasoner|deepseek-r1/i.test(cleanId);
  const supportsFunctionCalling = !isReasoningOnly && !/instruct-only|text-only/i.test(cleanId);
  const supportsVision = /vision|pixtral|vl|omni|gpt-4o|gemini|sonnet|claude-3/i.test(cleanId);
  const isCoding = /code|coder|codestral|starcoder/i.test(cleanId);

  // 4. Latency Grade
  let latencyGrade: LatencyGrade = "fast";
  if (sizeTier === "nano" || sizeTier === "micro" || cleanId.includes("flash") || cleanId.includes("instant")) {
    latencyGrade = "instant";
  } else if (sizeTier === "frontier" || isReasoningOnly) {
    latencyGrade = isReasoningOnly ? "deliberate" : "moderate";
  }

  // 5. Cost Grade
  const costGrade: CostGrade = sizeTier === "frontier" ? "high" : sizeTier === "balanced" ? "standard" : "ultra_low";

  const profile: ModelCapabilityProfile = {
    modelId: rawModelId,
    normalizedName: rawModelId,
    sizeTier,
    approxParamsB,
    supportsFunctionCalling,
    supportsVision,
    supportsSystemPrompt: true,
    contextWindowTokens: sizeTier === "frontier" ? 131072 : 65536,
    maxOutputTokens: 8192,
    latencyGrade,
    costGrade,
    specialties: [
      isCoding ? "coding" : "chat",
      isReasoningOnly ? "reasoning" : "tools",
      supportsVision ? "vision" : "chat"
    ].filter(Boolean) as any,
    recommendedForSmallTasks: sizeTier === "nano" || sizeTier === "micro",
  };

  return profile;
}

export function getRegisteredModelCapabilityProfile(rawModelId: string): ModelCapabilityProfile | null {
  const cleanId = rawModelId.toLowerCase().trim();
  return KNOWN_MODEL_CAPABILITIES[cleanId] || dynamicRegistry.get(cleanId) || null;
}

/**
 * Get Model Capability Profile for any model ID (SoufAI Tier or Raw Provider Model)
 */
export function getModelCapabilityProfile(modelIdOrTier: string, fallbackModelName?: string): ModelCapabilityProfile {
  // If SoufAI tier is passed (spark, core, pro, ultra)
  const tierMap: Record<string, string> = {
    spark: "gemini-3-flash-preview",
    core: "gemini-3-flash-preview",
    pro: "claude-3-5-sonnet-latest",
    ultra: "deepseek-reasoner",
  };

  const lookupKey = tierMap[modelIdOrTier] || fallbackModelName || modelIdOrTier;
  return deduceModelCapability(lookupKey);
}

/**
 * Register a custom model capability profile into memory
 */
export function registerCustomModelCapability(profile: ModelCapabilityProfile): void {
  dynamicRegistry.set(profile.modelId.toLowerCase().trim(), profile);
}

/**
 * Retrieve all registered models as a list for monitoring / admin dashboard
 */
export function getAllRegisteredModelProfiles(): ModelCapabilityProfile[] {
  const combined = new Map<string, ModelCapabilityProfile>();
  Object.values(KNOWN_MODEL_CAPABILITIES).forEach((p) => combined.set(p.modelId, p));
  dynamicRegistry.forEach((p, k) => combined.set(k, p));
  return Array.from(combined.values());
}
