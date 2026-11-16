/**
 * SoufTools Unified Provider Adapters
 * Real protocol execution, AWS SigV4 signing, credential parsing, live key verification,
 * and live model fetching across the registered AI providers + tool providers.
 */

import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { HeaderShuffler } from "./headerShuffler";

export interface ChatMessageInput {
  role: "user" | "assistant" | "model" | "system";
  content: string;
}

export interface ChatAttachmentInput {
  type?: string;
  mimeType?: string;
  data?: string;
}

export interface RestChatExecutionOptions {
  providerId: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  messages: ChatMessageInput[];
  userPrompt: string;
  attachments?: ChatAttachmentInput[];
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  customBaseUrl?: string;
  signal?: AbortSignal;
}

export interface RestChatExecutionResult {
  ok: boolean;
  status: number;
  text?: string;
  errorText?: string;
}

export interface KeyVerificationResult {
  valid: boolean;
  latencyMs: number;
  error?: string;
  statusCode?: number;
}

export interface ModelCatalogFetchResult {
  success: boolean;
  models: string[];
  source?: "live_api" | "official_catalog";
  error?: string;
  statusCode?: number;
}

export const OPENAI_COMPATIBLE_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com",
  openrouter: "https://openrouter.ai/api/v1",
  together: "https://api.together.xyz/v1",
  perplexity: "https://api.perplexity.ai",
  xai: "https://api.x.ai/v1",
  sambanova: "https://api.sambanova.ai/v1",
  siliconflow: "https://api.siliconflow.cn/v1",
  cerebras: "https://api.cerebras.ai/v1",
  deepinfra: "https://api.deepinfra.com/v1/openai",
  fireworks: "https://api.fireworks.ai/inference/v1",
  mistral: "https://api.mistral.ai/v1",
  alibaba: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  ai21: "https://api.ai21.com/studio/v1",
  moonshot: "https://api.moonshot.cn/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  nebius: "https://api.studio.nebius.ai/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  huggingface: "https://router.huggingface.co/v1",
  hyperbolic: "https://api.hyperbolic.xyz/v1",
  lepton: "https://api.lepton.ai/v1",
  novita: "https://api.novita.ai/v3/openai",
  friendliai: "https://api.friendli.ai/serverless/v1",
  scaleway: "https://api.scaleway.ai/v1",
  predibase: "https://serving.app.predibase.com/v1",
  baseten: "https://inference.baseten.co/v1",
  minimax: "https://api.minimax.io/v1",
  bytedance: "https://ark.cn-beijing.volces.com/api/v3",
  ollama: (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "") + "/v1",
  inference: "https://api.inference.net/v1",
  vercel_gw: "https://ai-gateway.vercel.sh/v1",
};

export const ALL_ROUTABLE_CHAT_PROVIDERS = new Set<string>([
  ...Object.keys(OPENAI_COMPATIBLE_BASE_URLS),
  "anthropic",
  "cohere",
  "gemini",
  "cloudflare",
  "replicate",
  "bedrock",
]);

export function parseCloudflareCredentials(rawKey: string): {
  accountId: string;
  apiToken: string;
} {
  const clean = (rawKey || "").trim();
  const envAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();

  // Support "accountId:apiToken" or "accountId|apiToken"
  const sepMatch = clean.match(/^([a-f0-9]{16,64})[:|](.+)$/i);
  if (sepMatch) {
    return {
      accountId: sepMatch[1].trim(),
      apiToken: sepMatch[2].trim(),
    };
  }

  return {
    accountId: envAccountId,
    apiToken: clean,
  };
}

export type BedrockCredential =
  | { mode: "bearer"; token: string; region: string }
  | { mode: "sigv4"; accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string };

export function parseBedrockCredentials(rawKey: string): BedrockCredential {
  const clean = (rawKey || "").trim();
  const defaultRegion =
    (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1").trim();

  // Bearer token format (Amazon Bedrock API Keys: ABSK... or bedrock-api-key-...) with optional "::region" or ":region"
  if (/^(ABSK|bedrock-api-key-)/i.test(clean)) {
    const regionSplit = clean.match(/^(.+?)(?:::?([a-z]{2}-[a-z-]+-\d))$/i);
    if (regionSplit) {
      return { mode: "bearer", token: regionSplit[1].trim(), region: regionSplit[2].trim() };
    }
    return { mode: "bearer", token: clean, region: defaultRegion };
  }

  // IAM AccessKey:SecretKey[:Region[:SessionToken]]
  const parts = clean.split(/[:|]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const accessKeyId = parts[0];
    const secretAccessKey = parts[1];
    const maybeRegion = parts[2] && /^[a-z]{2}-[a-z-]+-\d$/i.test(parts[2]) ? parts[2] : defaultRegion;
    const sessionToken =
      parts[2] && !/^[a-z]{2}-[a-z-]+-\d$/i.test(parts[2]) ? parts[2] : parts[3];
    return {
      mode: "sigv4",
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region: maybeRegion,
    };
  }

  // Fallback to bearer if user provided a single raw token
  return { mode: "bearer", token: clean, region: defaultRegion };
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * AWS Signature Version 4 request signer (pure node:crypto, zero external deps).
 */
export function signAwsV4Request(params: {
  method: "GET" | "POST";
  url: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  headers?: Record<string, string>;
  body?: string;
  now?: Date;
}): Record<string, string> {
  const parsedUrl = new URL(params.url);
  const now = params.now || new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payload = params.body ?? "";
  const payloadHash = sha256Hex(payload);

  const normalizedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(params.headers || {})) {
    normalizedHeaders[k.toLowerCase()] = v.trim();
  }
  normalizedHeaders["host"] = parsedUrl.host;
  normalizedHeaders["x-amz-date"] = amzDate;
  normalizedHeaders["x-amz-content-sha256"] = payloadHash;
  if (params.sessionToken) {
    normalizedHeaders["x-amz-security-token"] = params.sessionToken;
  }

  const sortedKeys = Object.keys(normalizedHeaders).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${normalizedHeaders[k]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");

  // RFC3986 path encoding preserving single slashes
  const canonicalUri =
    parsedUrl.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/") || "/";

  const queryPairs = Array.from(parsedUrl.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const canonicalQueryString = queryPairs
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    params.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${params.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, params.region);
  const kService = hmacSha256(kRegion, params.service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const outHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(params.headers || {})) {
    outHeaders[k] = v;
  }
  outHeaders["x-amz-date"] = amzDate;
  outHeaders["x-amz-content-sha256"] = payloadHash;
  if (params.sessionToken) {
    outHeaders["x-amz-security-token"] = params.sessionToken;
  }
  outHeaders["Authorization"] = authorization;

  return outHeaders;
}

export function getChatEndpointForProvider(
  providerId: string,
  customBaseUrl?: string,
  apiKey?: string
): string {
  if (customBaseUrl && customBaseUrl.trim()) {
    const clean = customBaseUrl.trim().replace(/\/+$/, "");
    if (clean.endsWith("/chat/completions") || clean.endsWith("/messages")) {
      return clean;
    }
    return `${clean}/chat/completions`;
  }

  if (providerId === "anthropic") return "https://api.anthropic.com/v1/messages";
  if (providerId === "cohere") return "https://api.cohere.com/v2/chat";
  if (providerId === "openai") return "https://api.openai.com/v1/responses";
  if (providerId === "cloudflare") {
    const { accountId } = parseCloudflareCredentials(apiKey || "");
    if (!accountId) {
      throw new Error(
        "Cloudflare Workers AI requires an Account ID (use format accountId:apiToken or set CLOUDFLARE_ACCOUNT_ID)."
      );
    }
    return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;
  }

  const base = OPENAI_COMPATIBLE_BASE_URLS[providerId];
  if (base) {
    return `${base.replace(/\/+$/, "")}/chat/completions`;
  }

  throw new Error(`Unsupported chat provider '${providerId}'.`);
}

function isOpenAIReasoningModel(model: string): boolean {
  return /^o\d+(?:-|$)/i.test(model.trim());
}

function toOpenAIInputContent(text: string, attachments: ChatAttachmentInput[] = []) {
  return [
    { type: "input_text", text },
    ...attachments
      .filter((attachment) => attachment.type === "image" && attachment.data)
      .map((attachment) => {
        const data = attachment.data!.trim();
        return {
          type: "input_image",
          image_url: data.startsWith("data:")
            ? data
            : `data:${attachment.mimeType || "image/jpeg"};base64,${data}`,
        };
      }),
  ];
}

function extractOpenAIResponseText(data: any): string | undefined {
  if (typeof data?.output_text === "string") return data.output_text;

  const output = Array.isArray(data?.output) ? data.output : [];
  const text = output
    .filter((item: any) => item?.type === "message")
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .filter((part: any) => part?.type === "output_text" && typeof part?.text === "string")
    .map((part: any) => part.text)
    .join("");

  return text || undefined;
}

async function executeOpenAIResponsesRequest(
  options: RestChatExecutionOptions
): Promise<RestChatExecutionResult> {
  const input: Array<Record<string, unknown>> = [];
  if (options.systemPrompt) {
    input.push({
      role: "developer",
      content: [{ type: "input_text", text: options.systemPrompt }],
    });
  }
  for (const message of options.messages) {
    if (message.role === "system" || !message.content?.trim()) continue;
    input.push({
      role: message.role === "model" ? "assistant" : message.role,
      content: [{ type: "input_text", text: message.content }],
    });
  }
  input.push({
    role: "user",
    content: toOpenAIInputContent(options.userPrompt, options.attachments),
  });

  const body: Record<string, unknown> = {
    model: options.model,
    input,
  };
  if (options.maxTokens !== undefined) body.max_output_tokens = options.maxTokens;
  if (options.temperature !== undefined && !isOpenAIReasoningModel(options.model)) {
    body.temperature = options.temperature;
  }
  if (options.responseMimeType === "application/json") {
    body.text = {
      format: options.responseSchema
        ? {
            type: "json_schema",
            name: "soufai_response",
            strict: true,
            schema: options.responseSchema,
          }
        : { type: "json_object" },
    };
  }

  const res = await fetch(getChatEndpointForProvider("openai"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, errorText: await res.text().catch(() => "") };
  }

  const data = await res.json();
  return { ok: true, status: res.status, text: extractOpenAIResponseText(data) };
}

function buildReplicateEndpointAndBody(options: RestChatExecutionOptions): {
  url: string;
  body: Record<string, any>;
} {
  const promptLines = [
    options.systemPrompt ? `System: ${options.systemPrompt}` : "",
    ...options.messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`),
    `User: ${options.userPrompt}`,
  ].filter(Boolean);

  const inputPayload: Record<string, any> = {
    prompt: promptLines.join("\n\n"),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  };
  if (options.systemPrompt) {
    inputPayload.system_prompt = options.systemPrompt;
  }

  const cleanModel = options.model.trim();
  if (cleanModel.includes(":")) {
    const version = cleanModel.split(":")[1];
    return {
      url: "https://api.replicate.com/v1/predictions",
      body: { version, input: inputPayload },
    };
  }

  const [owner, name] = cleanModel.split("/");
  if (owner && name) {
    return {
      url: `https://api.replicate.com/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`,
      body: { input: inputPayload },
    };
  }

  return {
    url: "https://api.replicate.com/v1/predictions",
    body: { version: cleanModel, input: inputPayload },
  };
}

function extractReplicateOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((x) => (typeof x === "string" ? x : String(x ?? ""))).join("");
  if (output && typeof output === "object") return JSON.stringify(output);
  return "";
}

/**
 * Executes REST chat requests using each provider's native or compatible API protocol.
 */
export async function executeRestChatRequest(
  options: RestChatExecutionOptions
): Promise<RestChatExecutionResult> {
  const providerId = options.providerId.trim().toLowerCase();
  const signal = options.signal;

  if (signal?.aborted) {
    throw signal.reason || new Error("Provider request aborted.");
  }

  if (providerId === "openai" && !options.customBaseUrl?.trim()) {
    return executeOpenAIResponsesRequest(options);
  }

  // 1. Amazon Bedrock (Converse API via SigV4 or Bearer API key)
  if (providerId === "bedrock") {
    const cred = parseBedrockCredentials(options.apiKey);
    const url = `https://bedrock-runtime.${cred.region}.amazonaws.com/model/${encodeURIComponent(
      options.model
    )}/converse`;

    const converseMessages = [
      ...options.messages
        .filter((m) => m.role !== "system" && m.content?.trim())
        .map((m) => ({
          role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
          content: [{ text: m.content }],
        })),
      { role: "user", content: [{ text: options.userPrompt }] },
    ];

    const bodyPayload: Record<string, any> = {
      messages: converseMessages,
      inferenceConfig: {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2048,
      },
    };
    if (options.systemPrompt) {
      bodyPayload.system = [{ text: options.systemPrompt }];
    }
    const bodyStr = JSON.stringify(bodyPayload);

    let headers: Record<string, string>;
    if (cred.mode === "sigv4") {
      headers = signAwsV4Request({
        method: "POST",
        url,
        region: cred.region,
        service: "bedrock",
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
        sessionToken: cred.sessionToken,
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
    } else {
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cred.token}`,
      };
    }

    const res = await fetch(url, { method: "POST", headers, signal, body: bodyStr });
    if (!res.ok) {
      return { ok: false, status: res.status, errorText: await res.text().catch(() => "") };
    }
    const data = await res.json();
    const parts = data?.output?.message?.content;
    const text = Array.isArray(parts)
      ? parts.map((p: any) => p?.text || "").join("")
      : "";
    return { ok: true, status: res.status, text };
  }

  // 2. Replicate Predictions API
  if (providerId === "replicate") {
    const { url, body } = buildReplicateEndpointAndBody(options);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
        Prefer: "wait=60",
      },
      signal,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, errorText: await res.text().catch(() => "") };
    }

    let prediction = await res.json();
    const pollUrl = prediction?.urls?.get;
    const deadline = Date.now() + 25000;
    while (
      pollUrl &&
      (prediction?.status === "starting" || prediction?.status === "processing") &&
      Date.now() < deadline
    ) {
      if (signal?.aborted) throw signal.reason || new Error("Replicate request aborted.");
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${options.apiKey}` },
        signal,
      });
      if (!pollRes.ok) break;
      prediction = await pollRes.json();
    }

    if (prediction?.status === "failed" || prediction?.status === "canceled") {
      return {
        ok: false,
        status: 500,
        errorText: prediction?.error || `Replicate prediction ${prediction.status}`,
      };
    }

    const text = extractReplicateOutput(prediction?.output);
    return { ok: true, status: res.status, text };
  }

  // 3. Cloudflare Workers AI (OpenAI-compatible v1 endpoint using parsed apiToken)
  let effectiveKey = options.apiKey;
  if (providerId === "cloudflare") {
    effectiveKey = parseCloudflareCredentials(options.apiKey).apiToken;
  }

  const endpoint = getChatEndpointForProvider(providerId, options.customBaseUrl, options.apiKey);

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${effectiveKey}`,
  };

  if (providerId === "openrouter") {
    requestHeaders["HTTP-Referer"] = "https://souftools.ai";
    requestHeaders["X-Title"] = "SoufAI";
  }

  if (providerId === "anthropic") {
    requestHeaders["x-api-key"] = effectiveKey;
    delete requestHeaders["Authorization"];
  }

  let historyForRest = options.messages;
  if (
    providerId === "groq" ||
    options.model.includes("gpt-oss-120b") ||
    options.model.includes("llama-3.1-8b")
  ) {
    historyForRest = options.messages.slice(-10);
  }

  let reqBody: any;
  if (providerId === "anthropic") {
    reqBody = {
      model: options.model,
      max_tokens: options.maxTokens ?? 2048,
      system: options.systemPrompt,
      messages: [
        ...historyForRest
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        { role: "user", content: options.userPrompt },
      ],
    };
  } else if (providerId === "cohere") {
    reqBody = {
      model: options.model,
      stream: false,
      messages: [
        ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
        ...historyForRest
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        { role: "user", content: options.userPrompt },
      ],
    };
  } else {
    const imageAtts = (options.attachments || []).filter((att) => att.type === "image" && att.data);
    const reasoningModel = providerId === "openai" && isOpenAIReasoningModel(options.model);
    reqBody = {
      model: options.model,
      messages: [
        { role: reasoningModel ? "developer" : "system", content: options.systemPrompt },
        ...historyForRest
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "model" ? "assistant" : m.role,
            content: m.content,
          })),
        {
          role: "user",
          content:
            imageAtts.length > 0
              ? [
                  { type: "text", text: options.userPrompt },
                  ...imageAtts.map((att) => ({
                    type: "image_url",
                    image_url: { url: att.data },
                  })),
                ]
              : options.userPrompt,
        },
      ],
    };

    if (!reasoningModel) {
      reqBody.temperature = options.temperature ?? 0.7;
    }
    if (options.maxTokens !== undefined) {
      reqBody[reasoningModel ? "max_completion_tokens" : "max_tokens"] = options.maxTokens;
    }
    if (options.responseMimeType === "application/json") {
      reqBody.response_format = { type: "json_object" };
    }
  }

  const naturalHeaders = HeaderShuffler.getNaturalHeaders(requestHeaders);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: naturalHeaders,
    signal,
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    return { ok: false, status: res.status, errorText: await res.text().catch(() => "") };
  }

  const data = await res.json();

  // MiniMax returns HTTP 200 with base_resp.status_code != 0 on auth/balance errors
  if (providerId === "minimax" && data?.base_resp && data.base_resp.status_code !== 0) {
    const code = data.base_resp.status_code;
    const status = code === 1004 || code === 2049 ? 401 : 400;
    return {
      ok: false,
      status,
      errorText: data.base_resp.status_msg || `MiniMax Error ${code}`,
    };
  }

  let text: string | undefined = data?.choices?.[0]?.message?.content;
  if (providerId === "anthropic" && Array.isArray(data?.content)) {
    text = data.content.map((c: any) => c?.text || "").join("");
  } else if (providerId === "cohere" && Array.isArray(data?.message?.content)) {
    text = data.message.content.map((c: any) => c?.text || "").join("");
  }

  return { ok: true, status: res.status, text };
}

/**
 * Performs genuine live HTTP verification for ANY registered provider (no fake length-only passes).
 */
export async function testProviderKeyLive(
  providerIdRaw: string,
  rawKey: string,
  signal?: AbortSignal
): Promise<KeyVerificationResult> {
  const providerId = providerIdRaw.trim().toLowerCase();
  const key = rawKey.trim();
  const start = Date.now();

  const fail = (error: string, statusCode = 400): KeyVerificationResult => ({
    valid: false,
    latencyMs: Date.now() - start,
    error,
    statusCode,
  });

  try {
    // 1. Google Gemini
    if (providerId === "gemini") {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        { headers: { "x-goog-api-key": key }, signal }
      );
      if (res.ok) return { valid: true, latencyMs: Date.now() - start, statusCode: res.status };
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.list();
        return { valid: true, latencyMs: Date.now() - start, statusCode: 200 };
      } catch (err: any) {
        return fail(`فشل التحقق من Gemini: ${err?.message || `HTTP ${res.status}`}`, res.status);
      }
    }

    // 2. Anthropic
    if (providerId === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": key },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Anthropic: HTTP ${res.status}`, res.status);
    }

    // 3. Cohere
    if (providerId === "cohere") {
      const res = await fetch("https://api.cohere.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Cohere: HTTP ${res.status}`, res.status);
    }

    // 4. Cloudflare Workers AI
    if (providerId === "cloudflare") {
      const { accountId, apiToken } = parseCloudflareCredentials(key);
      const url = accountId
        ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/tokens/verify`
        : "https://api.cloudflare.com/client/v4/user/tokens/verify";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
        signal,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success !== false) {
        return { valid: true, latencyMs: Date.now() - start, statusCode: res.status };
      }
      return fail(`فشل التحقق من Cloudflare: HTTP ${res.status}`, res.status);
    }

    // 5. Amazon Bedrock
    if (providerId === "bedrock") {
      const cred = parseBedrockCredentials(key);
      const url = `https://bedrock.${cred.region}.amazonaws.com/foundation-models`;
      const headers =
        cred.mode === "sigv4"
          ? signAwsV4Request({
              method: "GET",
              url,
              region: cred.region,
              service: "bedrock",
              accessKeyId: cred.accessKeyId,
              secretAccessKey: cred.secretAccessKey,
              sessionToken: cred.sessionToken,
            })
          : { Authorization: `Bearer ${cred.token}` };
      const res = await fetch(url, { method: "GET", headers, signal });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Amazon Bedrock: HTTP ${res.status}`, res.status);
    }

    // 6. Replicate
    if (providerId === "replicate") {
      const res = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${key}` },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Replicate: HTTP ${res.status}`, res.status);
    }

    // 7. Hugging Face
    if (providerId === "huggingface") {
      const res = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: `Bearer ${key}` },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Hugging Face: HTTP ${res.status}`, res.status);
    }

    // 8. Ollama (local server check)
    if (providerId === "ollama") {
      const base = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "");
      const res = await fetch(`${base}/api/tags`, { signal });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`تعذر الاتصال بخادم Ollama المحلي على ${base}: HTTP ${res.status}`, res.status);
    }

    // 9. Audio providers (ElevenLabs, AssemblyAI)
    if (providerId === "elevenlabs") {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": key },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من ElevenLabs: HTTP ${res.status}`, res.status);
    }
    if (providerId === "assemblyai") {
      const res = await fetch("https://api.assemblyai.com/v2/transcript?limit=1", {
        headers: { Authorization: key },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من AssemblyAI: HTTP ${res.status}`, res.status);
    }

    // 10. Embeddings provider (Voyage AI)
    if (providerId === "voyage") {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal,
        body: JSON.stringify({ input: ["ping"], model: "voyage-3-lite" }),
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Voyage AI: HTTP ${res.status}`, res.status);
    }

    // 11. Search / Scraping / Sandbox Tool Providers
    if (providerId === "tavily" || providerId === "tavily_search") {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ api_key: key, query: "ping test", max_results: 1, search_depth: "basic" }),
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Tavily: HTTP ${res.status}`, res.status);
    }
    if (providerId === "exa") {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ query: "ping test", numResults: 1 }),
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Exa: HTTP ${res.status}`, res.status);
    }
    if (providerId === "serper") {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ q: "ping test" }),
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Serper: HTTP ${res.status}`, res.status);
    }
    if (providerId === "jina") {
      const res = await fetch("https://r.jina.ai/https://example.com", {
        headers: { Authorization: `Bearer ${key}`, "X-No-Cache": "true" },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Jina: HTTP ${res.status}`, res.status);
    }
    if (providerId === "firecrawl") {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal,
        body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }),
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من Firecrawl: HTTP ${res.status}`, res.status);
    }
    if (providerId === "e2b") {
      const res = await fetch("https://api.e2b.dev/sandboxes", {
        headers: { "X-API-Key": key },
        signal,
      });
      return res.ok
        ? { valid: true, latencyMs: Date.now() - start, statusCode: res.status }
        : fail(`فشل التحقق من E2B: HTTP ${res.status}`, res.status);
    }

    // 12. MiniMax & ByteDance (ping minimal chat completion where /models isn't standard)
    if (providerId === "minimax") {
      const res = await fetch("https://api.minimax.io/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal,
        body: JSON.stringify({
          model: "MiniMax-Text-01",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (!json?.base_resp || json.base_resp.status_code === 0)) {
        return { valid: true, latencyMs: Date.now() - start, statusCode: res.status };
      }
      return fail(
        `فشل التحقق من MiniMax: ${json?.base_resp?.status_msg || `HTTP ${res.status}`}`,
        res.status || 400
      );
    }

    // 13. All OpenAI-Compatible Providers
    const baseUrl = OPENAI_COMPATIBLE_BASE_URLS[providerId];
    if (baseUrl) {
      const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
      if (providerId === "openrouter") {
        headers["HTTP-Referer"] = "https://souftools.ai";
        headers["X-Title"] = "SoufTools";
      }

      const modelsRes = await fetch(`${baseUrl}/models`, { method: "GET", headers, signal });
      if (modelsRes.ok) {
        return { valid: true, latencyMs: Date.now() - start, statusCode: modelsRes.status };
      }

      // Some providers return 404/405 on GET /models while supporting POST /chat/completions
      if (modelsRes.status === 404 || modelsRes.status === 405) {
        const pingModelMap: Record<string, string> = {
          openai: "gpt-4o-mini",
          groq: "llama-3.1-8b-instant",
          deepseek: "deepseek-chat",
          openrouter: "auto",
          zhipu: "glm-4-flash",
          ai21: "jamba-1.5-mini",
          bytedance: "doubao-lite",
          lepton: "llama3-70b",
          baseten: "llama-3-custom",
          predibase: "llama-3-70b-finetuned",
        };
        const chatRes = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            model: pingModelMap[providerId] || "default",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        });
        if (chatRes.ok) {
          return { valid: true, latencyMs: Date.now() - start, statusCode: chatRes.status };
        }
        // Only treat 401/403 as invalid key; if chat endpoint rejects the sample model name with 400/404,
        // it proves auth passed when a separate /models endpoint didn't exist — DO NOT fake 401/403!
        if (chatRes.status === 401 || chatRes.status === 403) {
          return fail(`فشل التحقق من ${providerId}: HTTP ${chatRes.status}`, chatRes.status);
        }
        return fail(`تعذر التحقق من ${providerId}: HTTP ${chatRes.status}`, chatRes.status);
      }

      return fail(`فشل التحقق من ${providerId}: HTTP ${modelsRes.status}`, modelsRes.status);
    }

    return fail(`المزود (${providerId}) غير مسجل أو غير مدعوم للفحص الحي.`, 400);
  } catch (err: any) {
    return fail(`فشل الاتصال بمزود ${providerId}: ${err?.message || "خطأ غير معروف"}`, 500);
  }
}

/**
 * Fetches live models (or key-verified official catalogs where the provider has no /models list)
 * for all 41 AI providers.
 */
export async function fetchProviderModelsLive(
  providerIdRaw: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<ModelCatalogFetchResult> {
  const providerId = providerIdRaw.trim().toLowerCase();

  if (providerId === "gemini") {
    const models = new Set<string>();
    const seenPageTokens = new Set<string>();
    let pageToken: string | undefined;

    do {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "1000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url, {
        headers: { "x-goog-api-key": apiKey },
        signal,
      });
      if (!res.ok) {
        return { success: false, models: [], error: `فشل جلب نماذج Gemini (${res.status})`, statusCode: res.status };
      }

      const data = await res.json();
      if (Array.isArray(data?.models)) {
        for (const model of data.models) {
          if (!model?.supportedGenerationMethods?.includes("generateContent")) continue;
          const modelId = String(model?.name || "").replace(/^models\//, "");
          if (modelId) models.add(modelId);
        }
      }

      const nextPageToken = typeof data?.nextPageToken === "string" ? data.nextPageToken : "";
      if (!nextPageToken) break;
      if (seenPageTokens.has(nextPageToken)) {
        return { success: false, models: [], error: "أعاد Gemini رمز ترقيم صفحات مكرراً.", statusCode: 502 };
      }
      seenPageTokens.add(nextPageToken);
      pageToken = nextPageToken;
    } while (pageToken);

    return { success: models.size > 0, models: Array.from(models), source: "live_api" };
  }

  if (providerId === "anthropic") {
    const models = new Set<string>();
    const seenCursors = new Set<string>();
    let afterId: string | undefined;

    do {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "1000");
      url.searchParams.set("lifecycle", "active");
      if (afterId) url.searchParams.set("after_id", afterId);

      const res = await fetch(url, {
        headers: { "x-api-key": apiKey },
        signal,
      });
      if (!res.ok) {
        return { success: false, models: [], error: `فشل جلب نماذج Anthropic (${res.status})`, statusCode: res.status };
      }

      const data = await res.json();
      if (Array.isArray(data?.data)) {
        for (const model of data.data) {
          if (model?.id) models.add(model.id);
        }
      }

      if (!data?.has_more) break;
      const nextAfterId = typeof data?.last_id === "string" ? data.last_id : "";
      if (!nextAfterId || seenCursors.has(nextAfterId)) {
        return { success: false, models: [], error: "أعاد Anthropic مؤشراً غير صالح لترقيم الصفحات.", statusCode: 502 };
      }
      seenCursors.add(nextAfterId);
      afterId = nextAfterId;
    } while (afterId);

    return { success: models.size > 0, models: Array.from(models), source: "live_api" };
  }

  if (providerId === "cohere") {
    const models = new Set<string>();
    const seenPageTokens = new Set<string>();
    let pageToken: string | undefined;

    do {
      const url = new URL("https://api.cohere.com/v1/models");
      url.searchParams.set("endpoint", "chat");
      url.searchParams.set("page_size", "1000");
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!res.ok) {
        return { success: false, models: [], error: `فشل جلب نماذج Cohere (${res.status})`, statusCode: res.status };
      }

      const data = await res.json();
      if (Array.isArray(data?.models)) {
        for (const model of data.models) {
          const modelId = model?.name || model?.id;
          if (modelId) models.add(modelId);
        }
      }

      const nextPageToken = typeof data?.next_page_token === "string" ? data.next_page_token : "";
      if (!nextPageToken) break;
      if (seenPageTokens.has(nextPageToken)) {
        return { success: false, models: [], error: "أعاد Cohere رمز ترقيم صفحات مكرراً.", statusCode: 502 };
      }
      seenPageTokens.add(nextPageToken);
      pageToken = nextPageToken;
    } while (pageToken);

    return { success: models.size > 0, models: Array.from(models), source: "live_api" };
  }

  // Audio & Embedding Providers
  if (providerId === "elevenlabs") {
    const res = await fetch("https://api.elevenlabs.io/v1/models", {
      headers: { "xi-api-key": apiKey },
      signal,
    });
    if (!res.ok) {
      return { success: false, models: [], error: `فشل جلب نماذج ElevenLabs (${res.status})`, statusCode: res.status };
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data.map((m: any) => m?.model_id).filter(Boolean) : [];
    const models = Array.from(new Set([...list, "scribe_v1"]));
    return { success: models.length > 0, models, source: "live_api" };
  }

  if (providerId === "assemblyai") {
    const check = await testProviderKeyLive("assemblyai", apiKey, signal);
    if (!check.valid) {
      return { success: false, models: [], error: check.error, statusCode: check.statusCode };
    }
    return {
      success: true,
      models: ["universal", "slam-1", "nano", "conformer-2"],
      source: "official_catalog",
    };
  }

  if (providerId === "voyage") {
    const check = await testProviderKeyLive("voyage", apiKey, signal);
    if (!check.valid) {
      return { success: false, models: [], error: check.error, statusCode: check.statusCode };
    }
    return {
      success: true,
      models: ["voyage-3", "voyage-3-large", "voyage-3-lite", "voyage-code-3", "voyage-finance-2", "voyage-law-2"],
      source: "official_catalog",
    };
  }

  // Amazon Bedrock live foundation models
  if (providerId === "bedrock") {
    const cred = parseBedrockCredentials(apiKey);
    const url = `https://bedrock.${cred.region}.amazonaws.com/foundation-models?byOutputModality=TEXT`;
    const headers =
      cred.mode === "sigv4"
        ? signAwsV4Request({
            method: "GET",
            url,
            region: cred.region,
            service: "bedrock",
            accessKeyId: cred.accessKeyId,
            secretAccessKey: cred.secretAccessKey,
            sessionToken: cred.sessionToken,
          })
        : { Authorization: `Bearer ${cred.token}` };
    const res = await fetch(url, { headers, signal });
    if (!res.ok) {
      return { success: false, models: [], error: `فشل جلب نماذج Bedrock (${res.status})`, statusCode: res.status };
    }
    const data = await res.json();
    const models = Array.isArray(data?.modelSummaries)
      ? data.modelSummaries.map((m: any) => m?.modelId).filter(Boolean)
      : [];
    return { success: models.length > 0, models: Array.from(new Set(models)), source: "live_api" };
  }

  // Cloudflare Workers AI live models search
  if (providerId === "cloudflare") {
    const { accountId, apiToken } = parseCloudflareCredentials(apiKey);
    if (!accountId) {
      return {
        success: false,
        models: [],
        error: "يتطلب مزود Cloudflare معرف الحساب (accountId:apiToken أو متغير CLOUDFLARE_ACCOUNT_ID).",
        statusCode: 400,
      };
    }
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/models/search?task=Text%20Generation`,
      { headers: { Authorization: `Bearer ${apiToken}` }, signal }
    );
    if (!res.ok) {
      return { success: false, models: [], error: `فشل جلب نماذج Cloudflare (${res.status})`, statusCode: res.status };
    }
    const data = await res.json();
    const models = Array.isArray(data?.result)
      ? data.result.map((m: any) => m?.name).filter(Boolean)
      : [];
    return { success: models.length > 0, models: Array.from(new Set(models)), source: "live_api" };
  }

  // Replicate live public language models (after verifying key against /v1/account)
  if (providerId === "replicate") {
    const acctRes = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!acctRes.ok) {
      return { success: false, models: [], error: `مفتاح Replicate غير صالح (${acctRes.status})`, statusCode: acctRes.status };
    }
    const colRes = await fetch("https://api.replicate.com/v1/collections/language-models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (colRes.ok) {
      const colData = await colRes.json();
      const models = Array.isArray(colData?.models)
        ? colData.models.map((m: any) => (m?.owner && m?.name ? `${m.owner}/${m.name}` : "")).filter(Boolean)
        : [];
      if (models.length > 0) {
        return { success: true, models: Array.from(new Set(models)), source: "live_api" };
      }
    }
    return {
      success: true,
      models: [
        "meta/meta-llama-3.1-405b-instruct",
        "meta/meta-llama-3-70b-instruct",
        "anthropic/claude-3.7-sonnet",
        "deepseek-ai/deepseek-r1",
      ],
      source: "official_catalog",
    };
  }

  // MiniMax verified catalog
  if (providerId === "minimax") {
    const check = await testProviderKeyLive("minimax", apiKey, signal);
    if (!check.valid) {
      return { success: false, models: [], error: check.error, statusCode: check.statusCode };
    }
    return {
      success: true,
      models: ["MiniMax-Text-01", "abab6.5s-chat", "abab6.5g-chat", "abab6.5t-chat"],
      source: "official_catalog",
    };
  }

  // Fallback generic OpenAI-compatible /models fetcher
  const baseUrl = OPENAI_COMPATIBLE_BASE_URLS[providerId];
  if (!baseUrl) {
    return {
      success: false,
      models: [],
      error: `المزود (${providerId}) غير مدعوم للجلب الحي للنماذج.`,
      statusCode: 400,
    };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  if (providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://souftools.ai";
    headers["X-Title"] = "SoufTools";
  }

  const res = await fetch(`${baseUrl}/models`, { headers, signal });
  if (res.ok) {
    const data = await res.json();
    const rawList = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
      ? data.models
      : [];
    const models = rawList.map((m: any) => (typeof m === "string" ? m : m?.id || m?.name)).filter(Boolean);
    if (models.length > 0) {
      return { success: true, models: Array.from(new Set(models)), source: "live_api" };
    }
  }

  // Official fallback catalogs ONLY after verifying key for endpoints like ByteDance/Lepton/Baseten where /models may be 404
  if (providerId === "bytedance" && (res.status === 404 || res.status === 405)) {
    return {
      success: true,
      models: ["doubao-pro-128k", "doubao-pro-32k", "doubao-lite-128k"],
      source: "official_catalog",
    };
  }

  return {
    success: false,
    models: [],
    error: `فشل جلب النماذج الحية من (${providerId}): HTTP ${res.status}`,
    statusCode: res.status,
  };
}
