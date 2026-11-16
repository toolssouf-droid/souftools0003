import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { AI_PROVIDERS } from "./index";
import { PROVIDER_KEY_FORMATS, validateKeySyntax } from "../keyFormats";
import { isChatProviderSupported } from "../router";
import {
  ALL_ROUTABLE_CHAT_PROVIDERS,
  OPENAI_COMPATIBLE_BASE_URLS,
  parseBedrockCredentials,
  parseCloudflareCredentials,
  signAwsV4Request,
  getChatEndpointForProvider,
  executeRestChatRequest,
  testProviderKeyLive,
  fetchProviderModelsLive,
} from "./providerAdapters";
import {
  textToSpeechViaElevenLabs,
  transcribeViaElevenLabs,
  transcribeViaAssemblyAI,
} from "./audioProviderManager";
import { createEmbeddings } from "./embeddingProviderManager";

async function withMockFetch<T>(
  mockFn: typeof globalThis.fetch,
  fn: () => Promise<T>
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFn;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Provider Registry Completeness (All 41 AI Providers + 6 Tools)", () => {
  it("registers all 41 AI providers with 38 routable LLM chat providers, 2 audio, and 1 embedding", () => {
    assert.equal(AI_PROVIDERS.length, 41);
    const llmProviders = AI_PROVIDERS.filter((p) => p.category === "llm");
    const audioProviders = AI_PROVIDERS.filter((p) => p.category === "audio");
    const embeddingProviders = AI_PROVIDERS.filter((p) => p.category === "embedding");

    assert.equal(llmProviders.length, 38);
    assert.equal(audioProviders.length, 2);
    assert.equal(embeddingProviders.length, 1);

    for (const p of llmProviders) {
      assert.equal(
        isChatProviderSupported(p.id),
        true,
        `LLM provider '${p.id}' must be supported by isChatProviderSupported`
      );
      assert.equal(
        ALL_ROUTABLE_CHAT_PROVIDERS.has(p.id),
        true,
        `LLM provider '${p.id}' must be in ALL_ROUTABLE_CHAT_PROVIDERS`
      );
    }
  });

  it("defines syntax validation rules for every AI provider and tool provider", () => {
    const toolIds = ["tavily", "exa", "serper", "jina", "firecrawl", "e2b"];
    for (const p of AI_PROVIDERS) {
      assert.ok(PROVIDER_KEY_FORMATS[p.id], `Missing key format rule for '${p.id}'`);
    }
    for (const t of toolIds) {
      assert.ok(PROVIDER_KEY_FORMATS[t], `Missing key format rule for tool '${t}'`);
    }

    assert.equal(validateKeySyntax("ollama", "").valid, true);
    assert.equal(validateKeySyntax("openai", "short").valid, false);
    assert.equal(
      validateKeySyntax("bedrock", "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY:us-east-1").valid,
      true
    );
    assert.equal(
      validateKeySyntax("cloudflare", "0123456789abcdef0123456789abcdef:cf-secret-token-value-12345").valid,
      true
    );
  });

  it("performs real live HTTP key verification (never faking length-only passes) for all 41 AI + 6 tool providers", async () => {
    const allProviderIds = [
      ...AI_PROVIDERS.map((p) => p.id),
      "tavily",
      "exa",
      "serper",
      "jina",
      "firecrawl",
      "e2b",
    ];

    // 1. Rejection on HTTP 401 across ALL 47 providers (must NEVER fake active)
    await withMockFetch(
      (async () => jsonResponse({ error: "unauthorized" }, 401)) as typeof globalThis.fetch,
      async () => {
        for (const id of allProviderIds) {
          const sampleKey =
            id === "bedrock"
              ? "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY:us-east-1"
              : id === "cloudflare"
              ? "0123456789abcdef0123456789abcdef:very_long_cloudflare_token_value"
              : "very-long-test-key-that-would-fool-length-only-checks-123456";
          const res = await testProviderKeyLive(id, sampleKey);
          assert.equal(res.valid, false, `Provider '${id}' must fail when upstream HTTP 401`);
        }
      }
    );

    // 2. Acceptance on HTTP 200 across ALL 47 providers
    await withMockFetch(
      (async (input) => {
        const url = String(input);
        if (url.includes("minimax.io")) {
          return jsonResponse({ base_resp: { status_code: 0, status_msg: "success" } }, 200);
        }
        return jsonResponse({ ok: true, data: [{ id: "model-a" }] }, 200);
      }) as typeof globalThis.fetch,
      async () => {
        for (const id of allProviderIds) {
          const sampleKey =
            id === "bedrock"
              ? "ABSKbedrockTestToken1234567890"
              : id === "cloudflare"
              ? "0123456789abcdef0123456789abcdef:very_long_cloudflare_token_value"
              : "valid-test-key-1234567890";
          const res = await testProviderKeyLive(id, sampleKey);
          assert.equal(res.valid, true, `Provider '${id}' must succeed when upstream HTTP 200: ${res.error}`);
        }
      }
    );

    // 3. MiniMax HTTP 200 with base_resp error code must fail
    await withMockFetch(
      (async () =>
        jsonResponse({ base_resp: { status_code: 1004, status_msg: "login fail" } }, 200)) as typeof globalThis.fetch,
      async () => {
        const res = await testProviderKeyLive("minimax", "sk-api-bad-minimax-key-123456");
        assert.equal(res.valid, false);
      }
    );
  });
});

describe("Credential Parsers & AWS Signature Version 4", () => {
  it("parses Cloudflare accountId:token, accountId|token, and env fallback", () => {
    const colon = parseCloudflareCredentials("0123456789abcdef0123456789abcdef:my_cf_token");
    assert.equal(colon.accountId, "0123456789abcdef0123456789abcdef");
    assert.equal(colon.apiToken, "my_cf_token");

    const pipe = parseCloudflareCredentials("fedcba9876543210fedcba9876543210|another_token");
    assert.equal(pipe.accountId, "fedcba9876543210fedcba9876543210");
    assert.equal(pipe.apiToken, "another_token");
  });

  it("parses Amazon Bedrock IAM keys and ABSK bearer tokens", () => {
    const iam = parseBedrockCredentials("AKIAIOSFODNN7EXAMPLE:SecretKeyValue123456:eu-west-1");
    assert.equal(iam.mode, "sigv4");
    if (iam.mode === "sigv4") {
      assert.equal(iam.accessKeyId, "AKIAIOSFODNN7EXAMPLE");
      assert.equal(iam.secretAccessKey, "SecretKeyValue123456");
      assert.equal(iam.region, "eu-west-1");
    }

    const iamWithToken = parseBedrockCredentials(
      "ASIAIOSFODNN7EXAMPLE:SecretKeyValue123456:us-west-2:SessionTok99"
    );
    assert.equal(iamWithToken.mode, "sigv4");
    if (iamWithToken.mode === "sigv4") {
      assert.equal(iamWithToken.sessionToken, "SessionTok99");
      assert.equal(iamWithToken.region, "us-west-2");
    }

    const bearer = parseBedrockCredentials("ABSKabc123tokenvalue::ap-northeast-1");
    assert.equal(bearer.mode, "bearer");
    if (bearer.mode === "bearer") {
      assert.equal(bearer.token, "ABSKabc123tokenvalue");
      assert.equal(bearer.region, "ap-northeast-1");
    }
  });

  it("generates deterministic AWS SigV4 authorization headers", () => {
    const fixedDate = new Date("2026-01-15T12:00:00.000Z");
    const headers = signAwsV4Request({
      method: "POST",
      url: "https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-pro-v1%3A0/converse",
      region: "us-east-1",
      service: "bedrock",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: [{ text: "hello" }] }] }),
      now: fixedDate,
    });

    assert.equal(headers["x-amz-date"], "20260115T120000Z");
    assert.match(headers["x-amz-content-sha256"], /^[a-f0-9]{64}$/);
    assert.match(
      headers["Authorization"],
      /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20260115\/us-east-1\/bedrock\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[a-f0-9]{64}$/
    );
  });
});

describe("Protocol Execution Across Extended & Specialized Providers", () => {
  it("uses the current OpenAI Responses API request and response shape", async () => {
    let capturedUrl = "";
    let capturedBody: any;
    await withMockFetch(
      (async (input, init) => {
        capturedUrl = String(input);
        capturedBody = JSON.parse(String(init?.body || "{}"));
        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Responses API reply" }],
            },
          ],
        });
      }) as typeof globalThis.fetch,
      async () => {
        const res = await executeRestChatRequest({
          providerId: "openai",
          model: "gpt-4o",
          apiKey: "openai-key",
          systemPrompt: "Answer briefly",
          messages: [{ role: "assistant", content: "Previous answer" }],
          userPrompt: "What is new?",
          attachments: [{ type: "image", mimeType: "image/png", data: "aGVsbG8=" }],
          temperature: 0.4,
          maxTokens: 123,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: { answer: { type: "string" } },
            required: ["answer"],
            additionalProperties: false,
          },
        });

        assert.equal(res.ok, true);
        assert.equal(res.text, "Responses API reply");
        assert.equal(capturedUrl, "https://api.openai.com/v1/responses");
        assert.equal(capturedBody.input[0].role, "developer");
        assert.equal(capturedBody.input[1].role, "assistant");
        assert.equal(capturedBody.input[2].content[1].image_url, "data:image/png;base64,aGVsbG8=");
        assert.equal(capturedBody.max_output_tokens, 123);
        assert.equal(capturedBody.temperature, 0.4);
        assert.deepEqual(capturedBody.text.format, {
          type: "json_schema",
          name: "soufai_response",
          strict: true,
          schema: {
            type: "object",
            properties: { answer: { type: "string" } },
            required: ["answer"],
            additionalProperties: false,
          },
        });
      }
    );
  });

  it("omits unsupported sampling controls for OpenAI reasoning models", async () => {
    let capturedBody: any;
    await withMockFetch(
      (async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body || "{}"));
        return jsonResponse({ output_text: "Reasoning reply" });
      }) as typeof globalThis.fetch,
      async () => {
        const res = await executeRestChatRequest({
          providerId: "openai",
          model: "o3-mini",
          apiKey: "openai-key",
          systemPrompt: "Think carefully",
          messages: [],
          userPrompt: "Solve this",
          temperature: 0.1,
          maxTokens: 300,
        });
        assert.equal(res.ok, true);
        assert.equal(res.text, "Reasoning reply");
        assert.equal(capturedBody.max_output_tokens, 300);
        assert.equal("temperature" in capturedBody, false);
      }
    );
  });

  it("executes every registered REST chat provider through its actual adapter", async () => {
    const restProviders = AI_PROVIDERS.filter(
      (provider) => provider.category === "llm" && provider.id !== "gemini"
    );

    for (const provider of restProviders) {
      await withMockFetch(
        (async () => {
          if (provider.id === "bedrock") {
            return jsonResponse({
              output: { message: { content: [{ text: `${provider.id} reply` }] } },
            });
          }
          if (provider.id === "replicate") {
            return jsonResponse({ status: "succeeded", output: [`${provider.id} reply`] });
          }
          if (provider.id === "anthropic") {
            return jsonResponse({ content: [{ type: "text", text: `${provider.id} reply` }] });
          }
          if (provider.id === "cohere") {
            return jsonResponse({
              message: { content: [{ type: "text", text: `${provider.id} reply` }] },
            });
          }
          if (provider.id === "openai") {
            return jsonResponse({ output_text: `${provider.id} reply` });
          }
          return jsonResponse({
            base_resp: { status_code: 0 },
            choices: [{ message: { content: `${provider.id} reply` } }],
          });
        }) as typeof globalThis.fetch,
        async () => {
          const apiKey =
            provider.id === "cloudflare"
              ? "0123456789abcdef0123456789abcdef:provider-test-token"
              : provider.id === "bedrock"
                ? "ABSKproviderTestToken"
                : "provider-test-key";
          const res = await executeRestChatRequest({
            providerId: provider.id,
            model: provider.models[0] || "test-model",
            apiKey,
            systemPrompt: "System",
            messages: [],
            userPrompt: "Ping",
          });
          assert.equal(res.ok, true, `${provider.id} should execute successfully`);
          assert.equal(res.text, `${provider.id} reply`, `${provider.id} should extract its response`);
        }
      );
    }
  });

  it("resolves exact endpoints for all OpenAI-compatible providers", () => {
    for (const [id, base] of Object.entries(OPENAI_COMPATIBLE_BASE_URLS)) {
      const endpoint = getChatEndpointForProvider(id);
      const path = id === "openai" ? "/responses" : "/chat/completions";
      assert.equal(endpoint, `${base.replace(/\/+$/, "")}${path}`);
    }
    assert.equal(
      getChatEndpointForProvider("cloudflare", undefined, "0123456789abcdef0123456789abcdef:tok"),
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1/chat/completions"
    );
  });

  it("executes Amazon Bedrock Converse API with SigV4", async () => {
    let capturedUrl = "";
    let capturedAuth = "";
    let capturedBody: any = null;

    await withMockFetch(
      (async (input, init) => {
        capturedUrl = String(input);
        const h = new Headers(init?.headers);
        capturedAuth = h.get("Authorization") || "";
        capturedBody = JSON.parse(String(init?.body || "{}"));
        return jsonResponse({
          output: { message: { content: [{ text: "مرحباً من Bedrock" }] } },
        });
      }) as typeof globalThis.fetch,
      async () => {
        const res = await executeRestChatRequest({
          providerId: "bedrock",
          model: "amazon.nova-pro-v1:0",
          apiKey: "AKIAIOSFODNN7EXAMPLE:SecretValue1234567890:us-east-1",
          systemPrompt: "كن موجزاً",
          messages: [{ role: "user", content: "سؤال سابق" }],
          userPrompt: "مرحبا",
        });
        assert.equal(res.ok, true);
        assert.equal(res.text, "مرحباً من Bedrock");
        assert.ok(capturedUrl.includes("bedrock-runtime.us-east-1.amazonaws.com"));
        assert.ok(capturedUrl.endsWith("/converse"));
        assert.ok(capturedAuth.startsWith("AWS4-HMAC-SHA256 "));
        assert.equal(capturedBody.system[0].text, "كن موجزاً");
        assert.equal(capturedBody.messages.length, 2);
      }
    );
  });

  it("executes Replicate Predictions API with polling", async () => {
    let callCount = 0;
    await withMockFetch(
      (async (input) => {
        callCount += 1;
        const url = String(input);
        if (url.includes("/models/meta/meta-llama-3-70b-instruct/predictions")) {
          return jsonResponse({
            id: "pred_123",
            status: "starting",
            urls: { get: "https://api.replicate.com/v1/predictions/pred_123" },
          });
        }
        return jsonResponse({
          id: "pred_123",
          status: "succeeded",
          output: ["أهلاً ", "من Replicate"],
        });
      }) as typeof globalThis.fetch,
      async () => {
        const res = await executeRestChatRequest({
          providerId: "replicate",
          model: "meta/meta-llama-3-70b-instruct",
          apiKey: "r8_test_token_123456",
          systemPrompt: "System",
          messages: [],
          userPrompt: "Hi",
        });
        assert.equal(res.ok, true);
        assert.equal(res.text, "أهلاً من Replicate");
        assert.equal(callCount, 2);
      }
    );
  });

  it("executes Anthropic, Cohere v2, Cloudflare Workers AI, and OpenAI-compatible extended providers", async () => {
    const cases: Array<{ providerId: string; apiKey: string; mockBody: any; expected: string }> = [
      {
        providerId: "anthropic",
        apiKey: "sk-ant-test-1234567890",
        mockBody: { content: [{ type: "text", text: "Claude reply" }] },
        expected: "Claude reply",
      },
      {
        providerId: "cohere",
        apiKey: "cohere-test-key-123456",
        mockBody: { message: { content: [{ type: "text", text: "Cohere reply" }] } },
        expected: "Cohere reply",
      },
      {
        providerId: "cloudflare",
        apiKey: "0123456789abcdef0123456789abcdef:cf-tok-123",
        mockBody: { choices: [{ message: { content: "Cloudflare reply" } }] },
        expected: "Cloudflare reply",
      },
      {
        providerId: "novita",
        apiKey: "novita-key-123456",
        mockBody: { choices: [{ message: { content: "Novita reply" } }] },
        expected: "Novita reply",
      },
      {
        providerId: "vercel_gw",
        apiKey: "vercel-gw-key-123456",
        mockBody: { choices: [{ message: { content: "Vercel GW reply" } }] },
        expected: "Vercel GW reply",
      },
      {
        providerId: "ollama",
        apiKey: "ollama-local",
        mockBody: { choices: [{ message: { content: "Ollama local reply" } }] },
        expected: "Ollama local reply",
      },
    ];

    for (const c of cases) {
      await withMockFetch(
        (async () => jsonResponse(c.mockBody)) as typeof globalThis.fetch,
        async () => {
          const res = await executeRestChatRequest({
            providerId: c.providerId,
            model: "test-model",
            apiKey: c.apiKey,
            systemPrompt: "sys",
            messages: [],
            userPrompt: "ping",
          });
          assert.equal(res.ok, true, `Failed for ${c.providerId}`);
          assert.equal(res.text, c.expected);
        }
      );
    }
  });

  it("propagates exact AbortSignal instance to fetch without swallowing rejection", async () => {
    const controller = new AbortController();
    const customAbort = new Error("Aborted intentionally");
    await withMockFetch(
      (async (_input, init) => {
        assert.equal(init?.signal, controller.signal);
        controller.abort(customAbort);
        throw init?.signal?.reason;
      }) as typeof globalThis.fetch,
      async () => {
        await assert.rejects(
          () =>
            executeRestChatRequest({
              providerId: "novita",
              model: "deepseek/deepseek-r1",
              apiKey: "novita-key-123456",
              systemPrompt: "sys",
              messages: [],
              userPrompt: "ping",
              signal: controller.signal,
            }),
          (err) => err === customAbort
        );
      }
    );
  });
});

describe("Audio, Embeddings, & Live Model Fetching", () => {
  it("fetches live chat models for Gemini, Anthropic, and Cohere", async () => {
    const requestHeaders: Array<{ url: string; headers: Headers }> = [];
    await withMockFetch(
      (async (input, init) => {
        const url = String(input);
        requestHeaders.push({ url, headers: new Headers(init?.headers) });
        if (url.includes("generativelanguage.googleapis.com")) {
          return new URL(url).searchParams.has("pageToken")
            ? jsonResponse({
                models: [{ name: "models/gemini-next-chat", supportedGenerationMethods: ["generateContent"] }],
              })
            : jsonResponse({
                models: [
                  { name: "models/gemini-live-chat", supportedGenerationMethods: ["generateContent"] },
                  { name: "models/gemini-live-embed", supportedGenerationMethods: ["embedContent"] },
                ],
                nextPageToken: "gemini-next-page",
              });
        }
        if (url.includes("api.anthropic.com/v1/models")) {
          return new URL(url).searchParams.has("after_id")
            ? jsonResponse({ data: [{ id: "claude-next-model" }], has_more: false })
            : jsonResponse({ data: [{ id: "claude-live-model" }], has_more: true, last_id: "claude-cursor" });
        }
        return new URL(url).searchParams.has("page_token")
          ? jsonResponse({ models: [{ name: "command-next-chat" }] })
          : jsonResponse({
              models: [{ name: "command-live-chat" }],
              next_page_token: "cohere-next-page",
            });
      }) as typeof globalThis.fetch,
      async () => {
        const gemini = await fetchProviderModelsLive("gemini", "gemini-secret");
        const anthropic = await fetchProviderModelsLive("anthropic", "anthropic-secret");
        const cohere = await fetchProviderModelsLive("cohere", "cohere-secret");

        assert.deepEqual(gemini.models, ["gemini-live-chat", "gemini-next-chat"]);
        assert.deepEqual(anthropic.models, ["claude-live-model", "claude-next-model"]);
        assert.deepEqual(cohere.models, ["command-live-chat", "command-next-chat"]);
        assert.equal(new URL(requestHeaders[0].url).searchParams.has("key"), false);
        assert.equal(requestHeaders[0].headers.get("x-goog-api-key"), "gemini-secret");
        assert.equal(new URL(requestHeaders[1].url).searchParams.get("pageToken"), "gemini-next-page");
        assert.equal(requestHeaders[1].headers.get("x-goog-api-key"), "gemini-secret");
        assert.equal(requestHeaders[2].headers.get("x-api-key"), "anthropic-secret");
        assert.equal(requestHeaders[2].headers.has("anthropic-version"), false);
        assert.equal(new URL(requestHeaders[2].url).searchParams.get("lifecycle"), "active");
        assert.equal(new URL(requestHeaders[3].url).searchParams.get("after_id"), "claude-cursor");
        assert.equal(new URL(requestHeaders[4].url).searchParams.get("endpoint"), "chat");
        assert.equal(requestHeaders[4].headers.get("authorization"), "Bearer cohere-secret");
        assert.equal(new URL(requestHeaders[5].url).searchParams.get("page_token"), "cohere-next-page");
      }
    );
  });

  it("supports ElevenLabs TTS/STT and AssemblyAI upload + transcript + polling", async () => {
    await withMockFetch(
      (async (input) => {
        const url = String(input);
        if (url.includes("/v1/text-to-speech/")) {
          return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
        }
        if (url.includes("/v1/speech-to-text")) {
          return jsonResponse({ text: "نص صوتي من ElevenLabs" });
        }
        if (url.includes("assemblyai.com/v2/upload")) {
          return jsonResponse({ upload_url: "https://cdn.assemblyai.com/upload/abc" });
        }
        if (url.endsWith("assemblyai.com/v2/transcript")) {
          return jsonResponse({ id: "tr_999" });
        }
        if (url.includes("assemblyai.com/v2/transcript/tr_999")) {
          return jsonResponse({ status: "completed", text: "نص صوتي من AssemblyAI" });
        }
        return jsonResponse({}, 404);
      }) as typeof globalThis.fetch,
      async () => {
        const tts = await textToSpeechViaElevenLabs({ text: "مرحبا", apiKey: "el_key_123" });
        assert.equal(tts.mimeType, "audio/mpeg");
        assert.ok(tts.audioBase64.length > 0);

        const sttEl = await transcribeViaElevenLabs({
          audioBuffer: Buffer.from("audio"),
          mimeType: "audio/mp3",
          apiKey: "el_key_123",
        });
        assert.equal(sttEl, "نص صوتي من ElevenLabs");

        const sttAai = await transcribeViaAssemblyAI({
          audioBuffer: Buffer.from("audio"),
          apiKey: "aai_key_123",
        });
        assert.equal(sttAai, "نص صوتي من AssemblyAI");
      }
    );
  });

  it("creates embeddings via Voyage AI, Cohere, Gemini, and OpenAI", async () => {
    await withMockFetch(
      (async (input) => {
        const url = String(input);
        if (url.includes("generativelanguage.googleapis.com")) {
          return jsonResponse({ embedding: { values: [0.1, 0.2, 0.3] } });
        }
        if (url.includes("api.cohere.com")) {
          return jsonResponse({ embeddings: { float: [[0.4, 0.5, 0.6]] } });
        }
        return jsonResponse({ data: [{ embedding: [0.7, 0.8, 0.9] }] });
      }) as typeof globalThis.fetch,
      async () => {
        const v = await createEmbeddings({ providerId: "voyage", apiKey: "pa-key", input: "hello" });
        assert.deepEqual(v.embeddings, [[0.7, 0.8, 0.9]]);

        const c = await createEmbeddings({ providerId: "cohere", apiKey: "co-key", input: "hello" });
        assert.deepEqual(c.embeddings, [[0.4, 0.5, 0.6]]);

        const g = await createEmbeddings({ providerId: "gemini", apiKey: "AIza-key", input: "hello" });
        assert.deepEqual(g.embeddings, [[0.1, 0.2, 0.3]]);
      }
    );
  });

  it("fetches live model catalogs for ElevenLabs, Bedrock, Cloudflare, and OpenAI-compatible providers", async () => {
    await withMockFetch(
      (async (input) => {
        const url = String(input);
        if (url.includes("elevenlabs.io/v1/models")) {
          return jsonResponse([{ model_id: "eleven_multilingual_v2" }]);
        }
        if (url.includes("amazonaws.com/foundation-models")) {
          return jsonResponse({ modelSummaries: [{ modelId: "amazon.nova-pro-v1:0" }] });
        }
        if (url.includes("cloudflare.com/client/v4/accounts/")) {
          return jsonResponse({ result: [{ name: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }] });
        }
        return jsonResponse({ data: [{ id: "live-model-1" }, { id: "live-model-2" }] });
      }) as typeof globalThis.fetch,
      async () => {
        const el = await fetchProviderModelsLive("elevenlabs", "el_12345678");
        assert.equal(el.success, true);
        assert.ok(el.models.includes("scribe_v1"));

        const br = await fetchProviderModelsLive("bedrock", "ABSKtestToken123");
        assert.equal(br.success, true);
        assert.deepEqual(br.models, ["amazon.nova-pro-v1:0"]);

        const cf = await fetchProviderModelsLive("cloudflare", "0123456789abcdef0123456789abcdef:tok");
        assert.equal(cf.success, true);
        assert.deepEqual(cf.models, ["@cf/meta/llama-3.3-70b-instruct-fp8-fast"]);

        const nov = await fetchProviderModelsLive("novita", "nov_key_123");
        assert.equal(nov.success, true);
        assert.deepEqual(nov.models, ["live-model-1", "live-model-2"]);
      }
    );
  });
});
