/**
 * SoufAI Runtime Manager - Turso Persistent Database Services
 * Directly backed by Turso repositories (`SettingsRepository` & `RuntimeSessionRepository`)
 * with zero client-side relative fetch dependencies.
 */

import { RuntimeSessionRepository, SettingsRepository } from "@/lib/db";
import { encryptKey, decryptKey } from "@/lib/encryption";
import {
  SandboxSession,
  RuntimeProviderConfig,
  RuntimeKeyItem,
  RuntimeSettings,
  RuntimeLogItem,
} from "./types";

const DEFAULT_PROVIDERS: RuntimeProviderConfig[] = [
  {
    provider: "native_sandbox",
    name: "SoufTools Native Linux Sandbox",
    description: "بيئة تشغيل معزولة أصيلة داخل الخادم بتقنيات Linux Namespaces وCgroups وعزل كامل للموارد والملفات",
    enabled: true,
    priority: 1,
    isCloudSandbox: false,
  },
  {
    provider: "e2b",
    name: "E2B Cloud Code Sandbox",
    description: "سحابة تشغيل معزولة وسريعة لتنفيذ الأكواد في السحابة مع دعم كامل لشبكة الإنترنت",
    enabled: true,
    priority: 2,
    isCloudSandbox: true,
  },
  {
    provider: "webcontainer",
    name: "WebContainer (Browser Isolated)",
    description: "محرك تشغيل فوري يعمل محلياً داخل المتصفح كبديل احتياطي ذكي",
    enabled: true,
    priority: 3,
    isCloudSandbox: false,
  },
  {
    provider: "docker",
    name: "Docker Custom Container",
    description: "حاويات مخصصة للمشاريع الكبيرة",
    enabled: false,
    priority: 4,
    isCloudSandbox: false,
  },
];

const DEFAULT_SETTINGS: RuntimeSettings = {
  autoCleanupMinutes: 15,
  idleTimeoutMs: 10 * 60 * 1000,
  defaultProvider: "native_sandbox",
  saveStateBeforeStop: true,
  enableHealthCheck: true,
  limits: {
    ramMb: 500,
    cpuCores: 1,
    diskMb: 2048,
    timeoutMinutes: 10,
    maxProcesses: 50,
    networkMode: "restricted",
    maxFileSizeMb: 30,
  },
};

// 1. PROVIDERS
export async function getRuntimeProviders(): Promise<RuntimeProviderConfig[]> {
  try {
    const stored = await SettingsRepository.getSetting<RuntimeProviderConfig[]>("runtime_providers");
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
  } catch (err) {
    console.warn("[Turso runtimeDatabaseServices.getRuntimeProviders] note:", err);
  }
  return DEFAULT_PROVIDERS;
}

export async function saveRuntimeProviders(providers: RuntimeProviderConfig[]): Promise<void> {
  await SettingsRepository.setSetting("runtime_providers", providers, false);
}

// 2. RUNTIME KEYS (Encrypted at rest in Turso)
export async function getRuntimeKeys(): Promise<RuntimeKeyItem[]> {
  try {
    const rawKeys = (await SettingsRepository.getSetting<RuntimeKeyItem[]>("runtime_keys")) || [];
    if (!Array.isArray(rawKeys)) return [];
    return rawKeys.map((item) => {
      let keyVal = item.key || "";
      if (keyVal.startsWith("enc:")) {
        keyVal = decryptKey(keyVal.slice(4));
      } else if (keyVal) {
        keyVal = decryptKey(keyVal);
      }
      return {
        ...item,
        key: keyVal,
      };
    });
  } catch (err) {
    console.warn("[Turso runtimeDatabaseServices.getRuntimeKeys] note:", err);
    return [];
  }
}

export async function saveRuntimeKeys(keys: RuntimeKeyItem[]): Promise<void> {
  const encryptedKeys = (keys || []).map((item) => {
    let keyVal = item.key || "";
    if (keyVal && !keyVal.startsWith("enc:")) {
      const normalizedPlain = decryptKey(keyVal);
      keyVal = encryptKey(normalizedPlain);
    }
    return {
      ...item,
      key: keyVal,
    };
  });
  await SettingsRepository.setSetting("runtime_keys", encryptedKeys, true);
}

// 3. RUNTIME SETTINGS
export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  try {
    const stored = await SettingsRepository.getSetting<RuntimeSettings>("runtime_settings");
    if (stored) {
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        limits: {
          ...DEFAULT_SETTINGS.limits!,
          ...(stored.limits || {}),
        },
      };
    }
  } catch (err) {
    console.warn("[Turso runtimeDatabaseServices.getRuntimeSettings] note:", err);
  }
  return DEFAULT_SETTINGS;
}

export async function saveRuntimeSettings(settings: RuntimeSettings): Promise<void> {
  const current = await getRuntimeSettings();
  const merged: RuntimeSettings = {
    ...current,
    ...settings,
    limits: {
      ...(current.limits || DEFAULT_SETTINGS.limits!),
      ...(settings.limits || {}),
    },
  };
  await SettingsRepository.setSetting("runtime_settings", merged, false);
}

// 4. SANDBOX SESSIONS
function mapRowToSandboxSession(row: any, meta: Record<string, any> = {}): SandboxSession {
  return {
    sessionId: meta.sessionId || row.id,
    userId: row.userId,
    projectId: meta.projectId || row.sandboxId || row.id,
    projectName: meta.projectName || "SoufAI Project",
    framework: meta.framework || "react",
    provider: (row.provider || meta.provider || "native_sandbox") as any,
    status: (row.status || meta.status || "active") as any,
    previewUrl: meta.previewUrl,
    port: Number(meta.port || 3000),
    createdAt: meta.createdAt || (row.startedAt instanceof Date ? row.startedAt.getTime() : Date.now()),
    lastActivity: meta.lastActivity || (row.startedAt instanceof Date ? row.startedAt.getTime() : Date.now()),
    resources: meta.resources || {
      cpu: `${row.cpuCores || 1} Core`,
      memory: `${row.memoryMb || 512} MB`,
      disk: "2 GB",
    },
    savedFilesSnapshot: meta.savedFilesSnapshot,
    error: meta.error,
    limits: meta.limits,
    metrics: meta.metrics,
    pid: meta.pid,
  };
}

export async function getAllActiveSandboxSessions(userId?: string): Promise<SandboxSession[]> {
  try {
    const rows = userId
      ? await RuntimeSessionRepository.listByUser(userId, 100)
      : await RuntimeSessionRepository.listAll(100);

    return await Promise.all(
      rows.map(async (r) => {
        const extra = (await SettingsRepository.getSetting<Record<string, any>>(`runtime_session_meta_${r.id}`)) || {};
        return mapRowToSandboxSession(r, extra);
      })
    );
  } catch (err) {
    console.warn("[Turso runtimeDatabaseServices.getAllActiveSandboxSessions] error:", err);
    return [];
  }
}

export async function getActiveSessions(userId?: string): Promise<SandboxSession[]> {
  return getAllActiveSandboxSessions(userId);
}

export async function getSandboxSession(sessionId: string): Promise<SandboxSession | null> {
  try {
    const row = await RuntimeSessionRepository.getById(sessionId);
    if (!row) return null;
    const extra = (await SettingsRepository.getSetting<Record<string, any>>(`runtime_session_meta_${row.id}`)) || {};
    return mapRowToSandboxSession(row, extra);
  } catch {
    return null;
  }
}

export async function saveSandboxSession(session: SandboxSession): Promise<void> {
  const sessionId = session.sessionId;
  if (!sessionId) return;

  await RuntimeSessionRepository.upsertSession({
    id: sessionId,
    userId: session.userId || "system",
    provider: session.provider || "native_sandbox",
    sandboxId: session.projectId || sessionId,
    status: session.status || "active",
    memoryMb: Number(session.limits?.ramMb || 512),
    cpuCores: Number(session.limits?.cpuCores || 1),
    startedAt: session.createdAt ? new Date(session.createdAt) : new Date(),
    stoppedAt: session.status === "stopped" ? new Date() : null,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });

  await SettingsRepository.setSetting(
    `runtime_session_meta_${sessionId}`,
    {
      ...session,
      sessionId,
      lastActivity: session.lastActivity || Date.now(),
    },
    false
  );
}

export async function saveSession(session: SandboxSession): Promise<void> {
  return saveSandboxSession(session);
}

export async function updateSessionStatus(
  sessionId: string,
  status: SandboxSession["status"],
  error?: string
): Promise<void> {
  await RuntimeSessionRepository.updateStatus(sessionId, status, status === "stopped" ? new Date() : null);
  const existing = (await SettingsRepository.getSetting<Record<string, any>>(`runtime_session_meta_${sessionId}`)) || {};
  await SettingsRepository.setSetting(
    `runtime_session_meta_${sessionId}`,
    {
      ...existing,
      status,
      ...(error !== undefined ? { error } : {}),
      lastActivity: Date.now(),
    },
    false
  );
}

export async function deleteSandboxSession(sessionId: string): Promise<void> {
  await RuntimeSessionRepository.deleteSession(sessionId);
  await SettingsRepository.setSetting(`runtime_session_meta_${sessionId}`, null, false).catch(() => null);
}

export async function deleteSandboxSessionFromFirestore(sessionId: string): Promise<void> {
  return deleteSandboxSession(sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  return deleteSandboxSession(sessionId);
}

// 5. RUNTIME LOGS
export async function addRuntimeLog(
  logOrSessionId: RuntimeLogItem | string,
  streamOrEmpty?: "stdout" | "stderr" | "system",
  messageOrEmpty?: string
): Promise<void> {
  try {
    const logItem: RuntimeLogItem =
      typeof logOrSessionId === "object"
        ? {
            id: logOrSessionId.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ...logOrSessionId,
          }
        : {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            event: "health_check",
            provider: "native_sandbox",
            success: streamOrEmpty !== "stderr",
            timestamp: Date.now(),
            sessionId: logOrSessionId,
            details: messageOrEmpty || "",
          };

    if (logItem.sessionId) {
      const existingSession = await RuntimeSessionRepository.getById(logItem.sessionId);
      if (existingSession) {
        await RuntimeSessionRepository.addLog(
          logItem.sessionId,
          logItem.success ? "stdout" : "stderr",
          logItem.details || logItem.error || `[${logItem.event}] ${logItem.provider}`
        );
      }
    }

    let allLogs = (await SettingsRepository.getSetting<RuntimeLogItem[]>("runtime_logs")) || [];
    if (!Array.isArray(allLogs)) allLogs = [];
    allLogs.unshift(logItem);
    await SettingsRepository.setSetting("runtime_logs", allLogs.slice(0, 250), false);
  } catch (err) {
    console.warn("[Turso runtimeDatabaseServices.addRuntimeLog] note:", err);
  }
}

export async function getSessionLogs(sessionId: string): Promise<RuntimeLogItem[]> {
  try {
    const dbLogs = await RuntimeSessionRepository.getLogs(sessionId, 100);
    if (dbLogs.length > 0) {
      return dbLogs.map((l) => ({
        id: l.id,
        sessionId: l.sessionId,
        event: "command_exec",
        provider: "native_sandbox",
        success: l.stream !== "stderr",
        timestamp: l.timestamp instanceof Date ? l.timestamp.getTime() : Number(l.timestamp || Date.now()),
        details: l.message,
      }));
    }
    const allLogs = (await SettingsRepository.getSetting<RuntimeLogItem[]>("runtime_logs")) || [];
    return Array.isArray(allLogs) ? allLogs.filter((l) => l.sessionId === sessionId) : [];
  } catch {
    return [];
  }
}

export async function getRecentRuntimeLogs(limit = 60): Promise<RuntimeLogItem[]> {
  try {
    const allLogs = (await SettingsRepository.getSetting<RuntimeLogItem[]>("runtime_logs")) || [];
    return Array.isArray(allLogs) ? allLogs.slice(0, Math.min(limit, 250)) : [];
  } catch {
    return [];
  }
}
