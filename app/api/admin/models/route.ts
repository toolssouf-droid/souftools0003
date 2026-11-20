import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { decryptKey } from "@/lib/encryption";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";
import {
  fetchProviderModelsLive,
  filterChatSupportedModels,
  getProviderHttpErrorMessage,
  getProviderNetworkErrorMessage,
} from "@/lib/providers/providerAdapters";

async function fetchProviderModels(
  req: NextRequest,
  providerId: string,
  rawApiKey: string,
  rawAccountId = ""
) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  if (!providerId) {
    return NextResponse.json(
      { success: false, error: "يجب تحديد معرف المزود (providerId)", models: [] },
      { status: 400 }
    );
  }

  // 1. Decrypt the request-body key, or fetch from saved admin config
  let effectiveKey = "";
  if (rawApiKey) {
    effectiveKey = decryptKey(rawApiKey) || rawApiKey;
  }
  let effectiveAccountId = rawAccountId.trim();

  if (!effectiveKey || (providerId === "cloudflare" && !effectiveAccountId)) {
    try {
      const config = await loadServerAdminConfig();
      if (!effectiveKey && config?.keys?.[providerId]?.[0]) {
        const stored = config.keys[providerId][0];
        effectiveKey = decryptKey(stored) || stored;
      }
      if (config?.modelProviders) {
        for (const tier of Object.keys(config.modelProviders)) {
          const provs = config.modelProviders[tier] || [];
          const match = provs.find((p: any) => p.providerId === providerId);
          if (providerId === "cloudflare" && !effectiveAccountId && typeof match?.accountId === "string") {
            effectiveAccountId = match.accountId.trim();
          }
          if (!effectiveKey && match?.keys?.[0]) {
            const k = typeof match.keys[0] === "string" ? match.keys[0] : match.keys[0]?.key;
            if (k) {
              effectiveKey = decryptKey(k) || k;
            }
          }
          if (effectiveKey && (providerId !== "cloudflare" || effectiveAccountId)) break;
        }
      }
    } catch (e) {
      console.warn("Failed to load server admin config for live models lookup:", e);
    }
  }

  if (providerId === "cloudflare" && !effectiveAccountId) {
    effectiveAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  }

  // 2. Check environment variable fallbacks if not stored
  if (!effectiveKey && providerId === "gemini" && process.env.GEMINI_API_KEY) {
    effectiveKey = process.env.GEMINI_API_KEY;
  }
  if (!effectiveKey) {
    const envKeyName = `${providerId.toUpperCase()}_API_KEY`;
    if (process.env[envKeyName]) {
      effectiveKey = process.env[envKeyName] as string;
    }
  }

  // If no API key is available and provider is not local Ollama:
  // Strict rule: NO DEFAULT MODELS. Return honest error.
  if (!effectiveKey && providerId !== "ollama") {
    return NextResponse.json(
      {
        success: false,
        error: `لم يتم العثور على مفتاح API صالح لمزود (${providerId}). يرجى إدخال أو تعيين مفتاح API للاتصال بالمزود وجلب أحدث النماذج المتاحة من حسابك مباشرة.`,
        models: [],
      },
      { status: 400 }
    );
  }

  if (providerId === "groq") {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const result = await fetchProviderModelsLive(providerId, effectiveKey, controller.signal);
      if (!result.success) {
        const status =
          result.statusCode && result.statusCode >= 400
            ? result.statusCode
            : result.statusCode === 200
            ? 404
            : 502;
        console.warn(`[Admin Models] Groq catalog request failed (HTTP ${status}).`);
        return NextResponse.json(
          {
            success: false,
            error:
              status === 404
                ? "لم يُرجع حساب Groq أي نماذج محادثة متاحة حالياً."
                : getProviderHttpErrorMessage(status),
            models: [],
          },
          { status }
        );
      }

      const models = Array.from(new Set(filterChatSupportedModels(result.models, providerId)));
      if (models.length === 0) {
        return NextResponse.json(
          { success: false, error: "لم يُرجع حساب Groq أي نماذج محادثة متاحة.", models: [] },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        models,
        source: "live_api",
        count: models.length,
      });
    } catch (error) {
      const timedOut =
        controller.signal.aborted ||
        (error instanceof Error && (error.name === "AbortError" || /timeout|timed out/i.test(error.message)));
      console.warn(
        `[Admin Models] Groq catalog request ${timedOut ? "timed out" : "failed due to a network error"}.`
      );
      return NextResponse.json(
        { success: false, error: getProviderNetworkErrorMessage(timedOut), models: [] },
        { status: timedOut ? 504 : 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 3. Special case: Perplexity AI official models catalog
  if (providerId === "perplexity") {
    const perplexityModels = [
      "sonar",
      "sonar-pro",
      "sonar-reasoning",
      "sonar-reasoning-pro",
      "sonar-deep-research",
      "r1-1776",
    ];
    return NextResponse.json({
      success: true,
      models: perplexityModels,
      source: "official_catalog",
      count: perplexityModels.length,
      message: "تم جلب أحدث قائمة معتمدة لنماذج Perplexity Sonar و Reasoning بنجاح",
    });
  }

  // 4. Google Gemini Live Fetch
  if (providerId === "gemini") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": effectiveKey },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          const fetched = data.models
            .filter((m: any) => {
              const methods = m.supportedGenerationMethods || [];
              return methods.includes("generateContent");
            })
            .map((m: any) => (m.name ? m.name.replace(/^models\//, "") : ""))
            .filter(Boolean);

          const filtered = filterChatSupportedModels(fetched, providerId);
          if (filtered.length > 0) {
            return NextResponse.json({
              success: true,
              models: Array.from(new Set(filtered)),
              source: "live_api",
              count: filtered.length,
            });
          }
        }
        return NextResponse.json(
          {
            success: false,
            error: "لم يُرجع حساب Google Gemini أي نماذج توليدية صالحة.",
            models: [],
          },
          { status: 404 }
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `رمز الحالة: ${res.status}`;
        return NextResponse.json(
          {
            success: false,
            error: `فشل الاتصال بـ Google Gemini API: ${errMsg}`,
            models: [],
          },
          { status: res.status }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        {
          success: false,
          error: `تعذر الاتصال بـ Google Gemini: ${e?.message || "خطأ في الشبكة أو انتهاء المهلة"}`,
          models: [],
        },
        { status: 504 }
      );
    }
  }

  // 5. Anthropic Live Fetch
  if (providerId === "anthropic") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": effectiveKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const fetched = data.data.map((m: any) => m.id);
          const filtered = filterChatSupportedModels(fetched, providerId);
          if (filtered.length > 0) {
            return NextResponse.json({
              success: true,
              models: Array.from(new Set(filtered)),
              source: "live_api",
              count: filtered.length,
            });
          }
        }
        return NextResponse.json(
          {
            success: false,
            error: "لم يُرجع حساب Anthropic أي نماذج نشطة.",
            models: [],
          },
          { status: 404 }
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `رمز الحالة: ${res.status}`;
        return NextResponse.json(
          {
            success: false,
            error: `فشل استعلام مزود Anthropic: ${errMsg}`,
            models: [],
          },
          { status: res.status }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        {
          success: false,
          error: `تعذر الاتصال بمزود Anthropic: ${e?.message || "انتهت مهلة الطلب"}`,
          models: [],
        },
        { status: 504 }
      );
    }
  }

  // 6. Mistral AI Live Fetch
  if (providerId === "mistral") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${effectiveKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const fetched = data.data.map((m: any) => m.id);
          const filtered = filterChatSupportedModels(fetched, providerId);
          if (filtered.length > 0) {
            return NextResponse.json({
              success: true,
              models: Array.from(new Set(filtered)),
              source: "live_api",
              count: filtered.length,
            });
          }
        }
        return NextResponse.json(
          {
            success: false,
            error: "لم يُرجع حساب Mistral AI أي نماذج نشطة.",
            models: [],
          },
          { status: 404 }
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || errData?.message || `رمز الحالة: ${res.status}`;
        return NextResponse.json(
          {
            success: false,
            error: `فشل استعلام مزود Mistral AI: ${errMsg}`,
            models: [],
          },
          { status: res.status }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        {
          success: false,
          error: `تعذر الاتصال بمزود Mistral AI: ${e?.message || "خطأ في الشبكة"}`,
          models: [],
        },
        { status: 504 }
      );
    }
  }

  // 7. Cohere Live Fetch
  if (providerId === "cohere") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://api.cohere.com/v1/models", {
        headers: { Authorization: `Bearer ${effectiveKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          const fetched = data.models.map((m: any) => m.name || m.id).filter(Boolean);
          const filtered = filterChatSupportedModels(fetched, providerId);
          if (filtered.length > 0) {
            return NextResponse.json({
              success: true,
              models: Array.from(new Set(filtered)),
              source: "live_api",
              count: filtered.length,
            });
          }
        }
        return NextResponse.json(
          {
            success: false,
            error: "لم يُرجع حساب Cohere أي نماذج توليد صالحة.",
            models: [],
          },
          { status: 404 }
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.message || `رمز الحالة: ${res.status}`;
        return NextResponse.json(
          {
            success: false,
            error: `فشل استعلام مزود Cohere: ${errMsg}`,
            models: [],
          },
          { status: res.status }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        {
          success: false,
          error: `تعذر الاتصال بمزود Cohere: ${e?.message || "خطأ في الاتصال"}`,
          models: [],
        },
        { status: 504 }
      );
    }
  }

  // 8. Non-chat & Specialized Protocols + Extended OpenAI-Compatible Providers
  const specializedOrExtended = new Set([
    "elevenlabs",
    "assemblyai",
    "voyage",
    "bedrock",
    "cloudflare",
    "replicate",
    "inference",
    "vercel_gw",
    "minimax",
    "bytedance",
    "baseten",
    "lepton",
    "huggingface",
  ]);

  if (specializedOrExtended.has(providerId)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let res;
      try {
        res = await fetchProviderModelsLive(providerId, effectiveKey, controller.signal, effectiveAccountId);
      } finally {
        clearTimeout(timeoutId);
      }
      if (res.success && res.models.length > 0) {
        const shouldFilterChat =
          providerId !== "elevenlabs" && providerId !== "assemblyai" && providerId !== "voyage";
        const models = shouldFilterChat
          ? (() => {
              const filtered = filterChatSupportedModels(res.models, providerId);
              return filtered.length > 0 ? filtered : res.models;
            })()
          : res.models;
        return NextResponse.json({
          success: true,
          models: Array.from(new Set(models)),
          source: res.source || "live_api",
          count: models.length,
        });
      }
      return NextResponse.json(
        {
          success: false,
          error: res.error || `تعذر جلب نماذج (${providerId}).`,
          models: [],
        },
        { status: res.statusCode && res.statusCode >= 400 ? res.statusCode : 400 }
      );
    } catch (e: any) {
      return NextResponse.json(
        {
          success: false,
          error: `تعذر الاتصال بمزود (${providerId}): ${e?.message || "خطأ في الشبكة"}`,
          models: [],
        },
        { status: 504 }
      );
    }
  }

  // 9. Standard OpenAI-compatible / REST /models endpoints
  const baseUrls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    groq: "https://api.groq.com/openai/v1",
    deepseek: "https://api.deepseek.com",
    openrouter: "https://openrouter.ai/api/v1",
    together: "https://api.together.xyz/v1",
    xai: "https://api.x.ai/v1",
    sambanova: "https://api.sambanova.ai/v1",
    siliconflow: "https://api.siliconflow.cn/v1",
    cerebras: "https://api.cerebras.ai/v1",
    deepinfra: "https://api.deepinfra.com/v1/openai",
    fireworks: "https://api.fireworks.ai/inference/v1",
    alibaba: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    ai21: "https://api.ai21.com/studio/v1",
    moonshot: "https://api.moonshot.cn/v1",
    zhipu: "https://open.bigmodel.cn/api/paas/v4",
    nebius: "https://api.studio.nebius.ai/v1",
    nvidia: "https://integrate.api.nvidia.com/v1",
    hyperbolic: "https://api.hyperbolic.xyz/v1",
    novita: "https://api.novita.ai/v3/openai",
    friendliai: "https://api.friendli.ai/serverless/v1",
    scaleway: "https://api.scaleway.ai/v1",
    predibase: "https://serving.app.predibase.com/v1",
    ollama: (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "") + "/v1",
  };

  const baseUrl = baseUrls[providerId];

  if (!baseUrl) {
    return NextResponse.json(
      {
        success: false,
        error: `المزود (${providerId}) غير مدعوم للجلب الحي للنماذج.`,
        models: [],
      },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (effectiveKey) {
      headers["Authorization"] = `Bearer ${effectiveKey}`;
    }
    if (providerId === "openrouter") {
      headers["HTTP-Referer"] = "https://souftools.ai";
      headers["X-Title"] = "SoufTools";
    }

    const res = await fetch(`${baseUrl}/models`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.models)
        ? data.models
        : [];

      if (rawList.length > 0) {
        const apiModels = rawList
          .map((m: any) => (typeof m === "string" ? m : m.id || m.name))
          .filter(Boolean);
        const filtered = filterChatSupportedModels(apiModels, providerId);
        const finalModels = filtered.length > 0 ? filtered : apiModels;
        if (finalModels.length > 0) {
          return NextResponse.json({
            success: true,
            models: Array.from(new Set(finalModels)),
            source: "live_api",
            count: finalModels.length,
          });
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: `لم يعثر المزود (${providerId}) على أي نماذج محادثة نشطة في حسابك.`,
          models: [],
        },
        { status: 404 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
        error: getProviderHttpErrorMessage(res.status),
          models: [],
        },
        { status: res.status }
      );
    }
  } catch (e: any) {
    const timedOut =
    e?.name === "AbortError" || /timeout|timed out/i.test(String(e?.message || ""));
    return NextResponse.json(
      {
        success: false,
        error: getProviderNetworkErrorMessage(timedOut),
        models: [],
      },
      { status: timedOut ? 504 : 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.has("apiKey")) {
    return NextResponse.json(
      { success: false, error: "API key must be sent in the request body.", models: [] },
      { status: 400 }
    );
  }

  return fetchProviderModels(
    req,
    (searchParams.get("providerId") || "").trim().toLowerCase(),
    ""
  );
}

export async function POST(req: NextRequest) {
  let body: { providerId?: unknown; apiKey?: unknown; accountId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body.", models: [] },
      { status: 400 }
    );
  }

  const providerId =
    typeof body?.providerId === "string" ? body.providerId.trim().toLowerCase() : "";
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
  return fetchProviderModels(req, providerId, apiKey, accountId);
}
