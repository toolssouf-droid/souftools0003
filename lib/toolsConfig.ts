import fs from "fs";
import path from "path";
import { SettingsRepository } from "@/lib/db";
import { encryptKey, decryptKey } from "@/lib/encryption";

export interface ToolKeyItem {
  id: string;
  key: string;
  status: "active" | "failed" | "unverified";
  lastTestedAt?: string;
  lastUsedAt?: string;
  failureReason?: string;
}

export interface ToolItem {
  id: string;
  name: string;
  category: "search" | "reader" | "math" | "system" | "custom";
  enabled: boolean;
  priority: number;
  isFree?: boolean;
  rotationMode?: "priority" | "round_robin";
  description?: string;
  keys: ToolKeyItem[];
}

export interface ToolLogEntry {
  id: string;
  timestamp: number;
  tool: string;
  toolName: string;
  query?: string;
  status: "success" | "fallback" | "failed";
  latencyMs?: number;
  note?: string;
}

export interface ToolsStats {
  todayTotal: number;
  tavily: number;
  exa: number;
  serper: number;
  ddg: number;
  firecrawl: number;
  jina: number;
  calculator?: number;
  system_stats?: number;
  time_tools?: number;
  successCount?: number;
  failCount?: number;
  lastUsedAt?: string;
  recentLogs?: ToolLogEntry[];
  [key: string]: any;
}

export const DEFAULT_TOOLS: ToolItem[] = [
  {
    id: "tavily",
    name: "Tavily Web Search",
    category: "search",
    enabled: true,
    priority: 1,
    rotationMode: "priority",
    description: "محرك بحث متطور مخصص لنماذج الذكاء الاصطناعي لتزويد الإجابات بمعلومات حية ودقيقة (الخيار الأول المفضل)",
    keys: [
      { id: "tvly_k1", key: process.env.TAVILY_API_KEY || "", status: process.env.TAVILY_API_KEY ? "active" : "unverified" },
    ],
  },
  {
    id: "exa",
    name: "Exa Neural Search",
    category: "search",
    enabled: true,
    priority: 2,
    rotationMode: "priority",
    description: "بحث دلالي فائق السرعة عبر محتوى الإنترنت الدقيق بالاعتماد على الشبكات العصبية (الاحتياطي الثاني)",
    keys: [
      { id: "exa_k1", key: process.env.EXA_API_KEY || "", status: process.env.EXA_API_KEY ? "active" : "unverified" },
    ],
  },
  {
    id: "serper",
    name: "Serper Google Search API",
    category: "search",
    enabled: true,
    priority: 3,
    rotationMode: "priority",
    description: "واجهة برمجية لجلب نتائج بحث جوجل المباشرة والدقيقة (الاحتياطي الثالث)",
    keys: [
      { id: "serper_k1", key: process.env.SERPER_API_KEY || "", status: process.env.SERPER_API_KEY ? "active" : "unverified" },
    ],
  },
  {
    id: "ddg",
    name: "DuckDuckGo Free Search",
    category: "search",
    enabled: true,
    priority: 4,
    isFree: true,
    description: "بحث مجاني ومفتوح بدون حاجة لمفاتيح برمجية - الاحتياطي الأخير المقاوم للفشل",
    keys: [],
  },
  {
    id: "firecrawl",
    name: "Firecrawl Web Scraper",
    category: "reader",
    enabled: true,
    priority: 1,
    rotationMode: "priority",
    description: "زاحف ويب متكامل لاستخراج قراءة ومحتوى المواقع والصفحات بأعلى جودة",
    keys: [
      { id: "fc_k1", key: process.env.FIRECRAWL_API_KEY || "", status: process.env.FIRECRAWL_API_KEY ? "active" : "unverified" },
    ],
  },
  {
    id: "jina",
    name: "Jina Reader (URL to Markdown)",
    category: "reader",
    enabled: true,
    priority: 2,
    rotationMode: "priority",
    description: "تحويل أي رابط موقع إلى نص Markdown نظيف للتحليل وقراءة الروابط (احتياطي للقارئ)",
    keys: [
      { id: "jina_k1", key: process.env.JINA_API_KEY || "", status: process.env.JINA_API_KEY ? "active" : "unverified" },
    ],
  },
  {
    id: "calculator",
    name: "الحاسبة الرياضية الدقيقة",
    category: "math",
    enabled: true,
    priority: 1,
    isFree: true,
    description: "أداة تنفيذ العمليات الرياضية والمعادلات المعقدة بسرعة وبدقة 100%",
    keys: [],
  },
  {
    id: "system_stats",
    name: "فحص حالة النظام والمزودين",
    category: "system",
    enabled: true,
    priority: 1,
    isFree: true,
    description: "قراءة مؤشرات أداء النماذج وقواعد البيانات والخدمات المربوطة",
    keys: [],
  },
  {
    id: "get_current_time",
    name: "الوقت والتاريخ والمناطق الزمنية",
    category: "system",
    enabled: true,
    priority: 1,
    isFree: true,
    description: "الحصول على الوقت الحقيقي والتاريخ بدعم جميع المناطق الزمنية والتوقيت الصيفي DST",
    keys: [],
  },
  {
    id: "convert_time",
    name: "تحويل التوقيت بين الدول والمدن",
    category: "system",
    enabled: true,
    priority: 1,
    isFree: true,
    description: "تحويل التوقيت المباشر والدقيق بين أي منطقتين زمنيتين عالمياً",
    keys: [],
  },
  {
    id: "media_player",
    name: "مشغل الوسائط المدمج (Inline Media Player)",
    category: "system",
    enabled: true,
    priority: 1,
    isFree: true,
    description: "تشغيل ملفات الفيديو والتسجيلات الصوتية والترجمة بدقة عالية داخل المحادثة مباشرة",
    keys: [],
  },
];

// Legacy read-only fallback paths used ONLY for one-time migration into Turso
const DATA_DIR = path.join(process.cwd(), "data");
const LEGACY_STATS_FILE = path.join(DATA_DIR, "tools_stats.json");
const LEGACY_TOOLS_FILE = path.join(DATA_DIR, "tools_config.json");

const INITIAL_STATS: ToolsStats = {
  todayTotal: 0,
  tavily: 0,
  exa: 0,
  serper: 0,
  ddg: 0,
  firecrawl: 0,
  jina: 0,
  calculator: 0,
  system_stats: 0,
  time_tools: 0,
  successCount: 0,
  failCount: 0,
  lastUsedAt: undefined,
  recentLogs: [],
};

let cachedToolsConfig: ToolItem[] | null = null;
let cachedToolsStats: ToolsStats = { ...INITIAL_STATS };
let toolsLoadedFromDb = false;

function decryptToolsKeys(tools: ToolItem[]): ToolItem[] {
  return tools.map((t) => ({
    ...t,
    keys: Array.isArray(t.keys)
      ? t.keys.map((k) => ({
          ...k,
          key: typeof k.key === "string" && k.key ? decryptKey(k.key) : "",
        }))
      : [],
  }));
}

function encryptToolsKeys(tools: ToolItem[]): ToolItem[] {
  return tools.map((t) => ({
    ...t,
    keys: Array.isArray(t.keys)
      ? t.keys.map((k) => ({
          ...k,
          key: typeof k.key === "string" && k.key ? encryptKey(k.key) : "",
        }))
      : [],
  }));
}

function readLegacyToolsFile(): ToolItem[] | null {
  try {
    if (fs.existsSync(LEGACY_TOOLS_FILE)) {
      const raw = fs.readFileSync(LEGACY_TOOLS_FILE, "utf-8");
      if (raw && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return normalizeToolsList(parsed);
      }
    }
  } catch {}
  return null;
}

function readLegacyStatsFile(): ToolsStats | null {
  try {
    if (fs.existsSync(LEGACY_STATS_FILE)) {
      const raw = fs.readFileSync(LEGACY_STATS_FILE, "utf-8");
      if (raw && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return { ...INITIAL_STATS, ...parsed };
      }
    }
  } catch {}
  return null;
}

export async function ensureToolsLoaded(): Promise<void> {
  if (toolsLoadedFromDb) return;
  try {
    const dbTools = await SettingsRepository.getSetting<any>("tools_config");
    if (Array.isArray(dbTools) && dbTools.length > 0) {
      cachedToolsConfig = decryptToolsKeys(normalizeToolsList(dbTools));
    } else {
      const legacyTools = readLegacyToolsFile();
      if (legacyTools && legacyTools.length > 0) {
        cachedToolsConfig = decryptToolsKeys(legacyTools);
        await SettingsRepository.setSetting("tools_config", encryptToolsKeys(cachedToolsConfig), true);
      } else {
        cachedToolsConfig = DEFAULT_TOOLS;
      }
    }

    const dbStats = await SettingsRepository.getSetting<ToolsStats>("tools_stats");
    if (dbStats && typeof dbStats === "object") {
      cachedToolsStats = { ...INITIAL_STATS, ...dbStats };
    } else {
      const legacyStats = readLegacyStatsFile();
      if (legacyStats) {
        cachedToolsStats = legacyStats;
        await SettingsRepository.setSetting("tools_stats", cachedToolsStats, false);
      }
    }
    toolsLoadedFromDb = true;
  } catch (err) {
    console.warn("[ToolsConfig] Failed loading from Turso:", err);
  }
}

export async function saveToolsConfigToDb(tools: ToolItem[]): Promise<boolean> {
  const normalized = normalizeToolsList(tools);
  cachedToolsConfig = normalized;
  toolsLoadedFromDb = true;
  try {
    await SettingsRepository.setSetting("tools_config", encryptToolsKeys(normalized), true);
    return true;
  } catch (err) {
    console.warn("[ToolsConfig] Failed saving tools_config to Turso:", err);
    return false;
  }
}

export async function saveToolsStatsToDb(stats: ToolsStats): Promise<boolean> {
  cachedToolsStats = { ...INITIAL_STATS, ...stats };
  try {
    await SettingsRepository.setSetting("tools_stats", cachedToolsStats, false);
    return true;
  } catch (err) {
    console.warn("[ToolsConfig] Failed saving tools_stats to Turso:", err);
    return false;
  }
}

export function normalizeToolsList(rawList: any[]): ToolItem[] {
  if (!Array.isArray(rawList)) return DEFAULT_TOOLS;

  return rawList.map((t: any, index: number) => {
    const isFree =
      t.isFree ||
      t.apiKey === "FREE_NO_KEY" ||
      t.apiKey === "BUILT_IN" ||
      t.id === "ddg" ||
      t.id === "calculator" ||
      t.id === "system_stats" ||
      t.id === "get_current_time" ||
      t.id === "convert_time";

    let keys: ToolKeyItem[] = Array.isArray(t.keys)
      ? t.keys.map((k: any) => ({
          ...k,
          key: typeof k?.key === "string" && k.key ? decryptKey(k.key) : "",
        }))
      : [];
    if (!isFree && keys.length === 0 && t.apiKey && t.apiKey !== "FREE_NO_KEY" && t.apiKey !== "BUILT_IN") {
      keys = [{ id: `${t.id}_k1`, key: decryptKey(String(t.apiKey)), status: "active" }];
    }

    return {
      id: t.id || `tool_${index}`,
      name: t.name || `Tool ${index}`,
      category: t.category || "custom",
      enabled: t.enabled !== undefined ? Boolean(t.enabled) : true,
      priority: typeof t.priority === "number" ? t.priority : index + 1,
      isFree,
      rotationMode: t.rotationMode || "priority",
      description: t.description || "",
      keys,
    };
  });
}

export function getLoadedToolsCache(): ToolItem[] {
  if (!cachedToolsConfig) {
    cachedToolsConfig = readLegacyToolsFile() || DEFAULT_TOOLS;
  }
  return cachedToolsConfig;
}

export function setLoadedToolsCache(tools: ToolItem[]) {
  const normalized = normalizeToolsList(tools);
  cachedToolsConfig = normalized;
  toolsLoadedFromDb = true;
  SettingsRepository.setSetting("tools_config", encryptToolsKeys(normalized), true).catch(() => null);
}

export function getCachedToolsStats(): ToolsStats {
  return cachedToolsStats;
}

export function getToolsStats(): ToolsStats {
  return getCachedToolsStats();
}

export function getAllToolsStats(): ToolItem[] {
  return getLoadedToolsCache();
}

export function setCachedToolsStats(stats: ToolsStats) {
  cachedToolsStats = {
    ...INITIAL_STATS,
    ...stats,
  };
  SettingsRepository.setSetting("tools_stats", cachedToolsStats, false).catch(() => null);
}

export function resetToolsStats(): ToolsStats {
  cachedToolsStats = {
    todayTotal: 0,
    tavily: 0,
    exa: 0,
    serper: 0,
    ddg: 0,
    firecrawl: 0,
    jina: 0,
    calculator: 0,
    system_stats: 0,
    time_tools: 0,
    successCount: 0,
    failCount: 0,
    lastUsedAt: new Date().toISOString(),
    recentLogs: [],
  };
  SettingsRepository.setSetting("tools_stats", cachedToolsStats, false).catch(() => null);
  return cachedToolsStats;
}

export function updateLoadedToolsStats(
  providerKey: string,
  status: "success" | "fallback" | "failed" = "success",
  queryOrUrl: string = "",
  latencyMs: number = 0
) {
  cachedToolsStats.todayTotal = (cachedToolsStats.todayTotal || 0) + 1;
  if (status === "failed") {
    cachedToolsStats.failCount = (cachedToolsStats.failCount || 0) + 1;
  } else {
    cachedToolsStats.successCount = (cachedToolsStats.successCount || 0) + 1;
  }

  const pLower = (providerKey || "").toLowerCase();
  let toolKeyName = "DuckDuckGo";

  if (pLower.includes("tavily")) {
    cachedToolsStats.tavily = (cachedToolsStats.tavily || 0) + 1;
    toolKeyName = "Tavily Web Search";
  } else if (pLower.includes("exa")) {
    cachedToolsStats.exa = (cachedToolsStats.exa || 0) + 1;
    toolKeyName = "Exa Neural Search";
  } else if (pLower.includes("serper")) {
    cachedToolsStats.serper = (cachedToolsStats.serper || 0) + 1;
    toolKeyName = "Serper Google Search";
  } else if (pLower.includes("duckduckgo") || pLower.includes("ddg")) {
    cachedToolsStats.ddg = (cachedToolsStats.ddg || 0) + 1;
    toolKeyName = "DuckDuckGo Search";
  } else if (pLower.includes("firecrawl")) {
    cachedToolsStats.firecrawl = (cachedToolsStats.firecrawl || 0) + 1;
    toolKeyName = "Firecrawl Scraper";
  } else if (pLower.includes("jina")) {
    cachedToolsStats.jina = (cachedToolsStats.jina || 0) + 1;
    toolKeyName = "Jina Reader";
  } else if (pLower.includes("calc")) {
    cachedToolsStats.calculator = (cachedToolsStats.calculator || 0) + 1;
    toolKeyName = "الحاسبة الرياضية";
  } else if (pLower.includes("time")) {
    cachedToolsStats.time_tools = (cachedToolsStats.time_tools || 0) + 1;
    toolKeyName = "أدوات الوقت والمناطق الزمنية";
  } else if (pLower.includes("system")) {
    cachedToolsStats.system_stats = (cachedToolsStats.system_stats || 0) + 1;
    toolKeyName = "فحص مؤشرات النظام";
  } else {
    cachedToolsStats[pLower] = (cachedToolsStats[pLower] || 0) + 1;
    toolKeyName = providerKey;
  }

  cachedToolsStats.lastUsedAt = new Date().toISOString();

  const newLog: ToolLogEntry = {
    id: `tool_run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    tool: pLower,
    toolName: toolKeyName,
    query: queryOrUrl.slice(0, 120),
    status,
    latencyMs: latencyMs > 0 ? latencyMs : 0,
  };

  const currentLogs = Array.isArray(cachedToolsStats.recentLogs) ? cachedToolsStats.recentLogs : [];
  cachedToolsStats.recentLogs = [newLog, ...currentLogs].slice(0, 20);

  SettingsRepository.setSetting("tools_stats", cachedToolsStats, false).catch(() => null);
}
