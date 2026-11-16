/**
 * SoufTools Embedding Providers Manager
 * Real embeddings client supporting Voyage AI and OpenAI-compatible embedding providers.
 */

export const VOYAGE_MODELS = [
  "voyage-3",
  "voyage-3-large",
  "voyage-3-lite",
  "voyage-code-3",
  "voyage-finance-2",
  "voyage-law-2",
  "voyage-multilingual-2",
];

export type EmbeddingProviderId =
  | "voyage"
  | "openai"
  | "cohere"
  | "gemini"
  | "mistral"
  | "together"
  | "siliconflow";

export async function testVoyageKey(
  apiKey: string,
  signal?: AbortSignal
): Promise<{ valid: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        input: ["ping"],
        model: "voyage-3-lite",
      }),
    });
    const latencyMs = Date.now() - start;
    if (res.ok) return { valid: true, latencyMs };
    const err = await res.json().catch(() => ({}));
    return {
      valid: false,
      latencyMs,
      error: `فشل التحقق من Voyage AI: ${err?.detail || err?.message || `HTTP ${res.status}`}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      latencyMs: Date.now() - start,
      error: err?.message || "فشل الاتصال بـ Voyage AI",
    };
  }
}

export async function fetchVoyageModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<{ success: boolean; models: string[]; error?: string }> {
  const check = await testVoyageKey(apiKey, signal);
  if (!check.valid) {
    return { success: false, models: [], error: check.error };
  }
  return { success: true, models: [...VOYAGE_MODELS] };
}

export async function createEmbeddings(options: {
  providerId: EmbeddingProviderId;
  apiKey: string;
  input: string | string[];
  model?: string;
  signal?: AbortSignal;
}): Promise<{ embeddings: number[][]; model: string }> {
  const inputs = Array.isArray(options.input) ? options.input : [options.input];
  const provider = options.providerId;

  if (provider === "gemini") {
    const model = options.model || "text-embedding-004";
    const embeddings: number[][] = [];
    for (const text of inputs) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": options.apiKey,
          },
          signal: options.signal,
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          }),
        }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Gemini Embedding Error (${res.status}): ${err.slice(0, 180)}`);
      }
      const data = await res.json();
      if (Array.isArray(data?.embedding?.values)) {
        embeddings.push(data.embedding.values);
      }
    }
    return { embeddings, model };
  }

  if (provider === "cohere") {
    const model = options.model || "embed-multilingual-v3.0";
    const res = await fetch("https://api.cohere.com/v2/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      signal: options.signal,
      body: JSON.stringify({
        model,
        texts: inputs,
        input_type: "search_document",
        embedding_types: ["float"],
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Cohere Embedding Error (${res.status}): ${err.slice(0, 180)}`);
    }
    const data = await res.json();
    const embeddings: number[][] = data?.embeddings?.float || [];
    return { embeddings, model };
  }

  const endpointMap: Record<string, { url: string; defaultModel: string }> = {
    voyage: { url: "https://api.voyageai.com/v1/embeddings", defaultModel: "voyage-3" },
    openai: { url: "https://api.openai.com/v1/embeddings", defaultModel: "text-embedding-3-small" },
    mistral: { url: "https://api.mistral.ai/v1/embeddings", defaultModel: "mistral-embed" },
    together: { url: "https://api.together.xyz/v1/embeddings", defaultModel: "BAAI/bge-large-en-v1.5" },
    siliconflow: { url: "https://api.siliconflow.cn/v1/embeddings", defaultModel: "BAAI/bge-m3" },
  };

  const target = endpointMap[provider];
  if (!target) {
    throw new Error(`Unsupported embedding provider: ${provider}`);
  }
  const model = options.model || target.defaultModel;

  const res = await fetch(target.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify({
      model,
      input: inputs,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`${provider} Embedding Error (${res.status}): ${err.slice(0, 180)}`);
  }

  const data = await res.json();
  const embeddings: number[][] = Array.isArray(data?.data)
    ? data.data.map((d: any) => d?.embedding).filter(Array.isArray)
    : [];
  return { embeddings, model };
}
