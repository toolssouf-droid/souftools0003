import { GoogleGenAI } from "@google/genai";
import { SOUFAI_MODELS, SoufAIModelDef } from "./providers";
import { decryptKey } from "./encryption";
import { loadServerAdminConfig } from "./adminConfigStore";
import { healthManager } from "./healthManager";
import { keyPoolManager } from "./providers/keyPoolManager";
import { responseCache } from "./providers/responseCache";
import { requestDispatcher } from "./providers/requestDispatcher";
import { HeaderShuffler } from "./providers/headerShuffler";
import {
  ALL_ROUTABLE_CHAT_PROVIDERS,
  executeRestChatRequest,
  getChatEndpointForProvider,
} from "./providers/providerAdapters";
import { createLocaleContext, buildMultilingualSystemPrompt } from "./i18n";
import { serverErrorManager } from "./errors/errorManager";
import { getModelCapabilityProfile } from "./models/providerModelRegistry";
import { triageRequestIntent } from "./router/zeroComputeTriage";
import { terminalLogger } from "@/lib/logger/terminalLogger";
import { getAbortError, throwIfAborted } from "@/lib/agent/engine/abort";

function normalizeGeminiModel(modelName: string): string {
  if (!modelName) return "";
  let clean = modelName.trim();
  if (clean.startsWith("models/")) {
    clean = clean.slice(7);
  }
  return clean;
}

const ROUTABLE_CHAT_PROVIDERS = ALL_ROUTABLE_CHAT_PROVIDERS;

export function isChatProviderSupported(providerId: string): boolean {
  return ROUTABLE_CHAT_PROVIDERS.has((providerId || "").trim().toLowerCase());
}

function attachCloudflareAccountId(providerId: string, key: string, accountId?: string): string {
  const cleanAccountId = accountId?.trim();
  if (
    providerId !== "cloudflare" ||
    !cleanAccountId ||
    !/^[a-f0-9]{16,64}$/i.test(cleanAccountId) ||
    /^[a-f0-9]{16,64}[:|]/i.test(key)
  ) {
    return key;
  }
  return `${cleanAccountId}:${key}`;
}

// Re-export endpoint lookup for any external diagnostics
export { getChatEndpointForProvider };

function isNonChatModel(modelName: string): boolean {
  if (!modelName) return false;
  const clean = modelName.toLowerCase();
  return (
    clean.includes("whisper") ||
    clean.includes("tts") ||
    clean.includes("speech") ||
    clean.includes("embed") ||
    clean.includes("bge-") ||
    clean.includes("gte-") ||
    clean.includes("guard") ||
    clean.includes("moderation") ||
    clean.includes("safety") ||
    clean.includes("conformer") ||
    clean.includes("audio-transcription")
  );
}

function resolveSafeChatModel(providerId: string, modelName: string): string {
  if (!modelName) return "";
  const clean = modelName.trim();

  // Shield against deprecated Google Gemini models (prevent 404 NOT_FOUND)
  if (providerId === "gemini") {
    if (clean.includes("2.5-pro") || clean.includes("1.5-pro") || clean === "gemini-pro") {
      return "gemini-3.1-pro-preview";
    }
    if (clean.includes("2.5-flash") || clean.includes("1.5-flash") || clean === "gemini-flash") {
      return "gemini-3.7-flash";
    }
  }

  if (!isNonChatModel(clean)) {
    // If it's a community preview model with strict 8k TPM limits on Groq, fallback to high-capacity production models
    if (providerId === "groq" && (clean.includes("gpt-oss-120b") || clean.includes("gpt-oss-20b"))) {
      return "llama-3.3-70b-versatile";
    }
    return clean;
  }
  if (providerId === "groq") return "llama-3.3-70b-versatile";
  if (providerId === "openai") return "gpt-4o-mini";
  if (providerId === "anthropic") return "claude-3-5-sonnet-latest";
  if (providerId === "mistral") return "mistral-large-latest";
  return clean;
}

function cleanBase64(base64: string): string {
  if (base64.includes(";base64,")) {
    return base64.split(";base64,")[1];
  }
  return base64;
}

function getAttachmentTextContext(attachments: any[]): string {
  let context = "";
  for (const att of attachments) {
    if (att.type === 'file' && att.mimeType && att.mimeType.startsWith('text/')) {
      try {
        let text = "";
        if (att.data.includes(";base64,")) {
          const base64Str = att.data.split(";base64,")[1];
          text = Buffer.from(base64Str, 'base64').toString('utf-8');
        } else {
          text = att.data;
        }
        context += `\n\n--- محتوى الملف المرفق (${att.name}) ---\n${text}\n--- نهاية الملف ---`;
      } catch (err) {
        console.warn("Error decoding attachment text:", err);
      }
    }
  }
  return context;
}

export interface ProviderAssignment {
  providerId: string;
  accountId?: string;
  model: string;
  models?: string[];
  activeModels?: string[];
  systemPrompt?: string;
  keys: string[]; // encrypted or plaintext
  priority: number;
}

export interface RouterExecuteOptions {
  modelId: "spark" | "core" | "pro" | "coder" | "ultra" | "vision" | "writer" | "lite_free";
  prompt: string;
  messages?: { role: "user" | "model" | "assistant" | "system"; content: string }[];
  webSearchEnabled?: boolean;
  firestoreAssignments?: Record<string, ProviderAssignment[]>;
  firestoreKeys?: Record<string, string[]>;
  attachments?: any[];
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: any;
  userLocale?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  strictModelSelection?: boolean;
  cacheResponse?: boolean;
  onToken?: (token: string) => void;
}

export interface RouterExecutionResult {
  text: string;
  providerUsed: string;
  modelUsed: string;
  keyUsedMasked: string;
  attemptsCount: number;
  fallbackOccurred: boolean;
  fallbackToFree?: boolean;
  deductCredits?: boolean;
  errorLog?: string[];
  failureCode?: string;
  triageStrategy?: string;
  modelSizeTier?: string;
  triageLatencyUs?: number;
}

function safeProviderFailureLabel(status?: number, error?: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (status === 401 || status === 403 || /invalid.*api.?key|unauthorized|forbidden/.test(message)) {
    return "authentication_or_permission_failure";
  }
  if (status === 429 || /rate.?limit|quota/.test(message)) return "rate_limited";
  if (status === 400 || /invalid request|schema|unsupported capability/.test(message)) {
    return "invalid_request";
  }
  if (name === "AbortError" || /timeout|timed out/.test(message)) return "timeout";
  if (status && status >= 500) return "provider_server_error";
  return "provider_or_network_error";
}

/**
 * Smart Fallback Execution Algorithm
 */
export async function executeRoutedPrompt(options: RouterExecuteOptions): Promise<RouterExecutionResult> {
  const { modelId, prompt, messages = [], firestoreAssignments, firestoreKeys, attachments = [] } = options;
  throwIfAborted(options.signal);
  const modelDef: SoufAIModelDef = SOUFAI_MODELS[modelId] || SOUFAI_MODELS.core;
  
  let finalAssignments = firestoreAssignments;
  let finalKeys = firestoreKeys;

  let activeModelTiers: string[] | undefined = undefined;

  if (!finalAssignments) {
    try {
      const config = await loadServerAdminConfig();
      if (config) {
        if (config.activeModelTiers !== undefined) {
          activeModelTiers = config.activeModelTiers;
        }
        if (config.modelProviders && Object.keys(config.modelProviders).length > 0) {
          finalAssignments = {};
          finalKeys = {};
          Object.keys(config.modelProviders).forEach((mId) => {
            const providers = config.modelProviders[mId] || [];
            finalAssignments![mId] = providers.map((p: any) => ({
              providerId: p.providerId,
              accountId: typeof p.accountId === "string" ? p.accountId.trim() : undefined,
              model: p.defaultAgentModel || p.models?.[0] || "",
              models: p.models || [],
              activeModels: p.activeModels !== undefined ? p.activeModels : (p.models || []),
              priority: p.priority || 1,
              keys: (p.keys || []).map((k: any) => typeof k === "string" ? k : (k?.key || "")),
            }));
            
            providers.forEach((p: any) => {
              if (!finalKeys![p.providerId]) {
                finalKeys![p.providerId] = [];
              }
              (p.keys || []).forEach((k: any) => {
                const rawKeyStr = typeof k === "string" ? k : (k?.key || "");
                if (rawKeyStr && !finalKeys![p.providerId].includes(rawKeyStr)) {
                  finalKeys![p.providerId].push(rawKeyStr);
                }
              });
            });
          });
        }
      }
    } catch (e) {
      console.error("Router config load error:", e);
    }
  }

  // If activeModelTiers is explicitly configured and this modelId is not enabled, block execution
  if (activeModelTiers !== undefined && !activeModelTiers.includes(modelId)) {
    return {
      text: `عفواً، النموذج المطلوب (${modelDef.nameAr}) غير مفعّل حالياً من قبل مدير النظام. يرجى تفعيل النموذج من لوحة التحكم أو اختيار نموذج مفعّل آخر.`,
      providerUsed: "none",
      modelUsed: modelId,
      keyUsedMasked: "none",
      attemptsCount: 0,
      fallbackOccurred: false,
      errorLog: [`[Blocked] Model ${modelId} is currently disabled in activeModelTiers`],
    };
  }

  // 1. Get providers list explicitly assigned by Admin for this model tier
  let providersToTry: { providerId: string; accountId?: string; model: string; models?: string[]; activeModels?: string[]; systemPrompt?: string; priority: number; keys?: string[] }[] = [];
  
  if (finalAssignments && Object.keys(finalAssignments).length > 0) {
    if (finalAssignments[modelId] && finalAssignments[modelId].length > 0) {
      providersToTry = finalAssignments[modelId].map(p => ({
        providerId: p.providerId,
        accountId: p.accountId,
        model: p.model,
        models: p.models,
        activeModels: p.activeModels,
        systemPrompt: p.systemPrompt,
        priority: p.priority || 1,
        keys: (p as any).keys || [],
      })).sort((a, b) => a.priority - b.priority);
    } else {
      providersToTry = [];
    }
  } else {
    // Initial server baseline using server's active Gemini key until customized in Admin Dashboard
    providersToTry = (modelDef?.defaultProviders || []).filter(p => p.providerId === "gemini").map(p => ({
      providerId: p.providerId,
      model: p.model,
      models: [p.model],
      activeModels: [p.model],
      priority: p.priority || 1,
      keys: [],
    }));
  }

  if (providersToTry.length === 0) {
    return {
      text: `عفواً، لم يتم تعيين أو تفعيل أي مزود ونموذج لهذه الفئة (${modelDef?.nameAr || modelId}) في لوحة التحكم. يرجى من مدير النظام التوجه إلى لوحة التحكم لضبط وتفعيل النماذج والمفاتيح المعتمدة.`,
      providerUsed: "none",
      modelUsed: modelId,
      keyUsedMasked: "none",
      attemptsCount: 0,
      fallbackOccurred: false,
      deductCredits: false,
      errorLog: [`[Strict Policy] No configured providers or models assigned in admin control for tier: ${modelId}`],
    };
  }

  const logs: string[] = [];
  let attempts = 0;

  // 0. Zero-Compute Intent Triage & Model Sizing Check (O(1) in-memory)
  const primaryModelName = providersToTry[0]?.model || modelDef.defaultProviders[0]?.model || "gemini-3-flash-preview";
  const modelProfile = getModelCapabilityProfile(primaryModelName);
  const triage = triageRequestIntent(
    prompt,
    modelProfile,
    attachments.length > 0,
    options.webSearchEnabled || false
  );

  logs.push(
    `[Model Matrix] 🧠 Tier: ${modelProfile.sizeTier.toUpperCase()} (~${modelProfile.approxParamsB}B) | FunctionCalling: ${modelProfile.supportsFunctionCalling ? "Yes" : "No"} | Context: ${modelProfile.contextWindowTokens.toLocaleString()} tokens`
  );
  logs.push(
    `[Zero-Compute Triage] ⚡ Strategy: ${triage.executionStrategy} in ${triage.triageTimeMicroseconds}µs (${triage.explanationAr})`
  );

  // Build unified conversation history
  const historyText = messages
    .map(m => `${m.role === "user" ? "المستخدم" : "SoufAI"}: ${m.content}`)
    .join("\n");
  
  const textContext = getAttachmentTextContext(attachments);
  const promptWithContext = textContext ? `${prompt}${textContext}` : prompt;
  
  let fullPrompt = historyText ? `${historyText}\nالمستخدم: ${promptWithContext}` : promptWithContext;

  // If prefetch augmentation is recommended for small/reasoning models
  if (triage.shouldPrefetchWeb) {
    fullPrompt = `[ملاحظة النظام للمحرك الخفيف]: يتطلب هذا الاستفسار دقة تاريخية وحالية. قدم إجابتك مباشرة وبوضوح بناءً على أحدث المعارف والحقائق الموثقة دون استدعاء أي كود JSON.\n\n${fullPrompt}`;
  }

  // --- High-Speed In-Memory Cache Check (Zero-Latency & IP Protection) ---
  const isEligibleForCache = options.cacheResponse !== false &&
    responseCache.isCacheable(prompt, attachments.length) &&
    (!messages || messages.length === 0) &&
    !options.webSearchEnabled;
  const cacheKey = responseCache.generateKey(modelId, fullPrompt, options.systemInstruction, attachments.length);

  if (isEligibleForCache) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      logs.push(`[Response Cache] ⚡ تم استرجاع الرد فوراً من كاش الذاكرة المحلي (0ms - توفير استدعاء الـ IP والمفاتيح بنجاح)`);
      return {
        text: cached.response,
        providerUsed: cached.providerId,
        modelUsed: cached.model,
        keyUsedMasked: "cached-memory",
        attemptsCount: 0,
        fallbackOccurred: false,
        fallbackToFree: false,
        deductCredits: false,
        errorLog: logs,
        triageStrategy: triage.executionStrategy,
        modelSizeTier: modelProfile.sizeTier,
        triageLatencyUs: triage.triageTimeMicroseconds,
      };
    }
  }

  // Include environment variable keys for all known providers
  const envKeysMap: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    cohere: process.env.COHERE_API_KEY,
    together: process.env.TOGETHER_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
  };

  // 2. Loop through Providers
  for (const prov of providersToTry) {
    throwIfAborted(options.signal);
    // Determine active models explicitly checked by user/admin for this provider
    let modelsToTry: string[] = [];
    if (prov.activeModels !== undefined) {
      const allowedSet = new Set(prov.models && prov.models.length > 0 ? prov.models : [prov.model].filter(Boolean));
      modelsToTry = (Array.isArray(prov.activeModels) ? prov.activeModels : []).filter(m => allowedSet.has(m) || !prov.models || prov.models.length === 0);
      if (modelsToTry.length === 0) {
        logs.push(`[Skip] المزود ${prov.providerId}: لا توجد نماذج نشطة مفعلة في لوحة التحكم.`);
        continue;
      }
    } else if (prov.models && prov.models.length > 0) {
      modelsToTry = prov.models;
    } else if (prov.model) {
      modelsToTry = [prov.model];
    } else {
      continue;
    }

    // Gather keys for this provider (from provider's dedicated keys, global provider keys, and env)
    let rawKeysList: string[] = [];
    if (Array.isArray(prov.keys) && prov.keys.length > 0) {
      for (const k of prov.keys) {
        const dec = decryptKey(k);
        if (dec) rawKeysList.push(attachCloudflareAccountId(prov.providerId, dec, prov.accountId));
      }
    }
    if (finalKeys && finalKeys[prov.providerId] && finalKeys[prov.providerId].length > 0) {
      for (const k of finalKeys[prov.providerId]) {
        const dec = decryptKey(k);
        if (dec) rawKeysList.push(attachCloudflareAccountId(prov.providerId, dec, prov.accountId));
      }
    }

    const envKeyForProv =
      envKeysMap[prov.providerId] ?? process.env[`${prov.providerId.toUpperCase()}_API_KEY`];
    if (envKeyForProv && envKeyForProv.trim() !== "") {
      rawKeysList.push(attachCloudflareAccountId(prov.providerId, envKeyForProv, prov.accountId));
    }
    if (
      prov.providerId === "bedrock" &&
      rawKeysList.length === 0 &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    ) {
      rawKeysList.push(
        `${process.env.AWS_ACCESS_KEY_ID}:${process.env.AWS_SECRET_ACCESS_KEY}:${process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1"}`
      );
    }
    if (
      prov.providerId === "cloudflare" &&
      rawKeysList.length === 0 &&
      process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_API_TOKEN
    ) {
      rawKeysList.push(`${process.env.CLOUDFLARE_ACCOUNT_ID}:${process.env.CLOUDFLARE_API_TOKEN}`);
    }
    const pluralEnvKey = process.env[`${prov.providerId.toUpperCase()}_API_KEYS`];
    if (pluralEnvKey) {
      rawKeysList.push(pluralEnvKey);
    }
    if (prov.providerId === "ollama" && rawKeysList.length === 0) {
      rawKeysList.push("ollama-local");
    }

    // Apply Smart Key Pool Load Balancing (Round-Robin with Cooldown isolation)
    const keyPoolItems = keyPoolManager.getOrderedKeysForProvider(prov.providerId, rawKeysList);

    if (keyPoolItems.length === 0) {
      logs.push(`[Skip] Provider ${prov.providerId} has no real valid API keys`);
      continue;
    }

    logs.push(
      `[Key Pool] 🏊 مزود ${prov.providerId}: توفر ${keyPoolItems.length} مفتاح في المجمّع مع التوزيع التناوبي (Round-Robin)`
    );

    // 3. Loop through active checked models and keys in rotation sequence
    for (const rawTargetModel of modelsToTry) {
      throwIfAborted(options.signal);
      // Resolve safe chat model (e.g. Map audio/whisper/unsupported models to provider's flagship chat model)
      const targetModel = resolveSafeChatModel(prov.providerId, rawTargetModel);
      if (options.strictModelSelection && targetModel !== rawTargetModel) {
        logs.push(`[Strict Routing] Rejected model rewrite: ${rawTargetModel} -> ${targetModel}`);
        continue;
      }
      if (targetModel !== rawTargetModel) {
        logs.push(`[Model Safe-Route] 🔄 توجيه النموذج "${rawTargetModel}" إلى النموذج المتوافق مع الدردشة "${targetModel}" (${prov.providerId})`);
      }

      // Check if this model is in temporary quarantine/cooldown with soft probe allowance
      const modelHealth = healthManager.isModelQuarantined(prov.providerId, targetModel, true);
      if (modelHealth.quarantined) {
        logs.push(`[Quarantine Active] ⏳ النموذج "${targetModel}" (${prov.providerId}) في فترة تهدئة (متبقي: ${modelHealth.remainingFormatted} | مستوى ${modelHealth.level}). الانتقال للنموذج التالي...`);
        continue;
      }

      for (let keyIdx = 0; keyIdx < keyPoolItems.length; keyIdx++) {
        throwIfAborted(options.signal);
        const { key: activeKey, masked: maskedKey, isProbe, status: keyStatus } = keyPoolItems[keyIdx];
        const requestController = new AbortController();
        const parentAbort = () => requestController.abort(options.signal?.reason);
        if (options.signal?.aborted) {
          parentAbort();
        } else {
          options.signal?.addEventListener("abort", parentAbort, { once: true });
        }
        const requestTimeout = setTimeout(
          () => requestController.abort(new Error("Provider request timed out.")),
          Math.max(1, options.timeoutMs ?? 30000)
        );

        attempts++;
        logs.push(`[Attempt #${attempts}] Provider: ${prov.providerId}, Model: ${targetModel}, Key: ${maskedKey} (${keyStatus}${isProbe ? " [فحص إنعاش]" : ""})`);

        try {
          if (requestController.signal.aborted) {
            throw requestController.signal.reason || new Error("Provider request aborted.");
          }
          const userLoc = options.userLocale || "ar";
          const locCtx = createLocaleContext(userLoc);
          
          const rawBasePrompt = prov.systemPrompt
            ? `${prov.systemPrompt}\n\n${options.systemInstruction || "You are SoufAI, the intelligent multi-model AI system for SoufTools platform."}`
            : (options.systemInstruction || "You are SoufAI, the intelligent multi-model AI system for SoufTools platform.");

          const effectiveSystemPrompt = buildMultilingualSystemPrompt(rawBasePrompt, locCtx);

          if (prov.providerId === "gemini") {
            const ai = new GoogleGenAI({
              apiKey: activeKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });
            
            // Build multimodal parts list for Gemini
            const geminiParts: any[] = [];
            
            for (const att of attachments) {
              if (att.type === 'image' || att.type === 'audio') {
                geminiParts.push({
                  inlineData: {
                    mimeType: att.mimeType,
                    data: cleanBase64(att.data),
                  }
                });
              }
            }
            
            geminiParts.push({ text: fullPrompt });

            let geminiModelToUse = normalizeGeminiModel(targetModel);
            if (!geminiModelToUse) {
              logs.push(`[Skip] Invalid or empty Gemini model name: ${targetModel}`);
              continue;
            }

            let response: any = null;

            const geminiTools: any[] = [];
            if (!triage.shouldPruneTools && (options.webSearchEnabled || triage.needsWebSearch)) {
              geminiTools.push({ googleSearch: {} });
            }

            response = await requestDispatcher.dispatch("gemini", async () => {
              try {
                if (options.onToken && options.responseMimeType !== "application/json") {
                  const streamResult = await ai.models.generateContentStream({
                    model: geminiModelToUse,
                    contents: geminiParts,
                    config: {
                      systemInstruction: effectiveSystemPrompt,
                      temperature: options.temperature ?? 0.7,
                      abortSignal: requestController.signal,
                      ...(geminiTools.length > 0 ? { tools: geminiTools } : {}),
                    }
                  });
                  let accumulated = "";
                  for await (const chunk of streamResult) {
                    const delta = chunk.text || "";
                    if (delta) {
                      accumulated += delta;
                      try { options.onToken!(delta); } catch {}
                    }
                  }
                  return { text: accumulated };
                }

                return await ai.models.generateContent({
                  model: geminiModelToUse,
                  contents: geminiParts,
                  config: {
                    systemInstruction: effectiveSystemPrompt,
                    temperature: options.temperature ?? 0.7,
                    responseMimeType: options.responseMimeType,
                    responseSchema: options.responseSchema,
                    abortSignal: requestController.signal,
                    ...(geminiTools.length > 0 ? { tools: geminiTools } : {}),
                  }
                });
              } catch (primaryErr: any) {
                if (requestController.signal.aborted) {
                  throw getAbortError(requestController.signal);
                }
                // If JSON schema / mime type fails on Gemini, retry cleanly with the EXACT same model
                if (options.responseMimeType === "application/json") {
                  logs.push(`[Gemini JSON Clean Retry] Retrying with JSON prompt on same model (${geminiModelToUse}): ${primaryErr?.message || String(primaryErr)}`);
                  const cleanJsonPrompt = effectiveSystemPrompt + "\n\nهام جداً: يجب إرجاع النتيجة بصيغة كائن JSON صالح فقط دون أي نص إضافي.";
                  try {
                    return await ai.models.generateContent({
                      model: geminiModelToUse,
                      contents: geminiParts,
                      config: {
                        systemInstruction: cleanJsonPrompt,
                        temperature: options.temperature ?? 0.7,
                        abortSignal: requestController.signal,
                        ...(geminiTools.length > 0 ? { tools: geminiTools } : {}),
                      }
                    });
                  } catch {
                    throw primaryErr;
                  }
                }

                throw primaryErr;
              }
            });

            throwIfAborted(requestController.signal);
            if (response?.text) {
              if (isEligibleForCache) {
                responseCache.set(cacheKey, response.text, geminiModelToUse, prov.providerId);
              }
              // Record successful execution for both model, key, and pool
              healthManager.recordModelSuccess(prov.providerId, targetModel);
              healthManager.recordKeySuccess(prov.providerId, activeKey);
              keyPoolManager.recordKeyOutcome(prov.providerId, activeKey, { success: true });

              // Real model invocation console metrics
              terminalLogger.ai({
                model: geminiModelToUse,
                provider: prov.providerId,
                keyMask: maskedKey,
                status: "success",
              });

              return {
                text: response.text,
                providerUsed: prov.providerId,
                modelUsed: geminiModelToUse,
                keyUsedMasked: maskedKey,
                attemptsCount: attempts,
                fallbackOccurred: attempts > 1,
                fallbackToFree: false,
                deductCredits: true,
                errorLog: logs,
                triageStrategy: triage.executionStrategy,
                modelSizeTier: modelProfile.sizeTier,
                triageLatencyUs: triage.triageTimeMicroseconds,
              };
            }
          } 
          else {
            const restRes = await requestDispatcher.dispatch(prov.providerId, async () => {
              if (requestController.signal.aborted) {
                throw requestController.signal.reason || new Error("Provider request aborted.");
              }
              return await executeRestChatRequest({
                providerId: prov.providerId,
                model: targetModel,
                apiKey: activeKey,
                systemPrompt: effectiveSystemPrompt,
                messages,
                userPrompt: promptWithContext,
                attachments,
                temperature: options.temperature,
                responseMimeType: options.responseMimeType,
                responseSchema: options.responseSchema,
                customBaseUrl: (prov as any).baseUrl,
                signal: requestController.signal,
              });
            });

            if (restRes.ok) {
              const textResult = restRes.text;

              if (textResult) {
                if (options.onToken) {
                  try { options.onToken(textResult); } catch {}
                }
                if (isEligibleForCache) {
                  responseCache.set(cacheKey, textResult, targetModel, prov.providerId);
                }
                // Record success for model, key, and pool
                healthManager.recordModelSuccess(prov.providerId, targetModel);
                healthManager.recordKeySuccess(prov.providerId, activeKey);
                keyPoolManager.recordKeyOutcome(prov.providerId, activeKey, { success: true });

                // Real model invocation console metrics
                terminalLogger.ai({
                  model: targetModel,
                  provider: prov.providerId,
                  keyMask: maskedKey,
                  status: "success",
                });

                return {
                  text: textResult,
                  providerUsed: prov.providerId,
                  modelUsed: targetModel,
                  keyUsedMasked: maskedKey,
                  attemptsCount: attempts,
                  fallbackOccurred: attempts > 1,
                  fallbackToFree: false,
                  deductCredits: true,
                  errorLog: logs,
                  triageStrategy: triage.executionStrategy,
                  modelSizeTier: modelProfile.sizeTier,
                  triageLatencyUs: triage.triageTimeMicroseconds,
                };
              }
            } else {
              const errText = restRes.errorText || "";
              const safeFailure = safeProviderFailureLabel(restRes.status, errText);
              logs.push(`[HTTP Error ${restRes.status}] ${prov.providerId}:${targetModel} -> ${safeFailure}`);
              
              serverErrorManager.recordError({
                title: `تعثر استجابة المزود (${prov.providerId}: ${targetModel})`,
                message: `HTTP ${restRes.status}; failure=${safeFailure}`,
                category: "ai_engine",
                severity: restRes.status >= 500 ? "critical" : restRes.status === 429 ? "high" : "medium",
                providerId: prov.providerId,
                modelId: targetModel,
                statusCode: restRes.status,
              });

              const isRateLimit = 
                restRes.status === 429 ||
                errText.includes("rate_limit") ||
                errText.includes("Rate limit reached") ||
                errText.includes("tokens per minute") ||
                errText.includes("requests per minute") ||
                errText.includes("TPM") ||
                errText.includes("RPM") ||
                errText.includes("insufficient_quota");

              const poolOutcome = keyPoolManager.recordKeyOutcome(prov.providerId, activeKey, {
                success: false,
                statusCode: restRes.status,
                errorText: safeFailure,
              });

              if (isRateLimit) {
                logs.push(`[Key Pool Rotated] ⚡ المفتاح ${maskedKey} (${prov.providerId}) تجاوز معدل الطلبات (${restRes.status}). تم وضعه في فترة تبريد (${poolOutcome.durationSeconds} ثانية). الانتقال فوراً للمفتاح التالي في المجمّع لنفس النموذج "${targetModel}" دون تغيير النموذج.`);
                continue;
              }

              const isHardKeyAuthError = 
                restRes.status === 401 ||
                restRes.status === 403 ||
                errText.includes("invalid_api_key") ||
                errText.includes("API key not valid") ||
                errText.includes("Incorrect API key") ||
                errText.includes("Account deactivated");

              if (isHardKeyAuthError) {
                logs.push(`[Key Invalid] 🚫 Provider ${prov.providerId} rejected the configured credential.`);
                if (options.strictModelSelection) break;
                continue;
              }

              if (options.strictModelSelection && (restRes.status === 400 || restRes.status === 422)) {
                logs.push(`[Strict Routing] Permanent request rejection from ${prov.providerId}: ${safeFailure}`);
                break;
              }

              const modelQuarantine = healthManager.recordModelFailure(prov.providerId, targetModel, safeFailure);
              if (modelQuarantine.quarantined) {
                logs.push(`[Model Quarantined] 🚫 تم تعليق النموذج "${targetModel}" (${prov.providerId}) مؤقتاً لمدة ${modelQuarantine.durationMinutes} دقيقة بعد تكرار تعثره التقني.`);
                break;
              }
            }
          }
        } catch (err: any) {
          if (options.signal?.aborted) throw getAbortError(options.signal);
          const safeFailure = safeProviderFailureLabel(undefined, err);
          const errMsg = safeFailure;
          logs.push(`[Execution Error] ${prov.providerId}:${targetModel} -> ${safeFailure}`);

          serverErrorManager.recordError({
            title: `خطأ استثناء أثناء تنفيذ المزود (${prov.providerId}: ${targetModel})`,
            message: safeFailure,
            category: "ai_engine",
            severity: "high",
            providerId: prov.providerId,
            modelId: targetModel,
          });

          const isRateLimit = 
            errMsg.includes("429") ||
            errMsg.includes("quota") ||
            errMsg.includes("Resource has been exhausted") ||
            errMsg.includes("RATE_LIMIT") ||
            errMsg.includes("Too Many Requests");

          const poolOutcome = keyPoolManager.recordKeyOutcome(prov.providerId, activeKey, {
            success: false,
            statusCode: isRateLimit ? 429 : 500,
            errorText: safeFailure,
          });

          if (isRateLimit) {
            logs.push(`[Key Pool Rotated] ⚡ المفتاح ${maskedKey} تجاوز معدل الطلبات (${prov.providerId}). تم تبريده (${poolOutcome.durationSeconds} ثانية). الانتقال فوراً للمفتاح التالي في المجمّع لنفس النموذج "${targetModel}" دون تغيير النموذج.`);
            // Continue trying next key for the EXACT SAME MODEL!
            continue;
          }

          const isHardKeyAuthError = safeFailure === "authentication_or_permission_failure";

          if (isHardKeyAuthError) {
            logs.push(`[Key Invalid] 🚫 Provider ${prov.providerId} rejected the configured credential.`);
            if (options.strictModelSelection) break;
            continue;
          }

          const modelQuarantine = healthManager.recordModelFailure(prov.providerId, targetModel, errMsg);
          if (modelQuarantine.quarantined) {
            logs.push(`[Model Quarantined] 🚫 تم تعليق النموذج "${targetModel}" (${prov.providerId}) لمدة ${modelQuarantine.durationMinutes} دقيقة.`);
            break;
          }
          if (options.strictModelSelection && safeFailure === "invalid_request") break;
        } finally {
          clearTimeout(requestTimeout);
          options.signal?.removeEventListener("abort", parentAbort);
        }
      }
    }
  }

  if (options.strictModelSelection) {
    const hasConfigurationError = logs.some((line) =>
      /no real valid api keys|no configured providers|no active provider/i.test(line)
    );
    return {
      text: "تعذر تنفيذ الطلب عبر النموذج والمزود المحددين.",
      providerUsed: "none",
      modelUsed: providersToTry[0]?.model || modelId,
      keyUsedMasked: "none",
      attemptsCount: attempts,
      fallbackOccurred: false,
      errorLog: logs,
      failureCode: hasConfigurationError ? "PROVIDER_CONFIGURATION" : "PROVIDER_EXECUTION_FAILED",
    };
  }

  // 5. SMART WHITELIST MULTI-TIER ROTATION & FAILOVER ENGINE
  // Strictly rotate ONLY through tiers and models explicitly enabled by Admin in the control panel.
  // NEVER sweep disabled tiers, deleted models, or default unvetted fallbacks.
  let allowedTiers: string[] = [];
  if (activeModelTiers && Array.isArray(activeModelTiers) && activeModelTiers.length > 0) {
    allowedTiers = activeModelTiers;
  } else if (finalAssignments && Object.keys(finalAssignments).length > 0) {
    allowedTiers = Object.keys(finalAssignments);
  } else {
    allowedTiers = ["core"];
  }

  // Filter out current tier (already attempted) and internal system tiers like classifier and vision
  const candidateTiers = allowedTiers.filter(t => t !== modelId && t !== "classifier" && t !== "vision");

  if (candidateTiers.length > 0) {
    logs.push(`[Smart Whitelist Failover] 🛡️ حصر التناوب في النماذج والمستويات المعتمدة في لوحة التحكم فقط: [${candidateTiers.join(", ")}]`);
  }

  for (const candidateTier of candidateTiers) {
    throwIfAborted(options.signal);
    const candidateProviders = (finalAssignments && finalAssignments[candidateTier] && finalAssignments[candidateTier].length > 0)
      ? finalAssignments[candidateTier]
      : [];

    if (candidateProviders.length === 0) continue;

    for (const candProv of candidateProviders) {
      throwIfAborted(options.signal);
      const p = candProv as any;
      let candModels: string[] = [];
      if (p.activeModels !== undefined) {
        const allowedSet = new Set(p.models && p.models.length > 0 ? p.models : [p.model].filter(Boolean));
        candModels = (Array.isArray(p.activeModels) ? p.activeModels : []).filter((m: string) => allowedSet.has(m) || !p.models || p.models.length === 0);
      } else if (p.models && p.models.length > 0) {
        candModels = p.models;
      } else if (p.model) {
        candModels = [p.model];
      }

      if (!candModels || candModels.length === 0) continue;

      let candKeysList: string[] = [];
      if (Array.isArray(p.keys) && p.keys.length > 0) {
        for (const k of p.keys) {
          const dec = decryptKey(k);
          if (dec && !candKeysList.includes(dec)) candKeysList.push(dec);
        }
      }
      if (finalKeys && finalKeys[candProv.providerId] && finalKeys[candProv.providerId].length > 0) {
        for (const k of finalKeys[candProv.providerId]) {
          const dec = decryptKey(k);
          if (dec && !candKeysList.includes(dec)) candKeysList.push(dec);
        }
      }
      const envKey =
        envKeysMap[candProv.providerId] ?? process.env[`${candProv.providerId.toUpperCase()}_API_KEY`];
      if (envKey && !candKeysList.includes(envKey)) {
        candKeysList.push(envKey);
      }
      if (
        candProv.providerId === "bedrock" &&
        candKeysList.length === 0 &&
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY
      ) {
        candKeysList.push(
          `${process.env.AWS_ACCESS_KEY_ID}:${process.env.AWS_SECRET_ACCESS_KEY}:${process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1"}`
        );
      }
      if (
        candProv.providerId === "cloudflare" &&
        candKeysList.length === 0 &&
        process.env.CLOUDFLARE_ACCOUNT_ID &&
        process.env.CLOUDFLARE_API_TOKEN
      ) {
        candKeysList.push(`${process.env.CLOUDFLARE_ACCOUNT_ID}:${process.env.CLOUDFLARE_API_TOKEN}`);
      }
      if (candProv.providerId === "ollama" && candKeysList.length === 0) {
        candKeysList.push("ollama-local");
      }

      const validCandKeys = candKeysList.filter(k => {
        if (!k || typeof k !== "string") return false;
        const clean = k.trim();
        return clean.length >= 8 && !clean.includes("demo_key") && !clean.includes("demo-key");
      });

      if (validCandKeys.length === 0) continue;

      for (const rawModel of candModels) {
        throwIfAborted(options.signal);
        const targetModel = resolveSafeChatModel(candProv.providerId, rawModel);
        if (!targetModel) continue;

        for (const activeKey of validCandKeys) {
          throwIfAborted(options.signal);
          const fallbackController = new AbortController();
          const abortFallbackFromParent = () =>
            fallbackController.abort(options.signal?.reason);
          if (options.signal?.aborted) {
            abortFallbackFromParent();
          } else {
            options.signal?.addEventListener("abort", abortFallbackFromParent, { once: true });
          }
          const fallbackTimeout = setTimeout(
            () => fallbackController.abort(new Error("Provider request timed out.")),
            Math.max(1, options.timeoutMs ?? 30000)
          );
          attempts++;
          logs.push(`[Dynamic Failover Attempt #${attempts}] Tier: ${candidateTier}, Provider: ${candProv.providerId}, Model: ${targetModel}`);

          try {
            throwIfAborted(fallbackController.signal);
            if (candProv.providerId === "gemini") {
              const ai = new GoogleGenAI({ 
                apiKey: activeKey,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
              });
              const geminiParts: any[] = [];
              for (const att of attachments) {
                if (att.type === 'image' || att.type === 'audio') {
                  geminiParts.push({
                    inlineData: {
                      mimeType: att.mimeType,
                      data: cleanBase64(att.data),
                    }
                  });
                }
              }
              geminiParts.push({ text: fullPrompt });
              const systemPrompt = options.systemInstruction || "أنت نظام الذكاء الاصطناعي SoufAI. أجب دائماً باللغة العربية بأسلوب كامل ووافٍ واحترافي.";

              const candModelsToTry = [
                normalizeGeminiModel(targetModel),
              ].filter(Boolean);

              let res: any = null;
              let executedModel = candModelsToTry[0];

              for (const mToTry of candModelsToTry) {
                try {
                  res = await ai.models.generateContent({
                    model: mToTry,
                    contents: geminiParts,
                    config: {
                      systemInstruction: systemPrompt,
                      temperature: options.temperature ?? 0.7,
                      responseMimeType: options.responseMimeType,
                      abortSignal: fallbackController.signal,
                    }
                  });
                  throwIfAborted(fallbackController.signal);
                  if (res?.text && res.text.trim().length > 0) {
                    executedModel = mToTry;
                    break;
                  }
                } catch (jsonErr: any) {
                  if (fallbackController.signal.aborted) {
                    throw getAbortError(fallbackController.signal);
                  }
                  if (options.responseMimeType === "application/json") {
                    try {
                      res = await ai.models.generateContent({
                        model: mToTry,
                        contents: geminiParts,
                        config: {
                          systemInstruction: systemPrompt + "\n\nيجب أن يكون الرد كائن JSON صالح فقط دون أي نص إضافي.",
                          temperature: options.temperature ?? 0.7,
                          abortSignal: fallbackController.signal,
                        }
                      });
                      throwIfAborted(fallbackController.signal);
                      if (res?.text && res.text.trim().length > 0) {
                        executedModel = mToTry;
                        break;
                      }
                    } catch (retryError) {
                      if (fallbackController.signal.aborted) {
                        throw getAbortError(fallbackController.signal);
                      }
                    }
                  }
                }
              }

              throwIfAborted(fallbackController.signal);
              if (res?.text && res.text.trim().length > 0) {
                healthManager.recordModelSuccess("gemini", executedModel);
                healthManager.recordKeySuccess("gemini", activeKey);

                return {
                  text: res.text,
                  providerUsed: "gemini",
                  modelUsed: executedModel,
                  keyUsedMasked: `${activeKey.slice(0, 4)}••••${activeKey.slice(-4)}`,
                  attemptsCount: attempts,
                  fallbackOccurred: true,
                  fallbackToFree: false,
                  deductCredits: false,
                  errorLog: logs,
                };
              }
            } else {
              const restRes = await executeRestChatRequest({
                providerId: candProv.providerId,
                model: targetModel,
                apiKey: activeKey,
                systemPrompt: options.systemInstruction || "أنت نظام SoufAI. أجب باللغة العربية بدقة.",
                messages: [],
                userPrompt: promptWithContext,
                temperature: options.temperature,
                responseMimeType: options.responseMimeType,
                customBaseUrl: (candProv as any).baseUrl,
                signal: fallbackController.signal,
              });

              throwIfAborted(fallbackController.signal);
              if (restRes.ok) {
                const textRes = restRes.text;

                if (textRes && textRes.trim().length > 0) {
                  healthManager.recordModelSuccess(candProv.providerId, targetModel);
                  healthManager.recordKeySuccess(candProv.providerId, activeKey);

                  return {
                    text: textRes,
                    providerUsed: candProv.providerId,
                    modelUsed: targetModel,
                    keyUsedMasked: `${activeKey.slice(0, 4)}••••${activeKey.slice(-4)}`,
                    attemptsCount: attempts,
                    fallbackOccurred: true,
                    fallbackToFree: false,
                    deductCredits: false,
                    errorLog: logs,
                  };
                }
              }
            }
          } catch (failErr: any) {
            if (options.signal?.aborted) throw getAbortError(options.signal);
            logs.push(`[Dynamic Failover Error] ${candProv.providerId}:${targetModel} -> ${failErr?.message || String(failErr)}`);
          } finally {
            clearTimeout(fallbackTimeout);
            options.signal?.removeEventListener("abort", abortFallbackFromParent);
          }
        }
      }
    }
  }

  // Never synthesize task-shaped output after every configured provider failed.
  return {
    text: "تعذر الوصول إلى نموذج مهيأ لإكمال الطلب. لم تُنتج إجابة، يرجى المحاولة لاحقاً أو مراجعة إعدادات المزود.",
    providerUsed: "none",
    modelUsed: modelId,
    keyUsedMasked: "none",
    attemptsCount: attempts,
    fallbackOccurred: false,
    deductCredits: false,
    errorLog: logs,
    failureCode: "ALL_CONFIGURED_PROVIDERS_FAILED",
    triageStrategy: triage.executionStrategy,
    modelSizeTier: modelProfile.sizeTier,
    triageLatencyUs: triage.triageTimeMicroseconds,
  };
}
