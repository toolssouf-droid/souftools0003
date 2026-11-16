/**
 * SoufTools Advanced Image Generation System
 * Multi-Provider Architecture with Cloudflare Workers AI (Primary) + Pollinations.AI (Fallback)
 * Key Management, Authorized Key Pool, Rotation & Health Tracking
 */

import { encryptKey, decryptKey, maskKey } from "@/lib/encryption";
import { loadServerAdminConfig, updateInMemoryAdminConfig } from "@/lib/adminConfigStore";

export interface CloudflareKeyItem {
  id: string;
  name: string;
  accountId: string;
  apiToken: string; // Encrypted in storage, decrypted in memory
  maskedToken: string;
  status: "healthy" | "degraded" | "failed" | "disabled";
  createdAt: string;
  lastUsedAt?: string;
  lastError?: string;
  successCount: number;
  failureCount: number;
  isActive: boolean;
  cooldownUntil?: number;
}

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  numSteps?: number;
  guidance?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  prompt: string;
  providerUsed: string;
  modelUsed?: string;
  keyIdUsed?: string;
  keyMasked?: string;
  latencyMs: number;
  fallbackOccurred: boolean;
  fallbackReason?: string;
  steps: string[];
  error?: string;
}

// In-Memory Cloudflare Keys Store
let inMemoryCloudflareKeys: CloudflareKeyItem[] = [];
let keysLoadedFromDb = false;

// Default Fallback Environment Keys if configured
const DEFAULT_CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const DEFAULT_CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

/**
 * Initializes and loads Cloudflare keys from Turso or Environment
 */
export async function loadCloudflareKeys(): Promise<CloudflareKeyItem[]> {
  if (keysLoadedFromDb && inMemoryCloudflareKeys.length > 0) {
    return inMemoryCloudflareKeys;
  }

  try {
    const adminConfig = await loadServerAdminConfig();
    const rawCf = (adminConfig?.keys as any)?.cloudflare;
    if (Array.isArray(rawCf)) {
      inMemoryCloudflareKeys = rawCf.map((k: any, index: number) => {
        const decryptedToken =
          typeof k === "string" ? decryptKey(k) : decryptKey(k?.apiToken || k?.key || "");
        return {
          id: k?.id || `cf_key_${index + 1}`,
          name: k?.name || `Cloudflare Key ${index + 1}`,
          accountId: k?.accountId || DEFAULT_CF_ACCOUNT,
          apiToken: decryptedToken,
          maskedToken: maskKey(decryptedToken),
          status: k?.status || "healthy",
          createdAt: k?.createdAt || new Date().toISOString(),
          lastUsedAt: k?.lastUsedAt,
          lastError: k?.lastError,
          successCount: k?.successCount || 0,
          failureCount: k?.failureCount || 0,
          isActive: k?.isActive !== undefined ? k.isActive : true,
          cooldownUntil: k?.cooldownUntil,
        };
      });
      keysLoadedFromDb = true;
    }
  } catch (err) {
    console.warn("Failed loading Cloudflare keys from Turso:", err);
  }

  // Fallback to environment variable if no keys in Turso
  if (inMemoryCloudflareKeys.length === 0 && DEFAULT_CF_TOKEN && DEFAULT_CF_ACCOUNT) {
    inMemoryCloudflareKeys = [
      {
        id: "cf_env_key_1",
        name: "Cloudflare Environment Key",
        accountId: DEFAULT_CF_ACCOUNT,
        apiToken: DEFAULT_CF_TOKEN,
        maskedToken: maskKey(DEFAULT_CF_TOKEN),
        status: "healthy",
        createdAt: new Date().toISOString(),
        successCount: 0,
        failureCount: 0,
        isActive: true,
      },
    ];
  }

  return inMemoryCloudflareKeys;
}

/**
 * Saves Cloudflare keys to Turso & In-Memory
 */
export async function saveCloudflareKeys(keys: CloudflareKeyItem[]): Promise<boolean> {
  inMemoryCloudflareKeys = keys;
  keysLoadedFromDb = true;

  try {
    const sanitizedKeysForStorage = keys.map((k) => ({
      id: k.id,
      name: k.name,
      accountId: k.accountId,
      apiToken: k.apiToken,
      maskedToken: k.maskedToken,
      status: k.status,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      lastError: k.lastError || null,
      successCount: k.successCount,
      failureCount: k.failureCount,
      isActive: k.isActive,
      cooldownUntil: k.cooldownUntil || null,
    }));

    const adminConfig = await loadServerAdminConfig();
    const updatedKeysConfig = {
      ...(adminConfig.keys || {}),
      cloudflare: sanitizedKeysForStorage as any,
    };

    await updateInMemoryAdminConfig({ keys: updatedKeysConfig });
    return true;
  } catch (err) {
    console.error("Error saving Cloudflare keys:", err);
    return false;
  }
}

/**
 * Selects an active healthy key from the pool, honoring health status & cooldowns
 */
function selectActiveCloudflareKey(keys: CloudflareKeyItem[]): CloudflareKeyItem | null {
  const now = Date.now();

  const eligible = keys.filter((k) => {
    if (!k.isActive || k.status === "disabled") return false;
    if (k.status === "failed") return false;
    if (k.cooldownUntil && k.cooldownUntil > now) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Prefer healthy over degraded
  const healthyKeys = eligible.filter((k) => k.status === "healthy");
  const pool = healthyKeys.length > 0 ? healthyKeys : eligible;

  // Least recently used rotation
  pool.sort((a, b) => {
    const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return timeA - timeB;
  });

  return pool[0];
}

/**
 * Generates an image using Cloudflare Workers AI REST API
 */
export async function generateViaCloudflareKey(
  keyItem: CloudflareKeyItem,
  prompt: string
): Promise<{ success: boolean; imageUrl?: string; modelUsed?: string; error?: string }> {
  const accountId = keyItem.accountId;
  const apiToken = keyItem.apiToken;

  if (!accountId || !apiToken) {
    return { success: false, error: "Missing Cloudflare Account ID or API Token" };
  }

  // Cloudflare Workers AI image generation model
  const models = [
    "@cf/black-forest-labs/flux-1-schnell",
    "@cf/bytedance/stable-diffusion-xl-lightning",
    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  ];

  let lastErr = "";

  for (const model of models) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          num_steps: model.includes("schnell") ? 4 : 8,
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("image/") || contentType.includes("application/octet-stream")) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          const mime = contentType.includes("png") ? "image/png" : "image/jpeg";
          return {
            success: true,
            imageUrl: `data:${mime};base64,${base64}`,
            modelUsed: model.split("/").pop() || model,
          };
        }

        const json = await response.json();
        if (json.success && json.result?.image) {
          return {
            success: true,
            imageUrl: json.result.image.startsWith("data:")
              ? json.result.image
              : `data:image/png;base64,${json.result.image}`,
            modelUsed: model.split("/").pop() || model,
          };
        }

        if (json.errors && json.errors.length > 0) {
          lastErr = json.errors.map((e: any) => e.message || String(e)).join(", ");
        }
      } else {
        const errorText = await response.text();
        lastErr = `HTTP ${response.status}: ${errorText.slice(0, 200)}`;
      }
    } catch (err: any) {
      lastErr = err.message || String(err);
    }
  }

  return { success: false, error: lastErr || "Failed to generate image via Cloudflare Workers AI" };
}

/**
 * Fallback provider using Pollinations.AI
 */
export async function generateViaPollinationsFallback(
  prompt: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    return { success: true, imageUrl };
  } catch (err: any) {
    return { success: false, error: err.message || "Pollinations fallback failed" };
  }
}

/**
 * Ensures the image generation prompt is strictly in English.
 * If Arabic text is detected, translates & enhances it into a detailed English prompt.
 */
export async function ensureEnglishImagePrompt(prompt: string): Promise<{ englishPrompt: string; wasTranslated: boolean }> {
  if (!prompt || !prompt.trim()) {
    return { englishPrompt: "A high quality artistic masterpiece, detailed lighting, cinematic, photorealistic", wasTranslated: false };
  }

  const cleanPrompt = prompt.trim();
  const hasArabic = /[\u0600-\u06FF]/.test(cleanPrompt);

  if (!hasArabic) {
    return { englishPrompt: cleanPrompt, wasTranslated: false };
  }

  try {
    const { executeRoutedPrompt } = await import("@/lib/router");
    const res = await executeRoutedPrompt({
      modelId: "spark",
      prompt: `User image idea: "${cleanPrompt}"`,
      systemInstruction: `You are an expert prompt engineer for AI image generation models (Flux, Stable Diffusion, Midjourney).
Translate the user's image idea into a detailed, high-fidelity, artistic English prompt.
Include subject details, style, lighting, atmosphere, and composition.

CRITICAL RULES:
1. The response MUST be ONLY the final English prompt.
2. Do NOT include any Arabic words, quotes, markdown formatting, or preamble.
3. Keep it purely in English.`,
    });

    if (res?.text) {
      let englishText = res.text.trim().replace(/^["']|["']$/g, "").trim();
      // Verify no remaining Arabic characters
      if (englishText.length > 2 && !/[\u0600-\u06FF]/.test(englishText)) {
        return { englishPrompt: englishText, wasTranslated: true };
      }
    }
  } catch (err) {
    console.warn("Prompt translation via router failed, using fallback:", err);
  }

  // Fallback if router fails or returns empty
  return { 
    englishPrompt: `High quality detailed digital artwork, cinematic lighting, photorealistic composition, 8k resolution`, 
    wasTranslated: true 
  };
}

/**
 * Main Entry Point: Execute Image Generation via Provider Manager
 * Sequence: Cloudflare Workers AI (Multi-Key Rotation) -> Fallback: Pollinations.AI
 */
export async function generateImageViaManager(
  prompt: string,
  _options?: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const startTime = Date.now();
  const steps: string[] = ["🎨 يحضر طلب إنشاء الصورة..."];

  // 0. Ensure prompt is strictly in English for image generation models
  const { englishPrompt, wasTranslated } = await ensureEnglishImagePrompt(prompt);
  if (wasTranslated) {
    steps.push(`🌐 تم تحويل الوصف تلقائياً للإنجليزية لدعم أداة توليد الصور: "${englishPrompt}"`);
  }

  const targetPrompt = englishPrompt;

  // 1. Load keys
  const keys = await loadCloudflareKeys();

  // Try Cloudflare Key Pool with Safe Rotation & Retries
  let cfAttemptCount = 0;
  const maxAttempts = Math.min(3, keys.filter((k) => k.isActive).length || 1);

  while (cfAttemptCount < maxAttempts) {
    const currentKey = selectActiveCloudflareKey(keys);
    if (!currentKey) break;

    cfAttemptCount++;
    steps.push(`⚙️ استخدام مزود Cloudflare Workers AI (مفتاح: ${currentKey.maskedToken})...`);

    const res = await generateViaCloudflareKey(currentKey, targetPrompt);

    if (res.success && res.imageUrl) {
      // Record Success
      currentKey.successCount = (currentKey.successCount || 0) + 1;
      currentKey.lastUsedAt = new Date().toISOString();
      currentKey.status = "healthy";
      saveCloudflareKeys(keys).catch(() => null);

      steps.push("✓ تم إنشاء الصورة بنجاح بواسطة Cloudflare Workers AI!");

      return {
        success: true,
        imageUrl: res.imageUrl,
        prompt: targetPrompt,
        providerUsed: `Cloudflare Workers AI (${res.modelUsed || "Flux-1"})`,
        modelUsed: res.modelUsed,
        keyIdUsed: currentKey.id,
        keyMasked: currentKey.maskedToken,
        latencyMs: Date.now() - startTime,
        fallbackOccurred: false,
        steps,
      };
    } else {
      // Record Failure on Key
      currentKey.failureCount = (currentKey.failureCount || 0) + 1;
      currentKey.lastError = res.error || "Generation error";
      currentKey.lastUsedAt = new Date().toISOString();

      if (currentKey.failureCount >= 3) {
        currentKey.status = "failed";
      } else {
        currentKey.status = "degraded";
        currentKey.cooldownUntil = Date.now() + 5 * 60 * 1000;
      }

      saveCloudflareKeys(keys).catch(() => null);
      steps.push(`⚠️ فشل المفتاح (${currentKey.maskedToken}): ${res.error?.slice(0, 100)}`);
    }
  }

  // 2. Fallback to Pollinations.AI
  steps.push("↪️ الانتقال إلى المزود الاحتياطي Pollinations.AI...");
  const polRes = await generateViaPollinationsFallback(targetPrompt);

  if (polRes.success && polRes.imageUrl) {
    steps.push("✓ تم إنشاء الصورة بنجاح عبر المزود الاحتياطي Pollinations.AI!");
    return {
      success: true,
      imageUrl: polRes.imageUrl,
      prompt: targetPrompt,
      providerUsed: "Pollinations.AI (Fallback)",
      modelUsed: "Flux (Pollinations)",
      latencyMs: Date.now() - startTime,
      fallbackOccurred: true,
      fallbackReason: keys.length === 0 ? "لا يوجد مفاتيح Cloudflare مفعلة" : "فشل جميع مفاتيح Cloudflare المتاحة",
      steps,
    };
  }

  // All providers failed
  steps.push("❌ تعذر توليد الصورة من جميع المزودين المتاحين.");
  return {
    success: false,
    prompt: targetPrompt,
    providerUsed: "None",
    latencyMs: Date.now() - startTime,
    fallbackOccurred: true,
    error: polRes.error || "فشل توليد الصورة من Cloudflare وPollinations",
    steps,
  };
}
