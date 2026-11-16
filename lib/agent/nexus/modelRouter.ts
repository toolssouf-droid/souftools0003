/**
 * SoufAI Nexus Engine — strict, capability-aware model routing.
 */

import { AI_PROVIDERS } from "@/lib/providers";
import {
  executeRoutedPrompt,
  isChatProviderSupported,
  type RouterExecuteOptions,
  type RouterExecutionResult,
} from "@/lib/router";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";
import {
  getRegisteredModelCapabilityProfile,
  type ModelCapabilityProfile,
} from "@/lib/models/providerModelRegistry";
import { healthManager } from "@/lib/healthManager";
import { getAbortError, isAbortError, throwIfAborted } from "../engine/abort";
import type {
  NexusModelRoutingCriteria,
  NexusModelSelectionDecision,
  NexusModelTier,
} from "./types";

const TIER_BASE_ORDER: NexusModelTier[] = ["spark", "core", "pro", "ultra"];
const MAX_ROUTING_ATTEMPTS = 3;

type AdminConfig = Awaited<ReturnType<typeof loadServerAdminConfig>>;

interface ProviderConfig {
  providerId: string;
  models: string[];
  activeModels: string[];
  priority: number;
  keys: string[];
  baseUrl?: string;
  capabilities?: Record<string, unknown>;
  modelCapabilities?: Record<string, Record<string, unknown>>;
  enabled: boolean;
}

interface EligibleCandidate {
  tier: NexusModelTier;
  providerId: string;
  model: string;
  score: number;
  reason: string;
  priority: number;
  keys: string[];
  baseUrl?: string;
}

interface Selection {
  decision: NexusModelSelectionDecision;
  candidates: EligibleCandidate[];
}

export class NexusModelRoutingError extends Error {
  public readonly failures: Array<{ providerId: string; model: string; code: string }>;

  constructor(failures: Array<{ providerId: string; model: string; code: string }>) {
    super(
      `NexusModelRouter: No configured model completed the request (${failures
        .map((failure) => `${failure.providerId}/${failure.model}: ${failure.code}`)
        .join("; ")}).`
    );
    this.name = "NexusModelRoutingError";
    this.failures = failures;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function configuredKey(value: unknown): string | null {
  if (typeof value === "string") {
    const key = value.trim();
    return key.length >= 8 && !/demo[-_ ]?key/i.test(key) ? key : null;
  }
  if (!isRecord(value)) return null;
  return configuredKey(value.key) || configuredKey(value.apiToken);
}

function hasEnvironmentKey(providerId: string): boolean {
  const prefix = providerId.toUpperCase();
  const singular = process.env[`${prefix}_API_KEY`];
  const plural = process.env[`${prefix}_API_KEYS`];
  if (
    (singular && configuredKey(singular)) ||
    (plural && plural.split(/[\r\n,;]+/).some((value) => configuredKey(value)))
  ) {
    return true;
  }
  if (providerId === "bedrock") {
    return Boolean(
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      configuredKey(process.env.AWS_BEARER_TOKEN_BEDROCK)
    );
  }
  if (providerId === "cloudflare") {
    return Boolean(configuredKey(process.env.CLOUDFLARE_API_TOKEN));
  }
  return false;
}

function providerConfigsForTier(config: AdminConfig, tier: string): ProviderConfig[] {
  const rawProviders = config.modelProviders;
  if (!isRecord(rawProviders) || !Array.isArray(rawProviders[tier])) return [];

  return rawProviders[tier].flatMap((raw): ProviderConfig[] => {
    if (!isRecord(raw) || typeof raw.providerId !== "string" || !raw.providerId.trim()) return [];
    const providerId = raw.providerId.trim();
    const providerDefinition = AI_PROVIDERS.find(
      (provider) => provider.id === providerId && provider.category === "llm"
    );
    if (!providerDefinition || !isChatProviderSupported(providerId)) return [];

    const models = stringArray(raw.models);
    const configuredModels = models.length > 0
      ? models
      : typeof raw.defaultAgentModel === "string" && raw.defaultAgentModel.trim()
      ? [raw.defaultAgentModel.trim()]
      : [];
    const rawActiveModels =
      raw.activeModels === undefined ? configuredModels : stringArray(raw.activeModels);
    const activeModels =
      configuredModels.length > 0
        ? rawActiveModels.filter((model) => configuredModels.includes(model))
        : rawActiveModels;
    const rawKeys = Array.isArray(raw.keys) ? raw.keys : [];
    const globalKeys = isRecord(config.keys) && Array.isArray(config.keys[providerId])
      ? config.keys[providerId]
      : [];
    const keys = Array.from(
      new Set([...rawKeys, ...globalKeys].map(configuredKey).filter((key): key is string => Boolean(key)))
    );
    const enabled = raw.enabled !== false && raw.status !== "disabled" &&
      (!providerDefinition.requiresKey || keys.length > 0 || hasEnvironmentKey(providerId));

    return [{
      providerId,
      models,
      activeModels,
      priority: typeof raw.priority === "number" && Number.isFinite(raw.priority) ? raw.priority : 1,
      keys,
      baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : undefined,
      capabilities: isRecord(raw.capabilities) ? raw.capabilities : undefined,
      modelCapabilities: isRecord(raw.modelCapabilities)
        ? raw.modelCapabilities as Record<string, Record<string, unknown>>
        : undefined,
      enabled,
    }];
  });
}

function modelProfileFor(
  model: string,
  provider: ProviderConfig
): (ModelCapabilityProfile & { supportsStructuredOutput: boolean }) | null {
  const registered = getRegisteredModelCapabilityProfile(model);
  if (!registered || registered.modelId !== model) return null;

  const providerCapabilities = provider.modelCapabilities?.[model] || provider.capabilities || {};
  const boolOverride = (key: string, fallback: boolean | undefined): boolean =>
    typeof providerCapabilities[key] === "boolean"
      ? providerCapabilities[key] as boolean
      : Boolean(fallback);
  const numberOverride = (key: string, fallback: number): number =>
    typeof providerCapabilities[key] === "number" &&
    Number.isFinite(providerCapabilities[key]) &&
    (providerCapabilities[key] as number) > 0
      ? providerCapabilities[key] as number
      : fallback;
  const specialties = Array.isArray(providerCapabilities.specialties)
    ? providerCapabilities.specialties.filter(
        (value): value is ModelCapabilityProfile["specialties"][number] =>
          typeof value === "string" &&
          ["chat", "coding", "reasoning", "vision", "tools", "multilingual"].includes(value)
      )
    : registered.specialties;

  return {
    ...registered,
    supportsFunctionCalling: boolOverride("supportsFunctionCalling", registered.supportsFunctionCalling),
    supportsStructuredOutput: boolOverride(
      "supportsStructuredOutput",
      registered.supportsStructuredOutput
    ),
    supportsVision: boolOverride("supportsVision", registered.supportsVision),
    contextWindowTokens: numberOverride("contextWindowTokens", registered.contextWindowTokens),
    maxOutputTokens: numberOverride("maxOutputTokens", registered.maxOutputTokens),
    specialties,
  };
}

function estimateCostScore(profile: ModelCapabilityProfile): number {
  switch (profile.costGrade) {
    case "ultra_low": return 30;
    case "standard": return 20;
    case "high": return 5;
    default: return 10;
  }
}

function estimateLatencyScore(profile: ModelCapabilityProfile): number {
  switch (profile.latencyGrade) {
    case "instant": return 30;
    case "fast": return 22;
    case "moderate": return 12;
    case "deliberate": return 4;
    default: return 10;
  }
}

function classifyFailure(error: unknown, result?: RouterExecutionResult): { code: string; retryable: boolean } {
  const text = [
    error instanceof Error ? error.message : String(error ?? ""),
    result?.failureCode || "",
    ...(result?.errorLog || []),
  ].join(" ").toLowerCase();

  if (/401|403|unauthorized|forbidden|invalid[_ ]api[_ ]key|api key not valid|permission denied/.test(text)) {
    return { code: "AUTH_OR_PERMISSION", retryable: false };
  }
  if (/400|invalid[_ ]request|schema|unsupported capability|unsupported model|configuration/.test(text)) {
    return { code: "INVALID_CONFIGURATION_OR_REQUEST", retryable: false };
  }
  if (/429|rate.?limit|quota|timeout|timed out|network|fetch failed|econn|temporar|5\d\d|server error/.test(text)) {
    return { code: "TRANSIENT_PROVIDER_FAILURE", retryable: true };
  }
  return { code: "UNCLASSIFIED_PROVIDER_FAILURE", retryable: false };
}

export class NexusModelRouter {
  private readonly loadConfig: () => Promise<AdminConfig>;
  private readonly executePrompt: (options: RouterExecuteOptions) => Promise<RouterExecutionResult>;
  private readonly wait: (durationMs: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;

  constructor(dependencies: {
    loadConfig?: () => Promise<AdminConfig>;
    executePrompt?: (options: RouterExecuteOptions) => Promise<RouterExecutionResult>;
    wait?: (durationMs: number, signal?: AbortSignal) => Promise<void>;
    random?: () => number;
  } = {}) {
    this.loadConfig = dependencies.loadConfig || (() => loadServerAdminConfig({ strict: true }));
    this.executePrompt = dependencies.executePrompt || executeRoutedPrompt;
    this.wait = dependencies.wait || ((durationMs, signal) =>
      new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(getAbortError(signal));
          return;
        }
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, durationMs);
        const onAbort = () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          reject(getAbortError(signal));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      }));
    this.random = dependencies.random || Math.random;
  }

  private async buildSelection(criteria: NexusModelRoutingCriteria): Promise<Selection> {
    const adminConfig = await this.loadConfig();
    const activeTiers = Array.isArray(adminConfig.activeModelTiers)
      ? adminConfig.activeModelTiers
      : [];
    const configuredProviders = adminConfig.modelProviders;
    if (!activeTiers.length || !isRecord(configuredProviders) || !Object.keys(configuredProviders).length) {
      throw new Error("NexusModelRouter: Active tiers or provider configuration are missing.");
    }

    const rawPool = Array.from(new Set<NexusModelTier>([
      ...(criteria.preferredTiers || []),
      ...(criteria.fallbackTiers || []),
      ...TIER_BASE_ORDER,
    ]));
    const evaluated: NexusModelSelectionDecision["candidatesEvaluated"] = [];
    const candidates: EligibleCandidate[] = [];

    for (const tier of rawPool) {
      if (!activeTiers.includes(tier)) {
        evaluated.push({
          tier,
          providerId: "none",
          model: "none",
          score: -100,
          available: false,
          reason: "Disabled in admin activeModelTiers.",
        });
        continue;
      }

      const providers = providerConfigsForTier(adminConfig, tier).sort((a, b) => a.priority - b.priority);
      if (!providers.length) {
        evaluated.push({
          tier,
          providerId: "none",
          model: "none",
          score: -100,
          available: false,
          reason: "No supported, configured chat provider.",
        });
        continue;
      }

      for (const provider of providers) {
        if (!provider.enabled) {
          evaluated.push({
            tier,
            providerId: provider.providerId,
            model: "none",
            score: -100,
            available: false,
            reason: "Provider is disabled or has no configured credential.",
          });
          continue;
        }
        if (!provider.activeModels.length) {
          evaluated.push({
            tier,
            providerId: provider.providerId,
            model: "none",
            score: -100,
            available: false,
            reason: "No active model is explicitly configured.",
          });
          continue;
        }

        for (const model of provider.activeModels) {
          const profile = modelProfileFor(model, provider);
          if (!profile) {
            evaluated.push({
              tier,
              providerId: provider.providerId,
              model,
              score: -100,
              available: false,
              reason: "Exact model capability metadata is unavailable.",
            });
            continue;
          }
          const missing: string[] = [];
          if (profile.contextWindowTokens < criteria.minContextTokens) missing.push("context_window");
          if (criteria.requiresStructuredOutput && !profile.supportsStructuredOutput) {
            missing.push("structured_output");
          }
          if (criteria.requiresToolCalling && !profile.supportsFunctionCalling) missing.push("tool_calling");
          if (criteria.requiresVision && !profile.supportsVision) missing.push("vision");
          if (
            (criteria.requiresReasoning || criteria.taskComplexity === "high" ||
              criteria.taskComplexity === "frontier") &&
            !profile.specialties.includes("reasoning")
          ) missing.push("reasoning");
          if (criteria.requiresCoding && !profile.specialties.includes("coding")) missing.push("coding");

          const quarantine = healthManager.isModelQuarantined(provider.providerId, model, false);
          if (quarantine.quarantined) missing.push("quarantined");
          if (missing.length) {
            evaluated.push({
              tier,
              providerId: provider.providerId,
              model,
              score: -100,
              available: false,
              reason: `Ineligible: ${missing.join(", ")}.`,
            });
            continue;
          }

          let score = criteria.preferredTiers?.includes(tier) ? 35 : 0;
          score += 25;
          if (criteria.requiresStructuredOutput) score += 15;
          if (criteria.requiresVision) score += 40;
          if (criteria.requiresCoding) score += 25;
          if (criteria.requiresReasoning || criteria.taskComplexity === "high" ||
            criteria.taskComplexity === "frontier") score += profile.sizeTier === "frontier" ? 35 : 15;
          if (criteria.latencyPreference === "instant") score += estimateLatencyScore(profile);
          if (criteria.latencyPreference === "balanced") score += Math.round(estimateLatencyScore(profile) * 0.5);
          if (criteria.costSensitivity === "ultra_low") score += estimateCostScore(profile);
          if (criteria.costSensitivity === "standard") score += Math.round(estimateCostScore(profile) * 0.5);

          const reasons = [
            criteria.preferredTiers?.includes(tier) ? "preferred_tier" : "",
            criteria.requiresCoding ? "coding_specialty" : "",
            criteria.requiresReasoning ? "reasoning" : "",
          ].filter(Boolean);
          candidates.push({
            tier,
            providerId: provider.providerId,
            model,
            score,
            reason: reasons.join(", ") || "capability_match",
            priority: provider.priority,
            keys: provider.keys,
            baseUrl: provider.baseUrl,
          });
          evaluated.push({
            tier,
            providerId: provider.providerId,
            model,
            score,
            available: true,
            reason: reasons.join(", ") || "capability_match",
          });
        }
      }
    }

    candidates.sort((a, b) =>
      b.score - a.score || a.priority - b.priority || rawPool.indexOf(a.tier) - rawPool.indexOf(b.tier)
    );
    const winner = candidates[0];
    if (!winner) {
      throw new Error(
        `NexusModelRouter: No configured model satisfies the requested capabilities. ${evaluated
          .filter((candidate) => !candidate.available)
          .map((candidate) => `${candidate.tier}/${candidate.providerId}/${candidate.model}: ${candidate.reason}`)
          .join("; ")}`
      );
    }

    const fallbackCandidates = candidates.slice(1).map(({ tier, providerId, model }) => ({
      tier,
      providerId,
      model,
    }));
    return {
      candidates,
      decision: {
        selectedTier: winner.tier,
        selectedModel: winner.model,
        selectedProvider: winner.providerId,
        reason: `Selected exact configured model ${winner.providerId}/${winner.model}.`,
        candidatesEvaluated: evaluated,
        fallbackChain: Array.from(new Set(fallbackCandidates.map((candidate) => candidate.tier))),
        fallbackCandidates,
        adminEnforced: true,
      },
    };
  }

  public async selectModel(
    criteria: NexusModelRoutingCriteria
  ): Promise<NexusModelSelectionDecision> {
    return (await this.buildSelection(criteria)).decision;
  }

  public async executeWithRouting(
    criteria: NexusModelRoutingCriteria,
    request: Omit<RouterExecuteOptions, "modelId"> & { explicitModelId?: NexusModelTier }
  ): Promise<{ result: RouterExecutionResult; decision: NexusModelSelectionDecision }> {
    throwIfAborted(request.signal);
    const selection = await this.buildSelection({
      ...criteria,
      preferredTiers: request.explicitModelId
        ? [request.explicitModelId, ...(criteria.preferredTiers || [])]
        : criteria.preferredTiers,
    });
    throwIfAborted(request.signal);
    const attempted = selection.candidates.slice(0, MAX_ROUTING_ATTEMPTS);
    const failures: Array<{ providerId: string; model: string; code: string }> = [];

    for (let index = 0; index < attempted.length; index += 1) {
      throwIfAborted(request.signal);
      const candidate = attempted[index];
      const assignments = {
        [candidate.tier]: [{
          providerId: candidate.providerId,
          model: candidate.model,
          models: [candidate.model],
          activeModels: [candidate.model],
          keys: candidate.keys,
          baseUrl: candidate.baseUrl,
          priority: 1,
        }],
      };

      try {
        const result = await this.executePrompt({
          ...request,
          modelId: candidate.tier,
          firestoreAssignments: assignments,
          firestoreKeys: { [candidate.providerId]: candidate.keys },
          strictModelSelection: true,
        });
        throwIfAborted(request.signal);
        if (
          result.providerUsed === candidate.providerId &&
          result.modelUsed === candidate.model &&
          result.text.trim().length > 0
        ) {
          const decision: NexusModelSelectionDecision = {
            ...selection.decision,
            selectedTier: candidate.tier,
            selectedModel: candidate.model,
            selectedProvider: candidate.providerId,
            reason: index === 0
            ? selection.decision.reason
            : `${selection.decision.reason} Fell back after: ${failures[failures.length - 1]?.code || "transient failure"}.`,
          };
          return {
            result: {
              ...result,
              errorLog: failures.length
                ? [...(result.errorLog || []), ...failures.map((failure) =>
                    `Fallback ${failure.providerId}/${failure.model} failed: ${failure.code}`)]
                : result.errorLog,
            },
            decision,
          };
        }

        const failure = classifyFailure(undefined, result);
        failures.push({
          providerId: candidate.providerId,
          model: candidate.model,
          code: result.failureCode || failure.code,
        });
        if (!failure.retryable) break;
      } catch (error) {
        if (isAbortError(error, request.signal)) throw getAbortError(request.signal);
        const failure = classifyFailure(error);
        failures.push({
          providerId: candidate.providerId,
          model: candidate.model,
          code: failure.code,
        });
        if (!failure.retryable) break;
      }

      if (index + 1 < attempted.length) {
        const backoffMs = Math.min(500 * 2 ** index, 4000) + Math.floor(this.random() * 100);
        await this.wait(backoffMs, request.signal);
      }
    }

    throw new NexusModelRoutingError(failures);
  }
}

export const nexusModelRouter = new NexusModelRouter();
