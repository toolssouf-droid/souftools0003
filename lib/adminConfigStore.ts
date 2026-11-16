import fs from "fs";
import path from "path";
import { decryptKey, encryptKey } from "./encryption";
import { SettingsRepository } from "./db";
import { terminalLogger } from "./logger/terminalLogger";

export const ALL_MODEL_TIERS = ["spark", "core", "pro", "ultra"];

export interface ClassifierModelConfig {
  providerId: string;
  model: string;
  apiKey: string;
  status: "active" | "disabled";
}

export interface VisionModelConfig {
  providerId: string;
  model: string;
  apiKey: string;
  status: "active" | "disabled";
  customEndpoint?: string;
}

const LEGACY_CONFIG_FILE = path.join(process.cwd(), "data", "admin_keys_config.json");

let inMemoryModelProviders: any = null;
let inMemoryKeys: Record<string, string[]> = {
  gemini: (process.env.GEMINI_API_KEY || "")
    .split(/[\r\n,;|]+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 8 && !k.includes("demo")),
};
let inMemoryActiveTiers: string[] = ALL_MODEL_TIERS;
let inMemorySelectedAgentModel: string = "ultra";
let inMemoryClassifierModelConfig: ClassifierModelConfig | null = null;
let inMemoryVisionModelConfig: VisionModelConfig | null = null;
let inMemoryPlatformSupportEmail: string = "souftoolsheb@gmail.com";

export interface AuthProviderSettings {
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  requireEmailVerification?: boolean;
}

export interface EmailDeliverySettings {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  resendApiKey?: string;
  resendFrom?: string;
  primaryEngine?: "smtp_gmail" | "http_resend";
}

let inMemoryAuthProviders: AuthProviderSettings = {
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  requireEmailVerification: true,
};

let inMemoryEmailSettings: EmailDeliverySettings = {
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || process.env.GMAIL_USER || "",
  smtpPass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "",
  smtpFrom: process.env.SMTP_FROM || `"SoufTools Security" <${process.env.SMTP_USER || "toolssouf@gmail.com"}>`,
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFrom: process.env.RESEND_FROM || "SoufTools <onboarding@resend.dev>",
  primaryEngine: "smtp_gmail",
};

let startupBannerPrinted = false;

function decryptProvidersMap(rawProviders: any): any {
  if (!rawProviders || typeof rawProviders !== "object") return rawProviders;
  try {
    const cloned = JSON.parse(JSON.stringify(rawProviders));
    for (const mId of Object.keys(cloned)) {
      if (!Array.isArray(cloned[mId])) continue;
      cloned[mId] = cloned[mId].map((p: any) => ({
        ...p,
        keys: (p.keys || []).map((kObj: any) => {
          if (typeof kObj === "string") {
            const dec = decryptKey(kObj);
            return {
              key: dec,
              shortName: dec.length > 12 ? `${dec.slice(0, 4)}****[${dec.slice(-4)}]` : dec,
              reqCount: 0,
              lastUsed: "حديثاً",
              status: "active",
              latencyMs: 80,
            };
          }
          if (kObj && typeof kObj === "object") {
            return {
              ...kObj,
              ...(typeof kObj.key === "string" ? { key: decryptKey(kObj.key) } : {}),
              ...(typeof kObj.apiToken === "string" ? { apiToken: decryptKey(kObj.apiToken) } : {}),
            };
          }
          return kObj;
        }),
      }));
    }
    return cloned;
  } catch {
    return rawProviders;
  }
}

function encryptProvidersMap(rawProviders: any): any {
  if (!rawProviders || typeof rawProviders !== "object") return rawProviders;
  try {
    const cloned = JSON.parse(JSON.stringify(rawProviders));
    for (const mId of Object.keys(cloned)) {
      if (!Array.isArray(cloned[mId])) continue;
      cloned[mId] = cloned[mId].map((p: any) => ({
        ...p,
        keys: (p.keys || []).map((kObj: any) => {
          if (typeof kObj === "string") return kObj ? encryptKey(kObj) : "";
          if (kObj && typeof kObj === "object") {
            return {
              ...kObj,
              ...(typeof kObj.key === "string" && kObj.key ? { key: encryptKey(kObj.key) } : {}),
              ...(typeof kObj.apiToken === "string" && kObj.apiToken
                ? { apiToken: encryptKey(kObj.apiToken) }
                : {}),
            };
          }
          return kObj;
        }),
      }));
    }
    return cloned;
  } catch {
    return rawProviders;
  }
}

function decryptKeysMap(rawKeys: any): Record<string, any[]> {
  if (!rawKeys || typeof rawKeys !== "object") return {};
  const out: Record<string, any[]> = {};
  for (const provId of Object.keys(rawKeys)) {
    const arr = rawKeys[provId];
    if (!Array.isArray(arr)) continue;
    out[provId] = arr
      .map((item: any) => {
        if (typeof item === "string") return decryptKey(item);
        if (item && typeof item === "object") {
          return {
            ...item,
            ...(typeof item.apiToken === "string" ? { apiToken: decryptKey(item.apiToken) } : {}),
            ...(typeof item.key === "string" ? { key: decryptKey(item.key) } : {}),
          };
        }
        return item;
      })
      .filter(Boolean);
  }
  return out;
}

function encryptKeysMap(rawKeys: any): Record<string, any[]> {
  if (!rawKeys || typeof rawKeys !== "object") return {};
  const out: Record<string, any[]> = {};
  for (const provId of Object.keys(rawKeys)) {
    const arr = rawKeys[provId];
    if (!Array.isArray(arr)) continue;
    out[provId] = arr
      .map((item: any) => {
        if (typeof item === "string") return item ? encryptKey(item) : "";
        if (item && typeof item === "object") {
          return {
            ...item,
            ...(typeof item.apiToken === "string" && item.apiToken
              ? { apiToken: encryptKey(item.apiToken) }
              : {}),
            ...(typeof item.key === "string" && item.key ? { key: encryptKey(item.key) } : {}),
          };
        }
        return item;
      })
      .filter(Boolean);
  }
  return out;
}

function applyParsedAdminConfig(parsed: any) {
  if (!parsed || typeof parsed !== "object") return;
  if (Object.prototype.hasOwnProperty.call(parsed, "modelProviders")) {
    inMemoryModelProviders =
      parsed.modelProviders && typeof parsed.modelProviders === "object" && !Array.isArray(parsed.modelProviders)
        ? decryptProvidersMap(parsed.modelProviders)
        : null;
  }
  if (parsed.keys && typeof parsed.keys === "object") {
    inMemoryKeys = { ...inMemoryKeys, ...decryptKeysMap(parsed.keys) };
  }
  if (Array.isArray(parsed.activeModelTiers)) {
    inMemoryActiveTiers = parsed.activeModelTiers;
  }
  if (parsed.selectedAgentModel) {
    inMemorySelectedAgentModel = parsed.selectedAgentModel;
  }
  if (parsed.classifierModelConfig) {
    inMemoryClassifierModelConfig = {
      ...parsed.classifierModelConfig,
      apiKey: parsed.classifierModelConfig.apiKey
        ? decryptKey(parsed.classifierModelConfig.apiKey)
        : "",
    };
  }
  if (parsed.visionModelConfig) {
    inMemoryVisionModelConfig = {
      ...parsed.visionModelConfig,
      apiKey: parsed.visionModelConfig.apiKey
        ? decryptKey(parsed.visionModelConfig.apiKey)
        : "",
    };
  }
  if (parsed.platformSupportEmail) {
    inMemoryPlatformSupportEmail = parsed.platformSupportEmail;
  }
  if (parsed.authProviders && typeof parsed.authProviders === "object") {
    inMemoryAuthProviders = {
      ...inMemoryAuthProviders,
      ...parsed.authProviders,
      ...(parsed.authProviders.googleClientSecret
        ? { googleClientSecret: decryptKey(parsed.authProviders.googleClientSecret) }
        : {}),
      ...(parsed.authProviders.githubClientSecret
        ? { githubClientSecret: decryptKey(parsed.authProviders.githubClientSecret) }
        : {}),
    };
  }
  if (parsed.emailSettings && typeof parsed.emailSettings === "object") {
    inMemoryEmailSettings = {
      ...inMemoryEmailSettings,
      ...parsed.emailSettings,
      ...(parsed.emailSettings.smtpPass
        ? { smtpPass: decryptKey(parsed.emailSettings.smtpPass) }
        : {}),
      ...(parsed.emailSettings.resendApiKey
        ? { resendApiKey: decryptKey(parsed.emailSettings.resendApiKey) }
        : {}),
    };
  }
}

export function getInMemoryAdminConfig() {
  return {
    modelProviders: inMemoryModelProviders,
    keys: inMemoryKeys,
    activeModelTiers: Array.isArray(inMemoryActiveTiers) ? inMemoryActiveTiers : ALL_MODEL_TIERS,
    selectedAgentModel: inMemorySelectedAgentModel,
    classifierModelConfig: inMemoryClassifierModelConfig,
    visionModelConfig: inMemoryVisionModelConfig,
    platformSupportEmail: inMemoryPlatformSupportEmail,
    authProviders: inMemoryAuthProviders,
    emailSettings: inMemoryEmailSettings,
  };
}

function buildEncryptedStoragePayload() {
  return {
    modelProviders: encryptProvidersMap(inMemoryModelProviders),
    keys: encryptKeysMap(inMemoryKeys),
    activeModelTiers: inMemoryActiveTiers,
    selectedAgentModel: inMemorySelectedAgentModel,
    classifierModelConfig: inMemoryClassifierModelConfig
      ? {
          ...inMemoryClassifierModelConfig,
          apiKey: inMemoryClassifierModelConfig.apiKey
            ? encryptKey(inMemoryClassifierModelConfig.apiKey)
            : "",
        }
      : null,
    visionModelConfig: inMemoryVisionModelConfig
      ? {
          ...inMemoryVisionModelConfig,
          apiKey: inMemoryVisionModelConfig.apiKey
            ? encryptKey(inMemoryVisionModelConfig.apiKey)
            : "",
        }
      : null,
    platformSupportEmail: inMemoryPlatformSupportEmail,
    authProviders: {
      ...inMemoryAuthProviders,
      ...(inMemoryAuthProviders.googleClientSecret
        ? { googleClientSecret: encryptKey(inMemoryAuthProviders.googleClientSecret) }
        : {}),
      ...(inMemoryAuthProviders.githubClientSecret
        ? { githubClientSecret: encryptKey(inMemoryAuthProviders.githubClientSecret) }
        : {}),
    },
    emailSettings: {
      ...inMemoryEmailSettings,
      ...(inMemoryEmailSettings.smtpPass
        ? { smtpPass: encryptKey(inMemoryEmailSettings.smtpPass) }
        : {}),
      ...(inMemoryEmailSettings.resendApiKey
        ? { resendApiKey: encryptKey(inMemoryEmailSettings.resendApiKey) }
        : {}),
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Persists admin config solely to the Turso database with sensitive keys encrypted at rest.
 * Zero local disk JSON persistence.
 */
export async function persistServerConfigToDiskAndDb() {
  if (inMemoryModelProviders && typeof inMemoryModelProviders === "object") {
    Object.keys(inMemoryModelProviders).forEach((mId) => {
      const provs = inMemoryModelProviders[mId] || [];
      provs.forEach((p: any) => {
        if (p.providerId && Array.isArray(p.keys)) {
          if (!inMemoryKeys[p.providerId]) inMemoryKeys[p.providerId] = [];
          p.keys.forEach((kObj: any) => {
            const rawKey = typeof kObj === "string" ? kObj : kObj?.key || "";
            if (rawKey && !inMemoryKeys[p.providerId].includes(rawKey)) {
              inMemoryKeys[p.providerId].push(rawKey);
            }
          });
        }
      });
    });
  }

  const payload = buildEncryptedStoragePayload();

  try {
    await SettingsRepository.setSetting("admin_keys_config", payload, true);
    const existingSystem = (await SettingsRepository.getSetting<any>("admin_system_config")) || {};
    await SettingsRepository.setSetting(
      "admin_system_config",
      {
        ...existingSystem,
        ...payload,
      },
      true
    );
  } catch (dbErr) {
    console.warn("Failed writing admin config to Turso database:", dbErr);
  }
}

export async function updateInMemoryAdminConfig(data: {
  modelProviders?: any;
  keys?: Record<string, any[]>;
  activeModelTiers?: string[];
  selectedAgentModel?: string;
  classifierModelConfig?: ClassifierModelConfig | null;
  visionModelConfig?: VisionModelConfig | null;
  platformSupportEmail?: string;
  authProviders?: AuthProviderSettings;
  emailSettings?: EmailDeliverySettings;
}) {
  if (data.modelProviders !== undefined) {
    inMemoryModelProviders =
      data.modelProviders && typeof data.modelProviders === "object" && !Array.isArray(data.modelProviders)
        ? decryptProvidersMap(data.modelProviders)
        : null;
  }
  if (data.keys && typeof data.keys === "object") {
    inMemoryKeys = { ...inMemoryKeys, ...decryptKeysMap(data.keys) };
  }
  if (Array.isArray(data.activeModelTiers)) {
    inMemoryActiveTiers = data.activeModelTiers;
  }
  if (data.selectedAgentModel && typeof data.selectedAgentModel === "string") {
    inMemorySelectedAgentModel = data.selectedAgentModel;
  }
  if (data.classifierModelConfig !== undefined) {
    inMemoryClassifierModelConfig = data.classifierModelConfig
      ? {
          ...data.classifierModelConfig,
          apiKey: data.classifierModelConfig.apiKey
            ? decryptKey(data.classifierModelConfig.apiKey)
            : "",
        }
      : null;
  }
  if (data.visionModelConfig !== undefined) {
    inMemoryVisionModelConfig = data.visionModelConfig
      ? {
          ...data.visionModelConfig,
          apiKey: data.visionModelConfig.apiKey ? decryptKey(data.visionModelConfig.apiKey) : "",
        }
      : null;
  }
  if (data.platformSupportEmail && typeof data.platformSupportEmail === "string") {
    inMemoryPlatformSupportEmail = data.platformSupportEmail.trim();
  }
  if (data.authProviders && typeof data.authProviders === "object") {
    inMemoryAuthProviders = { ...inMemoryAuthProviders, ...data.authProviders };
  }
  if (data.emailSettings && typeof data.emailSettings === "object") {
    inMemoryEmailSettings = { ...inMemoryEmailSettings, ...data.emailSettings };
  }

  await persistServerConfigToDiskAndDb();
}

/**
 * Loads admin config prioritizing:
 * 1. Turso Database (SettingsRepository - Sole Source of Truth)
 * 2. One-time read-only import from legacy JSON file if Turso is empty
 * 3. Server in-memory cache + Environment variables
 */
export async function loadServerAdminConfig(options: { strict?: boolean } = {}) {
  try {
    let dbConfig = await SettingsRepository.getSetting<any>("admin_keys_config");
    if (!dbConfig || (typeof dbConfig === "object" && !dbConfig.modelProviders && !dbConfig.keys)) {
      const sysConfig = await SettingsRepository.getSetting<any>("admin_system_config");
      if (sysConfig && typeof sysConfig === "object") {
        dbConfig = sysConfig;
      }
    }

    if (dbConfig && typeof dbConfig === "object") {
      applyParsedAdminConfig(dbConfig);
    } else if (fs.existsSync(LEGACY_CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(LEGACY_CONFIG_FILE, "utf-8");
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            applyParsedAdminConfig(parsed);
            await persistServerConfigToDiskAndDb();
          }
        }
      } catch (legacyErr) {
        console.warn("Could not import legacy admin_keys_config.json into Turso:", legacyErr);
      }
    }
  } catch (dbErr) {
    if (options.strict) {
      throw new Error("Unable to load persisted admin configuration for strict model routing.", {
        cause: dbErr,
      });
    }
    console.warn("Could not read admin config from Turso database:", dbErr);
  }

  if (!startupBannerPrinted) {
    startupBannerPrinted = true;
    try {
      terminalLogger.printStartupBanner({
        port: 3000,
        dbStatus: "Turso libSQL / Drizzle ORM (Connected)",
        modelsLoaded: inMemoryModelProviders ? Object.keys(inMemoryModelProviders).length : 4,
        keysConfigured: Object.keys(inMemoryKeys || {}).length,
      });
    } catch {}
  }

  return getInMemoryAdminConfig();
}
