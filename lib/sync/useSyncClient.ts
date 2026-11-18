/**
 * SoufTools Client-Side Cloud Synchronization Hook & State Reconciler
 * 
 * Manages server-authoritative live synchronization:
 * - Ephemeral memory state in UI (no permanent IndexedDB/LocalStorage for user data)
 * - Automatic bootstrap from `/api/v1/sync/bootstrap`
 * - Live SSE subscription to `/api/v1/sync/events`
 * - Optimistic update dispatching with server rollback
 * - Multi-device conflict resolution
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore, ChatSession, ChatMessage, resolveSessionModelId } from "@/store/chatStore";
import { cloudSyncService } from "@/lib/sync/cloudSyncService";
import { mapSyncBootstrapResponse } from "@/lib/sync/bootstrapMapper";

export interface SyncStatusState {
  status: "connected" | "syncing" | "disconnected" | "error" | "revoked";
  lastSyncedAt: Date | null;
  activeDevicesCount: number;
  unreadNotifications: number;
  errorMessage: string | null;
}

// Generate or retrieve persistent Device ID for this browser
export function getClientDeviceId(): string {
  if (typeof window === "undefined") return "server_render";
  let devId = localStorage.getItem("souftools_device_id");
  if (!devId) {
    devId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    try {
      localStorage.setItem("souftools_device_id", devId);
    } catch {}
  }
  return devId;
}

export function useSyncClient() {
  const [syncState, setSyncState] = useState<SyncStatusState>({
    status: "syncing",
    lastSyncedAt: null,
    activeDevicesCount: 1,
    unreadNotifications: 0,
    errorMessage: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastCursorRef = useRef<string | null>(null);

  /**
   * 1. Bootstrap: Fetch full initial state from Server
   */
  const executeBootstrap = useCallback(async () => {
    try {
      const modelAtStart = useChatStore.getState().currentModel;
      setSyncState((prev) => ({ ...prev, status: "syncing", errorMessage: null }));
      const deviceId = getClientDeviceId();

      const res = await fetch("/api/v1/sync/bootstrap", {
        headers: {
          "x-device-id": deviceId,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setSyncState((prev) => ({ ...prev, status: "disconnected" }));
          return;
        }
        throw new Error(`Bootstrap failed (${res.status})`);
      }

      const snapshot = mapSyncBootstrapResponse(await res.json());

      lastCursorRef.current = snapshot.cursor;

      // Merge the snapshot without discarding a locally created/current conversation.
      const store = useChatStore.getState();
      const sessionMap = new Map(snapshot.sessions.map((session) => [session.id, session]));
      for (const localSession of store.sessions) {
        const serverSession = sessionMap.get(localSession.id);
        if (!serverSession || localSession.updatedAt >= serverSession.updatedAt) {
          sessionMap.set(localSession.id, localSession);
        }
      }
      const sessions = Array.from(sessionMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      const activeSessionId =
        store.activeSessionId && sessionMap.has(store.activeSessionId)
          ? store.activeSessionId
          : snapshot.activeSessionId && sessionMap.has(snapshot.activeSessionId)
          ? snapshot.activeSessionId
          : sessions[0]?.id ?? null;
      const activeSession = sessions.find((session) => session.id === activeSessionId);
      useChatStore.setState({
        sessions,
        activeSessionId,
        messages: activeSession?.messages || [],
      });

      // Apply server user preferences
      if (snapshot.preferences) {
        const p = snapshot.preferences;
        if (p.webSearchEnabled !== undefined) store.setWebSearchEnabled(p.webSearchEnabled);
        const defaultModel = resolveSessionModelId(p.defaultModelId);
        if (defaultModel) store.setDefaultModel(defaultModel);
      }
      const activeModel = resolveSessionModelId(activeSession?.modelId);
      const defaultModel = resolveSessionModelId(snapshot.preferences?.defaultModelId);
      if (useChatStore.getState().currentModel === modelAtStart) {
        const restoredModel = activeModel || defaultModel;
        if (restoredModel) useChatStore.getState().setCurrentModel(restoredModel);
      }

      setSyncState({
        status: "connected",
        lastSyncedAt: new Date(),
        activeDevicesCount: snapshot.activeDevicesCount,
        unreadNotifications: snapshot.unreadNotifications,
        errorMessage: null,
      });

      reconnectAttemptsRef.current = 0;
    } catch (err: any) {
      console.warn("[CloudSync] Bootstrap warning:", err);
      setSyncState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: err?.message || "تعذر الاتصال بالخادم",
      }));
    }
  }, []);

  /**
   * 2. Real-Time SSE Event Stream
   */
  const connectEventStream = useCallback(() => {
    if (typeof window === "undefined") return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const deviceId = getClientDeviceId();
    const es = new EventSource(`/api/v1/sync/events?deviceId=${encodeURIComponent(deviceId)}`);
    eventSourceRef.current = es;

    const handleConnected = () => {
      setSyncState((prev) => ({
        ...prev,
        status: "connected",
        lastSyncedAt: new Date(),
        errorMessage: null,
      }));
      reconnectAttemptsRef.current = 0;
    };
    es.addEventListener("init", handleConnected);
    es.addEventListener("connected", handleConnected);

    es.addEventListener("sync", (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data);
        const currentDeviceId = getClientDeviceId();

        // Handle security/revocation & pairing events
        if (event.entityType === "device") {
          if (event.payload?.action === "device_linked") {
            cloudSyncService.restoreFromCloud();
            executeBootstrap();
          } else if (
            (event.operation === "deleted" && event.entityId === currentDeviceId) ||
            (event.payload?.action === "revoke_all_other" && event.payload?.exceptDeviceId !== currentDeviceId)
          ) {
            setSyncState((prev) => ({ ...prev, status: "revoked" }));
            es.close();
            return;
          }
        }

        if (
          event.entityType === "preference" &&
          event.operation === "updated" &&
          typeof event.payload?.defaultModelId === "string"
        ) {
          const currentStore = useChatStore.getState();
          currentStore.setDefaultModel(event.payload.defaultModelId);
          if (!currentStore.activeSessionId) {
            currentStore.setCurrentModel(event.payload.defaultModelId);
          }
        }

        // Handle live message created on another device
        if (event.entityType === "message" && event.operation === "created") {
          const store = useChatStore.getState();
          const p = event.payload;

          if (p.conversationId === store.activeSessionId) {
            // Check if message is already present locally
            const exists = store.messages.some((m) => m.id === p.id);
            if (!exists) {
              const incomingMsg: ChatMessage = {
                id: p.id,
                role: p.sender === "user" ? "user" : "model",
                content: p.content,
                timestamp: new Date(p.createdAt || Date.now()).getTime(),
                reasoningSteps: p.reasoning ? [p.reasoning] : undefined,
                sources: p.sources || [],
              };
              useChatStore.setState((state) => ({
                messages: [...state.messages, incomingMsg],
              }));
            }
          }
        }

        // Handle conversation changes
        if (event.entityType === "conversation") {
          const p = event.payload;
          if (event.operation === "created") {
            useChatStore.setState((state) => {
              const exists = state.sessions.some((s) => s.id === p.id);
              if (exists) return state;
              const newSession: ChatSession = {
                id: p.id,
                title: p.title,
                modelId: p.modelId || "spark",
                createdAt: new Date(p.createdAt || Date.now()).getTime(),
                updatedAt: new Date(p.updatedAt || Date.now()).getTime(),
                messages: [],
              };
              return {
                sessions: [newSession, ...state.sessions],
              };
            });
          } else if (event.operation === "updated") {
            useChatStore.setState((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === p.id ? { ...s, title: p.title || s.title, modelId: p.modelId || s.modelId } : s
              ),
            }));
          } else if (event.operation === "deleted") {
            useChatStore.setState((state) => {
              const filtered = state.sessions.filter((s) => s.id !== p.id);
              return {
                sessions: filtered,
                activeSessionId: state.activeSessionId === p.id ? filtered[0]?.id || null : state.activeSessionId,
                messages: state.activeSessionId === p.id ? filtered[0]?.messages || [] : state.messages,
              };
            });
          }
        }

        setSyncState((prev) => ({
          ...prev,
          lastSyncedAt: new Date(),
        }));
      } catch (err) {
        console.warn("[SSE Parser Error]:", err);
      }
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setSyncState((prev) => ({ ...prev, status: "disconnected" }));

      // Exponential backoff reconnect
      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      reconnectAttemptsRef.current += 1;

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        executeBootstrap().then(connectEventStream);
      }, delay);
    };
  }, [executeBootstrap]);

  // Initial startup
  useEffect(() => {
    executeBootstrap().then(() => {
      connectEventStream();
    });

    const handleOnline = () => {
      executeBootstrap().then(connectEventStream);
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [executeBootstrap, connectEventStream]);

  return {
    syncState,
    refreshSync: executeBootstrap,
    deviceId: getClientDeviceId(),
  };
}
