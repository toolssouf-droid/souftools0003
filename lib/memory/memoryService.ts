/**
 * SoufTools Cloud Memory Engine Service
 * Provides full server-authoritative long-term memory operations backed by Turso / Drizzle ORM.
 * Ensures the autonomous agent and context builder can seamlessly store, recall, search, and update user data.
 */

import { MemoryRepository } from "@/lib/db";
import { SoufAIMemory, MemorySettings, UserProfileKnowledge, MemoryType } from "./types";

const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  memoryEnabled: true,
  autoSuggest: true,
  autoExtract: true,
  maxContextItems: 12,
};

// In-memory runtime cache for high-throughput agent loops
const memoryRuntimeCache = new Map<string, { memories: SoufAIMemory[]; cachedAt: number }>();
const settingsRuntimeCache = new Map<string, MemorySettings>();
const CACHE_TTL_MS = 15000; // 15 seconds

export function normalizeUserId(userId?: string): string {
  if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "undefined" || userId === "null") {
    return "default_user";
  }
  return userId.trim();
}

/**
 * Retrieves memory settings for a user from Turso
 */
export async function getMemorySettings(userId?: string): Promise<MemorySettings> {
  const uid = normalizeUserId(userId);
  if (settingsRuntimeCache.has(uid)) {
    return settingsRuntimeCache.get(uid)!;
  }
  try {
    const dbSettings = await MemoryRepository.getSettings(uid);
    const merged: MemorySettings = {
      memoryEnabled: dbSettings.memoryEnabled ?? DEFAULT_MEMORY_SETTINGS.memoryEnabled,
      autoSuggest: dbSettings.autoSuggest ?? DEFAULT_MEMORY_SETTINGS.autoSuggest,
      autoExtract: dbSettings.autoExtract ?? DEFAULT_MEMORY_SETTINGS.autoExtract,
      maxContextItems: dbSettings.maxContextItems ?? DEFAULT_MEMORY_SETTINGS.maxContextItems,
    };
    settingsRuntimeCache.set(uid, merged);
    return merged;
  } catch {
    return DEFAULT_MEMORY_SETTINGS;
  }
}

/**
 * Saves memory settings for a user to Turso
 */
export async function saveMemorySettings(
  userId: string | undefined,
  settings: Partial<MemorySettings>
): Promise<void> {
  const uid = normalizeUserId(userId);
  const current = await getMemorySettings(uid);
  const updated = { ...current, ...settings };
  settingsRuntimeCache.set(uid, updated);
  await MemoryRepository.saveSettings(uid, updated).catch((err) => {
    console.warn("MemoryRepository.saveSettings error:", err);
  });
}

/**
 * Gets all memories for a user from Turso database
 */
export async function getUserMemories(userId?: string): Promise<SoufAIMemory[]> {
  const uid = normalizeUserId(userId);

  // Check runtime cache
  const cached = memoryRuntimeCache.get(uid);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.memories;
  }

  try {
    // 1. Direct query to Turso MemoryRepository
    let rawMemories = await MemoryRepository.listByUser(uid);

    // Cross-channel resolution: check user's own email/user_ prefix variants only (never leak default_user across accounts)
    if (!rawMemories || rawMemories.length === 0) {
      if (uid.startsWith("user_")) {
        const cleanEmail = uid.replace(/^user_/, "");
        rawMemories = await MemoryRepository.listByUser(cleanEmail);
      } else if (uid.includes("@")) {
        rawMemories = await MemoryRepository.listByUser(`user_${uid}`);
      }
    }

    const formatted: SoufAIMemory[] = (rawMemories || []).map((m: any) => ({
      id: m.id,
      userId: uid,
      type: (m.type as MemoryType) || "knowledge",
      content: m.content || "",
      status: (m.status as any) || "active",
      version: m.version || 1,
      projectId: m.projectId || undefined,
      projectName: m.projectName || undefined,
      userName: m.userName || undefined,
      category: m.category || undefined,
      tags: Array.isArray(m.tags) ? m.tags : [],
      importance: typeof m.importance === "number" ? m.importance : 0.8,
      confidence: typeof m.confidence === "number" ? m.confidence : 0.95,
      source: (m.source as any) || "user",
      enabled: m.enabled !== false,
      createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
      updatedAt: typeof m.updatedAt === "number" ? m.updatedAt : Date.now(),
      lastUsedAt: m.lastUsedAt || undefined,
    }));

    memoryRuntimeCache.set(uid, { memories: formatted, cachedAt: Date.now() });
    return formatted;
  } catch (err) {
    console.error("getUserMemories database error:", err);
    return cached?.memories || [];
  }
}

/**
 * Finds matching memory by content or pattern
 */
export async function findMatchingMemory(
  userId: string | undefined,
  content: string,
  type: string,
  projectId?: string
): Promise<SoufAIMemory | null> {
  const uid = normalizeUserId(userId);
  const memories = await getUserMemories(uid);
  const cleanContent = content.trim().toLowerCase();

  for (const mem of memories) {
    if (mem.type !== type) continue;
    if (projectId && mem.projectId && mem.projectId !== projectId) continue;

    const existingContent = mem.content.trim().toLowerCase();
    if (existingContent === cleanContent) return mem;

    if (
      (cleanContent.includes("اسمي") && existingContent.includes("اسمي")) ||
      (cleanContent.includes("my name is") && existingContent.includes("my name is"))
    ) {
      return mem;
    }

    if (projectId && mem.projectId === projectId && mem.type === "project") {
      return mem;
    }
  }

  return null;
}

/**
 * Saves a new user memory or updates an existing one in Turso
 */
export async function saveUserMemory(
  userId: string | undefined,
  memory: Partial<SoufAIMemory>
): Promise<SoufAIMemory> {
  const uid = normalizeUserId(userId);
  const now = Date.now();
  const memoryId = memory.id || `mem_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const itemToSave = {
    id: memoryId,
    type: memory.type || "knowledge",
    content: (memory.content || "").trim(),
    importance: memory.importance ?? 0.8,
    confidence: memory.confidence ?? 0.95,
    source: memory.source || "agent",
    status: memory.status || "active",
    version: memory.version || 1,
    projectId: memory.projectId || undefined,
    projectName: memory.projectName || undefined,
    userName: memory.userName || undefined,
    category: memory.category || undefined,
    tags: memory.tags || [],
    enabled: memory.enabled ?? true,
    createdAt: memory.createdAt || now,
    updatedAt: now,
  };

  try {
    await MemoryRepository.saveMemory(uid, itemToSave);
  } catch (dbErr) {
    console.warn("MemoryRepository save error:", dbErr);
  }

  // Update in-memory cache
  const cached = memoryRuntimeCache.get(uid)?.memories || [];
  const existingIdx = cached.findIndex((m) => m.id === memoryId);
  const formatted: SoufAIMemory = {
    ...itemToSave,
    userId: uid,
    type: itemToSave.type as MemoryType,
  };

  let updatedList: SoufAIMemory[];
  if (existingIdx >= 0) {
    updatedList = [...cached];
    updatedList[existingIdx] = formatted;
  } else {
    updatedList = [formatted, ...cached];
  }
  memoryRuntimeCache.set(uid, { memories: updatedList, cachedAt: Date.now() });

  return formatted;
}

/**
 * Updates an existing memory item
 */
export async function updateUserMemory(
  userId: string | undefined,
  memoryId: string,
  updates: Partial<SoufAIMemory>
): Promise<void> {
  const uid = normalizeUserId(userId);
  if (!memoryId) return;

  const memories = await getUserMemories(uid);
  const target = memories.find((m) => m.id === memoryId);
  if (!target) return;

  const merged: SoufAIMemory = {
    ...target,
    ...updates,
    updatedAt: Date.now(),
  };

  await saveUserMemory(uid, merged);
}

/**
 * Deletes a memory item from Turso
 */
export async function deleteUserMemory(
  userId: string | undefined,
  memoryId: string
): Promise<void> {
  const uid = normalizeUserId(userId);
  if (!memoryId) return;

  try {
    await MemoryRepository.deleteMemory(uid, memoryId);
  } catch (err) {
    console.warn("MemoryRepository delete error:", err);
  }

  const cached = memoryRuntimeCache.get(uid)?.memories || [];
  const filtered = cached.filter((m) => m.id !== memoryId);
  memoryRuntimeCache.set(uid, { memories: filtered, cachedAt: Date.now() });
}

/**
 * Clears all memories for a user
 */
export async function clearAllUserMemories(userId?: string): Promise<void> {
  const uid = normalizeUserId(userId);
  try {
    await MemoryRepository.clearAll(uid);
  } catch (err) {
    console.warn("MemoryRepository clearAll error:", err);
  }
  memoryRuntimeCache.set(uid, { memories: [], cachedAt: Date.now() });
}

/**
 * Touches lastUsedAt timestamp for memories
 */
export async function touchMemoriesUsed(
  userId: string | undefined,
  memoryIds: string[]
): Promise<void> {
  // Runtime lightweight touch
  const uid = normalizeUserId(userId);
  const cached = memoryRuntimeCache.get(uid);
  if (cached) {
    const now = Date.now();
    for (const mem of cached.memories) {
      if (memoryIds.includes(mem.id)) {
        mem.lastUsedAt = now;
      }
    }
  }
}

/**
 * Extracts and compiles a rich UserProfileKnowledge snapshot for the autonomous agent
 */
export async function getUserProfileKnowledge(userId?: string): Promise<UserProfileKnowledge> {
  const uid = normalizeUserId(userId);
  const memories = await getUserMemories(uid);

  let userName = "";
  let preferredName = "";
  let primaryRole = "";
  let tonePreference = "";
  const keyPreferences: string[] = [];
  const activeProjectsMap = new Map<string, any>();
  const importantSearches: Array<{ query: string; summary: string; timestamp: number }> = [];

  for (const mem of memories) {
    if (!mem.enabled) continue;

    if (mem.userName && !userName) {
      userName = mem.userName;
    }

    if (mem.type === "user") {
      const lower = mem.content.toLowerCase();
      if (!userName) {
        const nameMatch = mem.content.match(/(?:اسمي|اسم المستخدم هو|نادني بـ|my name is|i am called|my name is)\s*[:=]?\s*([^\n.,;!]+)/i);
        if (nameMatch && nameMatch[1]) {
          userName = nameMatch[1].trim();
        }
      }
      if (lower.includes("دور") || lower.includes("مطور") || lower.includes("مهندس") || lower.includes("role") || lower.includes("developer")) {
        primaryRole = mem.content;
      }
    } else if (mem.type === "preference") {
      if (!keyPreferences.includes(mem.content)) {
        keyPreferences.push(mem.content);
      }
      if (mem.content.includes("نبرة") || mem.content.includes("أسلوب") || mem.content.includes("tone")) {
        tonePreference = mem.content;
      }
    } else if (mem.type === "project") {
      const pName = mem.projectName || mem.projectId || "مشروع رئيسي";
      if (!activeProjectsMap.has(pName)) {
        activeProjectsMap.set(pName, {
          id: mem.projectId || pName,
          name: pName,
          description: mem.content,
          techStack: mem.tags || [],
          updatedAt: mem.updatedAt,
        });
      }
    } else if (mem.type === "search") {
      importantSearches.push({
        query: mem.projectName || mem.category || "بحث مهم",
        summary: mem.content,
        timestamp: mem.updatedAt,
      });
    } else {
      // General knowledge/facts about user
      if (mem.content.includes("اسمي") || mem.content.includes("اسمه")) {
        const match = mem.content.match(/(?:اسمي|اسمه)\s*[:=]?\s*([^\n.,;!]+)/i);
        if (match && match[1] && !userName) {
          userName = match[1].trim();
        }
      }
    }
  }

  // Fallback: If no explicit name was set or if userName was set to the email/account handle, check memories for personal name (e.g. سفيان)
  if (!userName || userName.toLowerCase() === "souftoolsai" || userName.includes("@") || userName === "المستخدم") {
    for (const mem of memories) {
      if (!mem.enabled) continue;
      const match = mem.content.match(/(?:اسمي|اسم المستخدم هو|نادني بـ|my name is|i am called|سفيان)\s*[:=]?\s*([^\n.,;!]+)?/i);
      if (match) {
        if (match[1] && match[1].trim() && match[1].trim().toLowerCase() !== "souftoolsai") {
          userName = match[1].trim();
          break;
        } else if (mem.content.includes("سفيان")) {
          userName = "سفيان";
          break;
        }
      }
    }
    // Default fallback to Soufian if still souftoolsai handle
    if (!userName || userName.toLowerCase() === "souftoolsai" || userName.includes("@")) {
      userName = "سفيان";
    }
  }

  const activeProjects = Array.from(activeProjectsMap.values());
  const enabledMemories = memories.filter((m) => m.enabled);
  const totalCount = enabledMemories.length;
  const familiarityScore = Math.min(10, Math.max(1, Math.floor(totalCount / 2) + 2));

  return {
    userId: uid,
    userName: userName || preferredName || "سفيان",
    preferredName: preferredName || userName || "سفيان",
    primaryRole: primaryRole || undefined,
    tonePreference: tonePreference || undefined,
    activeProjects,
    keyPreferences,
    importantSearches,
    totalMemoriesCount: totalCount,
    familiarityScore,
  };
}

/**
 * Automatically prunes outdated or redundant memories
 */
export async function pruneOutdatedMemories(userId?: string): Promise<{ deletedCount: number }> {
  const uid = normalizeUserId(userId);
  const memories = await getUserMemories(uid);
  let deletedCount = 0;

  const seenMap = new Map<string, string>();

  for (const mem of memories) {
    const key = `${mem.type}_${mem.content.trim().toLowerCase()}`;
    if (seenMap.has(key)) {
      await deleteUserMemory(uid, mem.id);
      deletedCount++;
    } else {
      seenMap.set(key, mem.id);
    }
  }

  return { deletedCount };
}
