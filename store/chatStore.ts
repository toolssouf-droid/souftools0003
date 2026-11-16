import { create } from "zustand";
import { saveSessionToCloud, deleteSessionFromCloud, getUserSessionsFromCloud } from "@/lib/backendServices";
import { getAuthCookie, getOrCreateAuthSession } from "@/lib/authCookies";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { SearchSource } from "@/lib/sourcesHelper";
import { AgentActivityState } from "@/lib/agent/agentActivityTypes";

export type SuggestionType = "followup" | "action" | "tool" | "multichoice" | "proactive";

export interface SoufAISuggestionItem {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  action: string;
  payload: string;
  priority?: number;
  reason?: string;
  type?: SuggestionType;
  questionTitle?: string;
}

export interface SoufAISuggestionsConfig {
  enabled: boolean;
  maxSuggestions: number; // 1 - 4
  style: "concise" | "smart" | "proactive";
  allowToolSuggestions: boolean;
  allowProactiveSuggestions: boolean;
}

export interface SoufImageSettingsState {
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "custom";
  width: number;
  height: number;
  quality: "economy" | "standard" | "high" | "ultra";
  numImages: number;
  outputFormat: "png" | "jpeg" | "webp";
  style: string;
  transparentBg: boolean;
  autoSelect: boolean;
  isOpen: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  content: string;
  timestamp: number;
  modelUsed?: string;
  providerUsed?: string;
  keyUsedMasked?: string;
  webSearchUsed?: boolean;
  reasoningMode?: "deep_thinking" | "deep_analysis" | "fast_mode";
  reasoningSteps?: string[];
  reflectionSteps?: string[];
  hypotheses?: string[];
  confidenceScore?: number;
  sources?: SearchSource[];
  agentSteps?: string[];
  activityState?: AgentActivityState;
  suggestions?: SoufAISuggestionItem[];
  selectedSuggestions?: string[];
  queriesUsed?: string[];
  pagesRead?: { url: string; title: string; length: number }[];
  usedMemories?: {
    id: string;
    type: string;
    content: string;
    projectName?: string;
  }[];
  candidateNewMemory?: {
    type: string;
    content: string;
    projectId?: string;
    projectName?: string;
    importance: number;
    isExplicitRequest: boolean;
  } | null;
  attachments?: {
    type: "image" | "file" | "audio";
    mimeType: string;
    data: string; // base64 payload
    name: string;
    size: number;
  }[];
  rating?: "like" | "dislike" | null;
  widgetData?: { type: string; data: any } | null;
  isStreaming?: boolean;
  reasoning?: string;
  toolCalls?: any[];
}

export type SoufAIModelId = "spark" | "core" | "pro" | "ultra";

function isSoufAIModelId(modelId: string): modelId is SoufAIModelId {
  return modelId === "spark" || modelId === "core" || modelId === "pro" || modelId === "ultra";
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  messages: ChatMessage[];
  source?: "web" | "telegram";
  channel?: "web" | "telegram";
  isTelegram?: boolean;
  telegramChatId?: string;
  telegramUsername?: string;
  telegramSender?: string;
}

interface ChatStoreState {
  currentModel: SoufAIModelId;
  selectedModel: string;
  webSearchEnabled: boolean;
  activeSessionId: string | null;
  sessions: ChatSession[];
  messages: ChatMessage[];
  memoryItems: any[];
  savedSources: SearchSource[];
  isGenerating: boolean;
  userEmail: string | null;
  userId: string | null;
  userName: string | null;
  isAdmin: boolean;
  sidebarOpen: boolean;
  liveSearching: boolean;
  liveSearchSources: SearchSource[];
  liveSearchQuery: string;
  activeTools: string[];
  suggestionsConfig: SoufAISuggestionsConfig;
  contextualSuggestions: { label: string; text: string }[];
  soufImageSettings: SoufImageSettingsState;
  isDashboardOpen: boolean;
  dashboardTab: "memory" | "roadmap" | "settings";
  inputText: string;
  setInputText: (text: string) => void;

  // Actions
  setIsDashboardOpen: (open: boolean) => void;
  setDashboardTab: (tab: "memory" | "roadmap" | "settings") => void;
  setCurrentModel: (model: SoufAIModelId | string) => void;
  setSelectedModel: (model: string) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  setSuggestionsConfig: (config: Partial<SoufAISuggestionsConfig>) => void;
  setContextualSuggestions: (suggestions: { label: string; text: string }[]) => void;
  setSoufImageSettings: (settings: Partial<SoufImageSettingsState>) => void;
  setUserEmail: (email: string | null) => void;
  setUserId: (userId: string | null) => void;
  setUserName: (userName: string | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  clearAuth: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSessions: (sessions: ChatSession[]) => void;
  loadSessionsFromCloud: () => Promise<void>;
  clearAllSessions: () => void;
  clearAllMemory: () => void;
  toggleSaveSource: (source: SearchSource) => void;
  setLiveSearch: (searching: boolean, sources?: SearchSource[], query?: string) => void;
  toggleTool: (toolId: string) => void;
  clearTools: () => void;
  setToolActive: (toolId: string, active: boolean) => void;
  
  // Chat actions
  createNewSession: () => string;
  setActiveSession: (sessionId: string) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  rateMessage: (messageId: string, rating: "like" | "dislike" | null) => void;
  editUserMessage: (messageId: string, newContent: string) => void;
  updateAndTruncateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  truncateMessagesAfter: (messageId: string) => void;
  clearMessages: () => void;
  deleteSession: (sessionId: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
}

function mergeSessionsWithLocalChanges(
  serverSessions: ChatSession[],
  localSessions: ChatSession[]
): ChatSession[] {
  const merged = new Map(serverSessions.map((session) => [session.id, session]));

  for (const localSession of localSessions) {
    const serverSession = merged.get(localSession.id);
    if (!serverSession || localSession.updatedAt >= serverSession.updatedAt) {
      merged.set(localSession.id, localSession);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export const useChatStore = create<ChatStoreState>()((set, get) => ({
      currentModel: "core",
      selectedModel: "gemini-3.7-flash",
      webSearchEnabled: false,
      activeSessionId: null,
      sessions: [],
      messages: [],
      memoryItems: [],
      savedSources: [],
      isGenerating: false,
      userEmail: null,
      userId: null,
      userName: null,
      isAdmin: false,
      sidebarOpen: false,
      liveSearching: false,
      liveSearchSources: [],
      liveSearchQuery: "",
      activeTools: [],
      suggestionsConfig: {
        enabled: true,
        maxSuggestions: 3,
        style: "smart",
        allowToolSuggestions: true,
        allowProactiveSuggestions: true,
      },
      contextualSuggestions: [],
      soufImageSettings: {
        aspectRatio: "1:1",
        width: 1024,
        height: 1024,
        quality: "standard",
        numImages: 1,
        outputFormat: "png",
        style: "auto",
        transparentBg: false,
        autoSelect: true,
        isOpen: false,
      },
      isDashboardOpen: false,
      dashboardTab: "settings",
      inputText: "",

      setInputText: (text: string) => {
        set({ inputText: text });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("souf-chat-set-prompt", { detail: { prompt: text } }));
        }
      },

      setIsDashboardOpen: (open) => set({ isDashboardOpen: open }),
      setDashboardTab: (tab) => set({ dashboardTab: tab }),

      setCurrentModel: (model) => {
        let sessionToSave: ChatSession | undefined;
        let userId: string | null = null;

        set((state) => {
          const sessions = state.sessions.map((session) => {
            if (session.id !== state.activeSessionId) return session;

            sessionToSave = {
              ...session,
              modelId: model as SoufAIModelId,
              updatedAt: Date.now(),
            };
            return sessionToSave;
          });
          userId = state.userId;

          return {
            currentModel: model as SoufAIModelId,
            selectedModel: model,
            sessions,
          };
        });

        if (userId && sessionToSave) {
          void saveSessionToCloud(userId, sessionToSave);
        }
      },
      setSelectedModel: (model) => set({ selectedModel: model }),
      clearAllSessions: () => {
        const uid = get().userId;
        const sessions = get().sessions;
        if (uid) {
          sessions.forEach((s) => deleteSessionFromCloud(uid, s.id));
        }
        set({ sessions: [], activeSessionId: null, messages: [] });
      },
      clearAllMemory: () => set({ memoryItems: [] }),
      setSuggestionsConfig: (config) =>
        set((state) => ({
          suggestionsConfig: { ...state.suggestionsConfig, ...config },
        })),
      setContextualSuggestions: (suggestions) => set({ contextualSuggestions: suggestions }),
      setSoufImageSettings: (settings) =>
        set((state) => ({
          soufImageSettings: { ...state.soufImageSettings, ...settings },
        })),
      setWebSearchEnabled: (enabled) => {
        set({ webSearchEnabled: enabled });
        // Keep activeTools synchronized
        const tools = get().activeTools;
        if (enabled && !tools.includes("web_search")) {
          set({ activeTools: [...tools, "web_search"] });
        } else if (!enabled && tools.includes("web_search")) {
          set({ activeTools: tools.filter(t => t !== "web_search") });
        }
      },
      setLiveSearch: (searching, sources = [], query = "") =>
        set({
          liveSearching: searching,
          liveSearchSources: sources,
          liveSearchQuery: query,
        }),
      setUserEmail: (email) => {
        if (!email) {
          set({ userEmail: null, isAdmin: false });
          return;
        }
        const clean = (email || "").trim().toLowerCase();
        const isAdm = isUserAdmin(clean);
        set({
          userEmail: clean,
          isAdmin: isAdm,
        });
      },
      setUserName: (userName) => set({ userName }),
      setUserId: (userId) => {
        const previousUserId = get().userId;
        if (previousUserId && userId && previousUserId !== userId) {
          set({ sessions: [], activeSessionId: null, messages: [] });
        }

        set({ userId });
        if (!userId) {
          set({ sessions: [], activeSessionId: null, messages: [] });
          return;
        }
        if (userId) {
          getUserSessionsFromCloud(userId).then((rawSessions) => {
            if (!Array.isArray(rawSessions)) return;

            set((state) => {
              if (state.userId !== userId) return state;

              const sessions = mergeSessionsWithLocalChanges(rawSessions, state.sessions);
              const activeSessionId =
                state.activeSessionId && sessions.some((session) => session.id === state.activeSessionId)
                  ? state.activeSessionId
                  : sessions[0]?.id ?? null;
              const activeSession = sessions.find((session) => session.id === activeSessionId);

              return {
                sessions,
                activeSessionId,
                messages: activeSession ? activeSession.messages || [] : state.messages,
              };
            });
          }).catch(() => null);
        }
      },
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      clearAuth: () => set({
        userEmail: null,
        userId: null,
        userName: null,
        isAdmin: false,
        sessions: [],
        activeSessionId: null,
        messages: [],
      }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSessions: (sessions) => set({ sessions }),
      
      loadSessionsFromCloud: async () => {
        const uid = get().userId || getOrCreateAuthSession()?.userId || "default_user";
        try {
          const rawSessions = await getUserSessionsFromCloud(uid);
          if (Array.isArray(rawSessions)) {
            set((state) => {
              if (state.userId && state.userId !== uid) return state;

              const sessions = mergeSessionsWithLocalChanges(rawSessions, state.sessions);
              const activeSessionId =
                state.activeSessionId && sessions.some((session) => session.id === state.activeSessionId)
                  ? state.activeSessionId
                  : sessions[0]?.id ?? null;
              const activeSession = sessions.find((session) => session.id === activeSessionId);

              return {
                sessions,
                activeSessionId,
                messages: activeSession ? (activeSession.messages || []) : state.messages,
              };
            });
          }
        } catch (err) {
          console.warn("Failed to reload sessions from cloud:", err);
        }
      },
      
      toggleTool: (toolId) => set((state) => {
        let updated = [...state.activeTools];
        
        // Handle intelligence tier mutually exclusive groups
        if (toolId === "deep_thinking") {
          updated = updated.filter(t => t !== "deep_analysis" && t !== "fast_mode");
        } else if (toolId === "deep_analysis") {
          updated = updated.filter(t => t !== "deep_thinking" && t !== "fast_mode");
        } else if (toolId === "fast_mode") {
          updated = updated.filter(t => t !== "deep_thinking" && t !== "deep_analysis");
        }

        if (updated.includes(toolId)) {
          updated = updated.filter(t => t !== toolId);
          if (toolId === "web_search") {
            return { activeTools: updated, webSearchEnabled: false };
          }
        } else {
          updated.push(toolId);
          if (toolId === "web_search") {
            return { activeTools: updated, webSearchEnabled: true };
          }
        }
        return { activeTools: updated };
      }),
      
      clearTools: () => set({ activeTools: [] }),
      
      setToolActive: (toolId, active) => set((state) => {
        let updated = [...state.activeTools];
        if (active) {
          if (!updated.includes(toolId)) {
            updated.push(toolId);
          }
          if (toolId === "web_search") {
            return { activeTools: updated, webSearchEnabled: true };
          }
        } else {
          updated = updated.filter(t => t !== toolId);
          if (toolId === "web_search") {
            return { activeTools: updated, webSearchEnabled: false };
          }
        }
        return { activeTools: updated };
      }),

      toggleSaveSource: (source) => {
        set((state) => {
          const exists = state.savedSources.some((s) => s.url === source.url);
          if (exists) {
            return {
              savedSources: state.savedSources.filter((s) => s.url !== source.url),
            };
          } else {
            return {
              savedSources: [{ ...source, isSaved: true }, ...state.savedSources],
            };
          }
        });
      },

      createNewSession: () => {
        const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const authData = getOrCreateAuthSession();
        const activeUid = get().userId || authData?.userId || authData?.email;

        const newSession: ChatSession = {
          id: newId,
          title: "محادثة جديدة",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          modelId: get().currentModel,
          messages: [],
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: newId,
          messages: [],
          userId: activeUid || state.userId,
          userEmail: authData?.email || state.userEmail,
        }));

        // Sync creation directly with server PostgreSQL
        fetch("/api/v1/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": activeUid || "",
            "x-user-email": authData?.email || "",
          },
          body: JSON.stringify({ id: newId, title: "محادثة جديدة", modelId: get().currentModel }),
        }).catch(() => null);

        if (activeUid) {
          saveSessionToCloud(activeUid, newSession).catch(() => null);
        }

        return newId;
      },

      setActiveSession: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (session) {
          const currentModel = isSoufAIModelId(session.modelId) ? session.modelId : "core";
          set({
            activeSessionId: sessionId,
            messages: session.messages || [],
            currentModel,
            selectedModel: currentModel,
          });

          // Fetch full message history from server if messages are empty or if it's a telegram-linked session
          if (!session.messages || session.messages.length === 0 || sessionId.startsWith("tg_") || session.isTelegram) {
            fetch(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data && data.session && Array.isArray(data.session.messages)) {
                  if (get().activeSessionId === sessionId) {
                    const formattedMsgs = data.session.messages.map((m: any) => ({
                      id: m.id,
                      role: m.role || (m.sender === "user" ? "user" : "model"),
                      content: m.content || "",
                      timestamp: m.timestamp || Date.now(),
                      source: m.source || (sessionId.startsWith("tg_") ? "telegram" : "web"),
                    }));
                    set({ messages: formattedMsgs });
                  }
                  // Update the session in list
                  set((state) => ({
                    sessions: state.sessions.map((s) =>
                      s.id === sessionId ? { ...s, messages: data.session.messages } : s
                    ),
                  }));
                }
              })
              .catch(() => {});
          }
        }
      },

      addMessage: (msgData) => {
        const newMsg: ChatMessage = {
          ...msgData,
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
        };

        set((state) => {
          const updatedMessages = [...state.messages, newMsg];
          let currentSessionId = state.activeSessionId;
          let updatedSessions = [...state.sessions];
          let targetSession: ChatSession | null = null;

          if (!currentSessionId) {
            currentSessionId = `session_${Date.now()}`;
            targetSession = {
              id: currentSessionId,
              title: msgData.content.slice(0, 30) || "محادثة جديدة",
              createdAt: Date.now(),
              updatedAt: Date.now(),
              modelId: state.currentModel,
              messages: updatedMessages,
            };
            updatedSessions = [targetSession, ...updatedSessions];
          } else {
            updatedSessions = updatedSessions.map((s) => {
              if (s.id === currentSessionId) {
                const firstUserContent = updatedMessages.find((m) => m.role === "user")?.content;
                targetSession = {
                  ...s,
                  title: firstUserContent ? firstUserContent.slice(0, 35) : s.title,
                  updatedAt: Date.now(),
                  messages: updatedMessages,
                };
                return targetSession;
              }
              return s;
            });
          }

          const uid = state.userId;
          if (uid && targetSession) {
            saveSessionToCloud(uid, targetSession);
          }

          return {
            messages: updatedMessages,
            activeSessionId: currentSessionId,
            sessions: updatedSessions,
          };
        });

        return newMsg.id;
      },

      updateMessage: (messageId, updates) => {
        set((state) => {
          const updatedMessages = state.messages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          );

          const activeId = state.activeSessionId;
          let targetSession: ChatSession | null = null;
          const updatedSessions = state.sessions.map((s) => {
            if (s.id === activeId) {
              targetSession = {
                ...s,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
              return targetSession;
            }
            return s;
          });

          // Prevent excessive Cloud write stream exhausting queue during typing/streaming animations
          const isCurrentlyStreaming = updates.isStreaming === true || 
            (updates.isStreaming === undefined && state.messages.find((m) => m.id === messageId)?.isStreaming === true);

          const uid = state.userId;
          if (uid && targetSession && !isCurrentlyStreaming) {
            saveSessionToCloud(uid, targetSession);
          }

          return {
            messages: updatedMessages,
            sessions: updatedSessions,
          };
        });
      },

      rateMessage: (messageId, rating) => {
        get().updateMessage(messageId, { rating });
      },

      editUserMessage: (messageId, newContent) => {
        get().updateMessage(messageId, { content: newContent });
      },

      updateAndTruncateMessage: (messageId, updates) => {
        set((state) => {
          const targetIndex = state.messages.findIndex((m) => m.id === messageId);
          if (targetIndex === -1) return state;

          // Truncate messages so that everything after targetIndex is removed
          const truncated = state.messages.slice(0, targetIndex + 1).map((m, idx) => {
            if (idx === targetIndex) {
              return { ...m, ...updates };
            }
            return m;
          });

          const activeId = state.activeSessionId;
          let targetSession: ChatSession | null = null;
          const updatedSessions = state.sessions.map((s) => {
            if (s.id === activeId) {
              targetSession = {
                ...s,
                messages: truncated,
                updatedAt: Date.now(),
              };
              return targetSession;
            }
            return s;
          });

          const uid = state.userId;
          if (uid && targetSession) {
            saveSessionToCloud(uid, targetSession);
          }

          return {
            messages: truncated,
            sessions: updatedSessions,
          };
        });
      },

      truncateMessagesAfter: (messageId) => {
        set((state) => {
          const targetIndex = state.messages.findIndex((m) => m.id === messageId);
          if (targetIndex === -1) return state;

          const truncated = state.messages.slice(0, targetIndex + 1);
          const activeId = state.activeSessionId;
          let targetSession: ChatSession | null = null;
          const updatedSessions = state.sessions.map((s) => {
            if (s.id === activeId) {
              targetSession = {
                ...s,
                messages: truncated,
                updatedAt: Date.now(),
              };
              return targetSession;
            }
            return s;
          });

          const uid = state.userId;
          if (uid && targetSession) {
            saveSessionToCloud(uid, targetSession);
          }

          return {
            messages: truncated,
            sessions: updatedSessions,
          };
        });
      },

      clearMessages: () => {
        const activeId = get().activeSessionId;
        const uid = get().userId;
        set((state) => {
          const updatedSessions = state.sessions.map((s) => {
            if (s.id === activeId) {
              const updated = { ...s, messages: [], updatedAt: Date.now() };
              if (uid) saveSessionToCloud(uid, updated);
              return updated;
            }
            return s;
          });
          return {
            messages: [],
            sessions: updatedSessions,
          };
        });
      },

      deleteSession: (sessionId) => {
        // Sync deletion with server PostgreSQL
        fetch(`/api/v1/conversations/${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
        }).catch(() => null);

        // If it is a telegram session, also notify telegram manager
        if (sessionId.startsWith("tg_")) {
          fetch(`/api/v1/telegram/conversations?sessionId=${encodeURIComponent(sessionId)}`, {
            method: "DELETE",
          }).catch(() => null);
        }

        const uid = get().userId;
        if (uid) {
          deleteSessionFromCloud(uid, sessionId).catch(() => null);
        }
        set((state) => {
          const filtered = state.sessions.filter((s) => s.id !== sessionId);
          const isDeletingActive = state.activeSessionId === sessionId;
          return {
            sessions: filtered,
            activeSessionId: isDeletingActive ? (filtered[0]?.id || null) : state.activeSessionId,
            messages: isDeletingActive ? (filtered[0]?.messages || []) : state.messages,
          };
        });
      },

      setIsGenerating: (isGenerating) => set({ isGenerating }),
    })
);

// Immediately bootstrap user sessions & settings from server-side store on browser load
if (typeof window !== "undefined") {
  try {
    // Purge any residual local client storage so no conversation data remains on the device
    localStorage.removeItem("souftools_chat_store_v1");
  } catch {}

  const initServerSync = () => {
    const authData = getOrCreateAuthSession();
    const isRealEmail = Boolean(
      authData?.email &&
      authData.email.includes("@") &&
      !authData.email.endsWith("@souftools.app") &&
      !authData.email.endsWith("@souftools.internal") &&
      !authData.email.startsWith("usr_guest_") &&
      !authData.email.startsWith("guest_user@")
    );
    const email = isRealEmail ? authData!.email : null;
    const uid = authData?.userId || (email ? `usr_${email.split("@")[0]}` : null);

    useChatStore.setState({
      userId: uid,
      userEmail: email,
      isAdmin: email ? (authData?.isAdmin || isUserAdmin(email)) : false,
    });

    if (uid && email) {
      // Hydrate state directly from server database / server disk store
      import("@/lib/sync/cloudSyncService").then(({ cloudSyncService }) => {
        cloudSyncService.restoreFromCloud(uid, email).catch(() => null);
      });

      import("@/lib/sync/cloudSyncClient").then(({ bootstrapCloudSync }) => {
        bootstrapCloudSync().catch(() => null);
      });
    }
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(initServerSync, 0);
  } else {
    window.addEventListener("DOMContentLoaded", initServerSync, { once: true });
  }
}

