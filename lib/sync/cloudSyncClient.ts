/**
 * SoufTools Client-Side Cloud Synchronization Engine
 * 
 * Implements:
 * 1. Bootstrap: Hydrates user state from PostgreSQL on initial load.
 * 2. Real-time SSE Sync: Listens to /api/v1/sync/events with auto-reconnect.
 * 3. Fallback Cursor Polling: Seamless delta catch-up if SSE connection drops.
 * 4. Zero Persistent Browser Storage: Browser keeps only ephemeral UI state;
 *    PostgreSQL remains the sole durable Source of Truth.
 */

import { useChatStore, ChatSession, ChatMessage, resolveSessionModelId } from "@/store/chatStore";
import { getOrCreateAuthSession } from "@/lib/authCookies";
import { cloudSyncService } from "@/lib/sync/cloudSyncService";

export interface SyncStatus {
  connected: boolean;
  lastSyncedAt: Date | null;
  serverRevision: number;
  syncCursor: string | null;
  activeDeviceId: string;
}

let sseConnection: EventSource | null = null;
let reconnectTimeout: any = null;
let pollingInterval: any = null;
let currentCursor: string | null = null;
let isBootstrapping = false;

/**
 * Retrieves or generates a stable, persistent device identifier for this browser instance.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server_device";
  let devId = localStorage.getItem("souf_device_id");
  if (!devId) {
    devId = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem("souf_device_id", devId);
    } catch {}
  }
  return devId;
}

/**
 * Bootstraps the application state directly from the server-side PostgreSQL database.
 */
export async function bootstrapCloudSync(): Promise<boolean> {
  if (typeof window === "undefined" || isBootstrapping) return false;
  const modelAtStart = useChatStore.getState().currentModel;
  isBootstrapping = true;

  try {
    const deviceId = getDeviceId();
    const authSession = getOrCreateAuthSession();

    const res = await fetch(`/api/v1/sync/bootstrap?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: {
        "x-device-id": deviceId,
        "x-user-id": authSession?.userId || "",
        "x-user-email": authSession?.email || "",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      isBootstrapping = false;
      return false;
    }

    const resJson = await res.json().catch(() => null);
    if (!resJson || !resJson.success || !resJson.data) {
      isBootstrapping = false;
      return false;
    }
    const { success, data } = resJson;

    currentCursor = data.sync?.cursor || null;

    // 1. Update user identity & preferences in state
    const candidateEmail = data.user?.email || authSession?.email;
    const isRealEmail = Boolean(
      candidateEmail &&
      candidateEmail.includes("@") &&
      !candidateEmail.endsWith("@souftools.app") &&
      !candidateEmail.endsWith("@souftools.internal") &&
      !candidateEmail.startsWith("usr_guest_") &&
      !candidateEmail.startsWith("guest_user@")
    );

    if (isRealEmail && candidateEmail) {
      useChatStore.getState().setUserEmail(candidateEmail);
      if (data.user?.id) {
        useChatStore.getState().setUserId(data.user.id);
      } else if (authSession?.userId) {
        useChatStore.getState().setUserId(authSession.userId);
      }
    } else {
      useChatStore.getState().setUserEmail(null);
    }

    if (data.preferences) {
      if (typeof data.preferences.webSearchEnabled === "boolean") {
        useChatStore.getState().setWebSearchEnabled(data.preferences.webSearchEnabled);
      }
    }

    // 2. Hydrate conversations list directly from PostgreSQL with local fallback merging
    if (Array.isArray(data.conversations)) {
      const mappedSessions: ChatSession[] = data.conversations.map((c: any) => ({
        id: c.id,
        title: c.title,
        createdAt: new Date(c.createdAt).getTime(),
        updatedAt: new Date(c.updatedAt).getTime(),
        modelId: c.modelId || "spark",
        messages: [],
      }));

      // Attach initial messages to the active session
      if (data.activeConversationId && Array.isArray(data.initialMessages)) {
        const activeIdx = mappedSessions.findIndex((s) => s.id === data.activeConversationId);
        if (activeIdx !== -1) {
          mappedSessions[activeIdx].messages = data.initialMessages.map((m: any) => ({
            id: m.id,
            role: m.sender === "user" ? "user" : "model",
            content: m.content,
            timestamp: new Date(m.createdAt).getTime(),
            reasoning: m.reasoning,
            sources: m.sources,
            toolCalls: m.toolCalls,
          }));
        }
      }

      const currentState = useChatStore.getState();
      const existingSessions = currentState.sessions || [];
      const sessionMap = new Map<string, ChatSession>();
      mappedSessions.forEach((s) => sessionMap.set(s.id, s));
      existingSessions.forEach((s) => {
        const serverS = sessionMap.get(s.id);
        if (!serverS) {
          sessionMap.set(s.id, s);
        } else if (
          s.updatedAt >= serverS.updatedAt ||
          s.messages.length > (serverS.messages?.length || 0)
        ) {
          sessionMap.set(s.id, s);
        }
      });
      const finalSessions = Array.from(sessionMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      const activeId =
        currentState.activeSessionId && finalSessions.some((s) => s.id === currentState.activeSessionId)
          ? currentState.activeSessionId
          : data.activeConversationId || finalSessions[0]?.id || null;
      const activeSess = finalSessions.find((s) => s.id === activeId) || finalSessions[0];

      useChatStore.setState({
        sessions: finalSessions,
        activeSessionId: activeId,
        messages: activeSess?.messages || [],
      });

      const activeModel = resolveSessionModelId(activeSess?.modelId);
      const defaultModel = resolveSessionModelId(data.preferences?.defaultModelId);
      if (defaultModel) useChatStore.getState().setDefaultModel(defaultModel);
      if (useChatStore.getState().currentModel === modelAtStart) {
        const restoredModel = activeModel || defaultModel;
        if (restoredModel) useChatStore.getState().setCurrentModel(restoredModel);
      }
    } else {
      const defaultModel = resolveSessionModelId(data.preferences?.defaultModelId);
      if (defaultModel) useChatStore.getState().setDefaultModel(defaultModel);
      if (useChatStore.getState().currentModel === modelAtStart && defaultModel) {
        useChatStore.getState().setCurrentModel(defaultModel);
      }
    }

    // 3. Connect real-time Server-Sent Events (SSE)
    connectRealtimeSync();

    isBootstrapping = false;
    return true;
  } catch (err) {
    console.warn("[CloudSync] Bootstrap failed:", err);
    isBootstrapping = false;
    return false;
  }
}

/**
 * Connects to the SSE endpoint /api/v1/sync/events for real-time push updates.
 */
export function connectRealtimeSync() {
  if (typeof window === "undefined" || sseConnection) return;

  const deviceId = getDeviceId();
  const url = `/api/v1/sync/events?deviceId=${encodeURIComponent(deviceId)}`;

  try {
    sseConnection = new EventSource(url);

    sseConnection.addEventListener("sync", (event: MessageEvent) => {
      try {
        const delta = JSON.parse(event.data);
        handleIncomingSyncDelta(delta);
        if (delta.createdAt) {
          currentCursor = delta.createdAt;
        }
      } catch (err) {
        console.warn("[CloudSync] Failed to process incoming delta:", err);
      }
    });

    sseConnection.onerror = () => {
      disconnectRealtimeSync();
      // Schedule reconnect with exponential fallback
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connectRealtimeSync();
          // Also perform incremental poll to catch up any missed events
          pollIncrementalDelta();
        }, 3000);
      }
    };
  } catch (err) {
    console.warn("[CloudSync] SSE connection error:", err);
  }

  // Set up periodic safety polling every 30s as secondary guarantee
  if (!pollingInterval) {
    pollingInterval = setInterval(pollIncrementalDelta, 30000);
  }
}

/**
 * Disconnects SSE stream cleanly.
 */
export function disconnectRealtimeSync() {
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

/**
 * Polls /api/v1/sync?cursor=... for any changes that occurred while offline or disconnected.
 */
export async function pollIncrementalDelta() {
  if (!currentCursor || typeof window === "undefined") return;

  try {
    const deviceId = getDeviceId();
    const res = await fetch(
      `/api/v1/sync?cursor=${encodeURIComponent(currentCursor)}&limit=50&deviceId=${encodeURIComponent(deviceId)}`,
      { cache: "no-store" }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        for (const delta of data.events) {
          handleIncomingSyncDelta(delta);
        }
        if (data.nextCursor) {
          currentCursor = data.nextCursor;
        }
      }
    }
  } catch (err) {
    // Non-fatal, will retry next cycle
  }
}

/**
 * Processes incoming delta events from SSE or cursor polling into Zustand state.
 */
function handleIncomingSyncDelta(delta: {
  entityType: string;
  entityId: string;
  operation: "created" | "updated" | "deleted";
  version: number;
  payload: Record<string, any>;
  deviceId: string | null;
}) {
  const store = useChatStore.getState();
  const currentDev = getDeviceId();

  // 1. Message Sync
  if (delta.entityType === "message") {
    if (delta.operation === "created" && delta.payload) {
      const convId = delta.payload.conversationId;
      const newMsg: ChatMessage = {
        id: delta.payload.id || delta.entityId,
        role: delta.payload.sender === "user" ? "user" : "model",
        content: delta.payload.content || "",
        timestamp: new Date(delta.payload.createdAt || Date.now()).getTime(),
        reasoning: delta.payload.reasoning,
        sources: delta.payload.sources,
        toolCalls: delta.payload.toolCalls,
      };

      // If active conversation matches, add message to live view
      if (store.activeSessionId === convId) {
        const exists = store.messages.some((m) => m.id === newMsg.id);
        if (!exists) {
          useChatStore.setState({
            messages: [...store.messages, newMsg],
          });
        }
      }

      // Update session in sessions array
      const updatedSessions = store.sessions.map((s) => {
        if (s.id === convId) {
          const exists = s.messages.some((m) => m.id === newMsg.id);
          return {
            ...s,
            updatedAt: Date.now(),
            messages: exists ? s.messages : [...s.messages, newMsg],
          };
        }
        return s;
      });
      useChatStore.setState({ sessions: updatedSessions });
    }
  }

  // 2. Conversation Sync
  if (delta.entityType === "conversation") {
    if (delta.operation === "created" && delta.payload) {
      const newSession: ChatSession = {
        id: delta.entityId,
        title: delta.payload.title || "محادثة جديدة",
        createdAt: new Date(delta.payload.createdAt || Date.now()).getTime(),
        updatedAt: new Date(delta.payload.updatedAt || Date.now()).getTime(),
        modelId: delta.payload.modelId || "spark",
        messages: [],
      };
      if (!store.sessions.some((s) => s.id === newSession.id)) {
        useChatStore.setState({
          sessions: [newSession, ...store.sessions],
        });
      }
    } else if (delta.operation === "updated" && delta.payload) {
      const updated = store.sessions.map((s) => {
        if (s.id === delta.entityId) {
          return {
            ...s,
            title: delta.payload.title !== undefined ? delta.payload.title : s.title,
            modelId: delta.payload.modelId !== undefined ? delta.payload.modelId : s.modelId,
            updatedAt: Date.now(),
          };
        }
        return s;
      });
      useChatStore.setState({ sessions: updated });
    } else if (delta.operation === "deleted") {
      const filtered = store.sessions.filter((s) => s.id !== delta.entityId);
      const isCurrent = store.activeSessionId === delta.entityId;
      useChatStore.setState({
        sessions: filtered,
        activeSessionId: isCurrent ? (filtered[0]?.id ?? null) : store.activeSessionId,
        messages: isCurrent ? (filtered[0]?.messages ?? []) : store.messages,
      });
    }
  }

  // 3. Device Lifecycle & Pairing Notification
  if (delta.entityType === "device") {
    if (delta.payload?.action === "device_linked") {
      // Remote browser paired - refresh state from server seamlessly
      cloudSyncService.restoreFromCloud();
    } else if (delta.payload?.action === "revoke_all_others" && delta.payload?.currentDeviceId !== currentDev) {
      // Remote logout initiated
      disconnectRealtimeSync();
      window.location.reload();
    } else if (delta.payload?.status === "revoked" && delta.entityId === currentDev) {
      disconnectRealtimeSync();
      window.location.reload();
    }
  }
}
