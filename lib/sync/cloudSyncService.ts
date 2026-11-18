import { useChatStore, ChatSession, resolveSessionModelId } from "@/store/chatStore";
import { SoufAIMemory } from "@/lib/memory/types";
import { auth } from "@/lib/firebase";
import { getOrCreateAuthSession, getAuthCookie } from "@/lib/authCookies";

export type CloudSyncStatus = "synced" | "syncing" | "offline" | "error" | "idle";

export interface SyncStateInfo {
  status: CloudSyncStatus;
  lastSyncedAt: number | null;
  itemsSynced: number;
  userEmail: string | null;
  errorMessage?: string;
}

class CloudSyncService {
  private syncTimer: any = null;
  private currentStatus: CloudSyncStatus = "idle";
  private lastSyncedAt: number | null = null;
  private itemsSynced: number = 0;
  private listeners: Set<(state: SyncStateInfo) => void> = new Set();
  private isSyncing: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.triggerAutoSync(1000));
    }
  }

  public subscribe(callback: (state: SyncStateInfo) => void) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.warn("Sync listener notification error:", err);
      }
    });
  }

  public getState(): SyncStateInfo {
    const cookieData = typeof window !== "undefined" ? getOrCreateAuthSession() : null;
    const email = auth.currentUser?.email || useChatStore.getState().userEmail || cookieData?.email || null;
    return {
      status: this.currentStatus,
      lastSyncedAt: this.lastSyncedAt,
      itemsSynced: this.itemsSynced,
      userEmail: email,
    };
  }

  /**
   * Schedules a debounced sync to the cloud server
   */
  public triggerAutoSync(delayMs: number = 2000) {
    if (typeof window === "undefined") return;
    if (this.syncTimer) clearTimeout(this.syncTimer);

    this.syncTimer = setTimeout(() => {
      this.executeCloudSync();
    }, delayMs);
  }

  /**
   * Forces an immediate synchronization with the cloud server
   */
  public async executeCloudSync(guestIdToMigrate?: string): Promise<boolean> {
    if (typeof window === "undefined" || this.isSyncing) return false;

    if (!navigator.onLine) {
      this.currentStatus = "offline";
      this.notify();
      return false;
    }

    const state = useChatStore.getState();
    const cookieData = getOrCreateAuthSession();
    const userId = auth.currentUser?.uid || state.userId || cookieData?.userId || cookieData?.email || "default_user";
    const userEmail = auth.currentUser?.email || state.userEmail || cookieData?.email || `${userId}@souftools.app`;

    this.isSyncing = true;
    this.currentStatus = "syncing";
    this.notify();

    try {
      const payload = {
        userId,
        email: userEmail,
        sessions: state.sessions || [],
        settings: {
          currentModel: state.currentModel,
          webSearchEnabled: state.webSearchEnabled,
          suggestionsConfig: state.suggestionsConfig,
          soufImageSettings: state.soufImageSettings,
        },
        guestIdToMigrate,
      };

      const res = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Sync failed with status: ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      if (data?.success) {
        this.lastSyncedAt = data.syncedAt || Date.now();
        this.itemsSynced = (data.syncedSessionsCount || 0) + (data.syncedMemoriesCount || 0);
        this.currentStatus = "synced";
      } else {
        this.currentStatus = "error";
      }
    } catch (error) {
      console.warn("Cloud sync error:", error);
      this.currentStatus = "error";
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return this.currentStatus === "synced";
  }

  /**
   * Restores user data from the cloud server when logging in or opening on a new device
   */
  public async restoreFromCloud(userId?: string, userEmail?: string): Promise<boolean> {
    if (typeof window === "undefined") return false;

    const modelAtStart = useChatStore.getState().currentModel;
    const cookieData = getOrCreateAuthSession();
    const targetUserId = userId || auth.currentUser?.uid || useChatStore.getState().userId || cookieData?.userId || cookieData?.email || "default_user";
    const targetEmail = userEmail || auth.currentUser?.email || useChatStore.getState().userEmail || cookieData?.email || `${targetUserId}@souftools.app`;

    this.currentStatus = "syncing";
    this.notify();

    try {
      const params = new URLSearchParams();
      if (targetUserId) params.set("userId", targetUserId);
      if (targetEmail) params.set("email", targetEmail);

      const res = await fetch(`/api/user/sync?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch cloud backup");

      const data = await res.json().catch(() => null);
      if (data?.success) {
        const store = useChatStore.getState();

        // 1. Server sessions are authoritative Source of Truth
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          const sessionMap = new Map<string, ChatSession>();
          // Cloud sessions first
          data.sessions.forEach((s: ChatSession) => sessionMap.set(s.id, s));
          // Existing local sessions if newer
          (store.sessions || []).forEach((s) => {
            const cloudSess = sessionMap.get(s.id);
            if (!cloudSess || (s.updatedAt || 0) >= (cloudSess.updatedAt || 0)) {
              sessionMap.set(s.id, s);
            }
          });

          const mergedSessions = Array.from(sessionMap.values()).sort(
            (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
          );

          const activeId = store.activeSessionId && mergedSessions.some((s) => s.id === store.activeSessionId)
            ? store.activeSessionId
            : mergedSessions[0].id;
          const activeSession = mergedSessions.find((s) => s.id === activeId) || mergedSessions[0];

          useChatStore.setState({
            sessions: mergedSessions,
            activeSessionId: activeId,
            messages: activeSession.messages || [],
          });
        }

        // The active conversation's model takes precedence over the new-chat default.
        if (data.settings) {
          if (data.settings.webSearchEnabled !== undefined) {
            store.setWebSearchEnabled(data.settings.webSearchEnabled);
          }
          const defaultModel = resolveSessionModelId(data.settings.currentModel);
          if (defaultModel) store.setDefaultModel(defaultModel);
        }
        const latestStore = useChatStore.getState();
        const activeModel = latestStore.sessions.find((session) => session.id === latestStore.activeSessionId)?.modelId;
        const resolvedActiveModel = resolveSessionModelId(activeModel);
        const resolvedDefaultModel = resolveSessionModelId(data.settings?.currentModel);
        if (
          latestStore.currentModel === modelAtStart
        ) {
          const restoredModel = resolvedActiveModel || resolvedDefaultModel;
          if (restoredModel) latestStore.setCurrentModel(restoredModel);
        }

        this.lastSyncedAt = Date.now();
        this.itemsSynced = (data.sessions?.length || 0) + (data.memories?.length || 0);
        this.currentStatus = "synced";
        this.notify();
        return true;
      }
    } catch (err) {
      console.warn("Cloud restore warn:", err);
      this.currentStatus = "error";
      this.notify();
    }

    return false;
  }
}

export const cloudSyncService = new CloudSyncService();
