"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import { useChatStore } from "@/store/chatStore";
import { auth } from "@/lib/firebase";
import { getAuthCookie } from "@/lib/authCookies";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { authClient } from "@/lib/auth/authClient";
import { Menu, Settings, Brain, Sparkles, ArrowRight, ArrowLeft, Home, ShieldAlert } from "lucide-react";

import { SearchSource } from "@/lib/sourcesHelper";
import { SoufAISuggestionItem } from "@/store/chatStore";
import { AgentActivityState } from "@/lib/agent/agentActivityTypes";
import { SoufBehaviorEngine } from "@/lib/behavior/behaviorEngine";
import { isRtlLocale } from "@/lib/i18n";
import { useGmailStore } from "@/store/gmailStore";
import { useScheduleWatcher } from "@/hooks/useScheduleWatcher";
import { CloudSyncIndicator } from "@/components/ui/CloudSyncIndicator";
import { BehavioralNotificationHub } from "@/components/ui/BehavioralNotificationHub";
import { cloudSyncService } from "@/lib/sync/cloudSyncService";

interface ChatLayoutProps {
  locale: string;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ locale }) => {
  // Activate the autonomous agent scheduler watcher
  useScheduleWatcher();

  const router = useRouter();
  const {
    messages,
    addMessage,
    updateMessage,
    rateMessage,
    editUserMessage,
    isGenerating,
    setIsGenerating,
    currentModel,
    webSearchEnabled,
    sidebarOpen,
    setSidebarOpen,
    clearMessages,
    userEmail,
    setUserEmail,
    setUserId,
    isAdmin,
    setIsAdmin,
    savedSources,
    setLiveSearch,
    suggestionsConfig,
    setIsDashboardOpen,
    setDashboardTab,
  } = useChatStore();

  const [authInitialized, setAuthInitialized] = useState(false);
  const [resolvedSessionEmail, setResolvedSessionEmail] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const isRtl = isRtlLocale(locale);
  const typingTimerRef = React.useRef<any>(null);
  const typingResolveRef = React.useRef<(() => void) | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      // 1. Instant check from localStorage/cookie/store
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const storeEmail = useChatStore.getState().userEmail;
      const storeUid = useChatStore.getState().userId;

      let rawEmail = storeEmail || cookieData?.email || null;
      let effectiveUid = storeUid || cookieData?.userId || null;

      if (!rawEmail) {
        try {
          const fbUser = auth.currentUser;
          rawEmail = fbUser?.email || null;
          effectiveUid = effectiveUid || fbUser?.uid || null;
        } catch (error) {
          console.warn("Firebase auth session check failed; checking Better Auth session.", error);
        }
      }

      // 2. If not found in immediate sync storage, query Better Auth session async
      if (!rawEmail) {
        try {
          const betterSession = await authClient.getSession().catch(() => null);
          if (betterSession?.data?.user?.email) {
            rawEmail = betterSession.data.user.email;
            effectiveUid = betterSession.data.user.id || effectiveUid;
          }
        } catch {}
      }

      const isReal = Boolean(
        rawEmail &&
        rawEmail.includes("@") &&
        !rawEmail.startsWith("usr_guest_") &&
        !rawEmail.startsWith("guest_user@") &&
        !rawEmail.endsWith("@souftools.app") &&
        !rawEmail.endsWith("@souftools.internal")
      );

      const effectiveEmail = isReal ? rawEmail : null;
      const isAdm = cookieData?.isAdmin || (effectiveEmail ? isUserAdmin(effectiveEmail) : false) || useChatStore.getState().isAdmin;

      if (!isMounted) return;

      if (effectiveEmail) {
        setResolvedSessionEmail(effectiveEmail);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem("souftools_just_logged_out");
          } catch {}
        }
        setUserEmail(effectiveEmail);
        if (effectiveUid) setUserId(effectiveUid);
        if (isAdm) setIsAdmin(true);
        setAuthInitialized(true);
      } else {
        // Strictly redirect unauthenticated users to login
        setUserEmail(null);
        setIsAdmin(false);
        setAuthInitialized(true);
        router.replace(`/${locale}/login?redirect=chat`);
      }
    };

    checkSession().catch((error) => {
      console.error("Chat session initialization failed:", error);
      if (!isMounted) return;
      setAuthInitialized(true);
      router.replace(`/${locale}/login?redirect=chat`);
    });

    // Firebase Auth State Listener
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!isMounted) return;
      if (user?.email) {
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem("souftools_just_logged_out");
          } catch {}
        }
        const isAdmUser = isUserAdmin(user.email) || useChatStore.getState().isAdmin;
        setUserEmail(user.email);
        if (isAdmUser) setIsAdmin(true);
        setUserId(user.uid);
        setAuthInitialized(true);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [setUserEmail, setUserId, setIsAdmin, locale, router]);

  // Stop Generation Handler
  const finalizeActivityState = (
    messageId: string,
    status: "cancelled" | "failed",
    errorMessage?: string
  ) => {
    const message = useChatStore.getState().messages.find((item) => item.id === messageId);
    if (!message?.activityState) return undefined;
    return {
      ...message.activityState,
      status,
      currentActiveStepTitle: undefined,
      activities: message.activityState.activities.map((activity) =>
        activity.status === "running" ? { ...activity, status } : activity
      ),
      planSteps: message.activityState.planSteps.map((step) =>
        step.status === "running" ? { ...step, status } : step
      ),
      toolsUsed: message.activityState.toolsUsed.map((tool) =>
        tool.status === "running" ? { ...tool, status } : tool
      ),
      ...(errorMessage ? { error: { message: errorMessage, canRetry: true } } : {}),
    };
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    typingResolveRef.current?.();
    typingResolveRef.current = null;
    setIsGenerating(false);
    setLiveSearch(false);

    // Set any currently streaming message to stopped (isStreaming = false)
    const stateMessages = useChatStore.getState().messages;
    const streamingMsg = [...stateMessages].reverse().find((m) => m.isStreaming);
    if (streamingMsg) {
      updateMessage(streamingMsg.id, {
        content:
          streamingMsg.content ||
          (isRtl ? "تم إيقاف الرد قبل وصوله." : "Generation stopped before a response arrived."),
        isStreaming: false,
        activityState: finalizeActivityState(streamingMsg.id, "cancelled"),
      });
    }
  };

  // Smooth, high-performance streaming animation
  const animateTextStream = (
    messageId: string,
    fullText: string,
    metadata: {
      modelUsed?: string;
      providerUsed?: string;
      keyUsedMasked?: string;
      webSearchUsed?: boolean;
      sources?: SearchSource[];
      agentSteps?: string[];
      reasoningSteps?: string[];
      reflectionSteps?: string[];
      hypotheses?: string[];
      confidenceScore?: number;
      reasoningMode?: "deep_thinking" | "deep_analysis" | "fast_mode";
      activityState?: AgentActivityState;
      suggestions?: SoufAISuggestionItem[];
      queriesUsed?: string[];
      pagesRead?: { url: string; title: string; length: number }[];
      usedMemories?: any[];
      candidateNewMemory?: any;
      widgetData?: { type: string; data: any } | null;
    }
  ) => {
    return new Promise<void>((resolve) => {
      typingResolveRef.current = resolve;
      let currentIndex = 0;
      const totalLen = fullText.length;
      // Smooth adaptive chunking targeting ~30fps updates without UI thread blocking
      const totalSteps = Math.max(12, Math.min(60, Math.floor(totalLen / 5)));
      const chunkSize = Math.max(3, Math.ceil(totalLen / totalSteps));

      typingTimerRef.current = setInterval(() => {
        currentIndex += chunkSize;
        if (currentIndex >= fullText.length) {
          currentIndex = fullText.length;
          if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          typingResolveRef.current = null;
          updateMessage(messageId, {
            content: fullText,
            isStreaming: false,
            ...metadata,
          });
          cloudSyncService.triggerAutoSync(3000);
          resolve();
        } else {
          updateMessage(messageId, {
            content: fullText.slice(0, currentIndex),
            isStreaming: true,
            ...metadata,
          });
        }
      }, 30);
    });
  };

  const streamAssistantResponse = async (userPrompt: string, attachments?: any[]) => {
    useChatStore.getState().setContextualSuggestions([]);
    setIsGenerating(true);

    const isSearchNeeded =
      webSearchEnabled ||
      /ابحث عن|أخبار|سعر|معلومات عن|أحدث|البحث في الويب/i.test(userPrompt);

    if (isSearchNeeded) {
      setLiveSearch(true, [], userPrompt);
      SoufBehaviorEngine.logEvent("search_started", { toolName: "webSearch" });
    } else {
      SoufBehaviorEngine.logEvent("conversation_started");
    }

    if (attachments && attachments.length > 0) {
      SoufBehaviorEngine.logEvent("file_uploaded", { count: attachments.length });
    }

    const bhCtx = SoufBehaviorEngine.getPersonalizationContext();

    // Create Assistant Placeholder Message with isStreaming: true
    const assistantMsgId = addMessage({
      role: "model",
      content: "",
      isStreaming: true,
      modelUsed: currentModel,
    });

    // Keep request ownership local so an older request cannot clear a newer one.
    const requestController = new AbortController();
    abortControllerRef.current = requestController;

    let gmailToken: string | null = null;
    try {
      gmailToken = useGmailStore.getState().accessToken;
      if (!gmailToken && typeof window !== "undefined") {
        const rawGmail = localStorage.getItem("souftools-gmail-storage");
        if (rawGmail) {
          gmailToken = JSON.parse(rawGmail)?.state?.accessToken || null;
        }
      }
    } catch {}

    try {
      const activeSessionId = useChatStore.getState().activeSessionId;
      const allSessions = useChatStore.getState().sessions;
      const activeSession = allSessions.find((s) => s.id === activeSessionId);
      const isTelegramContinuation = Boolean(
        activeSession?.isTelegram ||
        activeSession?.source === "telegram" ||
        activeSession?.channel === "telegram" ||
        activeSessionId?.startsWith("tg_")
      );
      const telegramMeta = isTelegramContinuation
        ? {
            chatId: activeSession?.telegramChatId,
            sender: activeSession?.telegramSender,
            username: activeSession?.telegramUsername,
            title: activeSession?.title,
          }
        : undefined;

      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const requestHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) requestHeaders["x-user-email"] = cookieData.email;
      if (cookieData?.userId) requestHeaders["x-user-id"] = cookieData.userId;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: requestHeaders,
        signal: requestController.signal,
        body: JSON.stringify({
          modelId: currentModel,
          prompt: userPrompt,
          webSearchEnabled,
          messages: useChatStore.getState().messages.slice(-10),
          attachments: attachments || [],
          activeTools: useChatStore.getState().activeTools || [],
          gmailToken,
          suggestionsConfig,
          userId: useChatStore.getState().userId,
          behaviorContext: bhCtx ? JSON.stringify(bhCtx) : undefined,
          sessionId: activeSessionId,
          isTelegramContinuation,
          telegramMeta,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedLiveTokens = "";
        let hasReceivedLiveTokens = false;
        let hasReceivedComplete = false;
        let hasReceivedError = false;

        const processEvent = async (part: string) => {
          const dataStr = part
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).replace(/^ /, ""))
            .join("\n")
            .trim();
          if (!dataStr) return;

          try {
            const payload = JSON.parse(dataStr);

            if (payload.type === "token") {
              const delta = payload.data?.delta || "";
              if (delta) {
                hasReceivedLiveTokens = true;
                accumulatedLiveTokens += delta;
                updateMessage(assistantMsgId, {
                  content: accumulatedLiveTokens,
                  isStreaming: true,
                });
              }
            } else if (payload.type === "activity") {
              const stateData = payload.data?.state;
              updateMessage(assistantMsgId, {
                activityState: stateData,
              });
              if (stateData?.contextualSuggestions) {
                useChatStore.getState().setContextualSuggestions(stateData.contextualSuggestions);
              }
            } else if (payload.type === "complete") {
              hasReceivedComplete = true;
              const data = payload.data;
              const finalSources = data.sources || [];

              if (data.contextualSuggestions) {
                useChatStore.getState().setContextualSuggestions(data.contextualSuggestions);
              }

              setLiveSearch(false, finalSources, data.webSearchUsed ? userPrompt : "");

              const completedText = data.text?.trim() || data.finalAnswer?.trim() || "";
              const streamedText = accumulatedLiveTokens.trim();
              const finalStreamText =
                completedText && completedText.length >= streamedText.length
                  ? completedText
                  : streamedText ||
                    completedText ||
                    (data.status === "cancelled"
                      ? (isRtl ? "تم إيقاف المهمة." : "The task was stopped.")
                      : undefined) ||
                    (isRtl ? "تمت معالجة استفسارك بنجاح." : "Your request was processed successfully.");

              const metadataPayload = {
                modelUsed: data.modelUsed,
                providerUsed: data.providerUsed,
                keyUsedMasked: data.keyUsedMasked,
                webSearchUsed: data.webSearchUsed || false,
                sources: finalSources,
                agentSteps: data.agentSteps || [],
                reasoningSteps: data.reasoningSteps || data.agentSteps || [],
                reflectionSteps: data.reflectionSteps || [],
                hypotheses: data.hypotheses || [],
                confidenceScore: data.confidenceScore,
                reasoningMode: data.reasoningMode || (data.agentSteps && data.agentSteps.length > 1 ? "deep_thinking" : undefined),
                activityState: data.activityState || payload.data.state || undefined,
                suggestions: data.suggestions || [],
                queriesUsed: data.queriesUsed || [],
                pagesRead: data.pagesRead || [],
                usedMemories: data.usedMemories || [],
                candidateNewMemory: data.candidateNewMemory || undefined,
                widgetData: data.widgetData || undefined,
              };

              if (hasReceivedLiveTokens && streamedText.length > 0) {
                updateMessage(assistantMsgId, {
                  content: finalStreamText,
                  isStreaming: false,
                  ...metadataPayload,
                });
                cloudSyncService.triggerAutoSync(3000);
              } else {
                await animateTextStream(assistantMsgId, finalStreamText, metadataPayload);
              }
            } else if (payload.type === "error") {
              hasReceivedError = true;
              updateMessage(assistantMsgId, {
                content: payload.data?.message || "حدث خطأ أثناء معالجة الطلب.",
                isStreaming: false,
                activityState: finalizeActivityState(
                  assistantMsgId,
                  "failed",
                  payload.data?.message || "حدث خطأ أثناء معالجة الطلب."
                ),
              });
              setLiveSearch(false);
            }
          } catch (e) {
            console.error("Error parsing SSE JSON:", e);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: true });

          const normalizedBuffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          const parts = normalizedBuffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            await processEvent(part);
          }

          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) await processEvent(buffer);
            break;
          }
        }

        if (!hasReceivedComplete && !hasReceivedError) {
          setLiveSearch(false);
          const partialText = accumulatedLiveTokens.trim();
          const interruptionNotice = isRtl
            ? "انقطع الاتصال قبل اكتمال الرد. أعد إرسال الطلب للحصول على إجابة كاملة."
            : "The connection ended before the response completed. Resend the request for a complete answer.";
          updateMessage(assistantMsgId, {
            content: partialText ? `${partialText}\n\n${interruptionNotice}` : interruptionNotice,
            isStreaming: false,
            activityState: finalizeActivityState(assistantMsgId, "failed", interruptionNotice),
          });
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        const errMsg =
          errData.error ||
          errData.message ||
          (isRtl
            ? "نواجه حالياً ضغطاً على خوادم المعالجة، يرجى إعادة المحاولة بعد لحظات أو التواصل مع الدعم الفني."
            : "We are experiencing high server load. Please try again shortly or contact support.");

        updateMessage(assistantMsgId, {
          content: errMsg,
          isStreaming: false,
          activityState: finalizeActivityState(assistantMsgId, "failed", errMsg),
        });
        setLiveSearch(false);

        if (errData.code === "AUTH_REQUIRED") {
          setTimeout(() => {
            router.push(`/${locale}/login?redirect=chat`);
          }, 2000);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Chat generation stopped by user.");
      } else {
        console.error("Chat Error:", err);
        const errMsg = isRtl
          ? "تعذر الاتصال بالخادم نظراً لضغط الشبكة المؤقت. يرجى إعادة المحاولة بعد قليل أو تقديم بلاغ للدعم الفني."
          : "Server connection error due to temporary load. Please try again shortly or contact support.";

        updateMessage(assistantMsgId, {
          content: errMsg,
          isStreaming: false,
          activityState: finalizeActivityState(assistantMsgId, "failed", errMsg),
        });
        setLiveSearch(false);
      }
    } finally {
      if (abortControllerRef.current === requestController) {
        setIsGenerating(false);
        abortControllerRef.current = null;
        // Auto-focus the input box after generation completes
        setTimeout(() => {
          const inputEl = document.querySelector("textarea");
          if (inputEl) {
            inputEl.focus();
          }
        }, 50);
      }
    }
  };

  const handleSendMessage = async (userPrompt: string, attachments?: any[]) => {
    if ((!userPrompt.trim() && (!attachments || attachments.length === 0)) || isGenerating) return;

    // Strict Auth Check: Must be logged in
    const activeEmail = useChatStore.getState().userEmail;
    const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
    const isAuthenticated = !!((activeEmail && !activeEmail.startsWith("usr_guest_") && !activeEmail.startsWith("guest_user@")) || (cookieData?.email && !cookieData.email.startsWith("usr_guest_") && !cookieData.email.startsWith("guest_user@")));

    if (!isAuthenticated) {
      router.replace(`/${locale}/login?redirect=chat`);
      return;
    }

    setEditingMessage(null);

    // 1. Add User Message
    addMessage({
      role: "user",
      content: userPrompt,
      attachments: attachments || [],
    });

    await streamAssistantResponse(userPrompt, attachments);
  };

  // Start Edit User Message
  const handleStartEditUserMessage = (messageId: string, content: string) => {
    if (isGenerating) return;
    setEditingMessage({ id: messageId, content });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("souf-chat-edit-message", {
          detail: { messageId, content },
        })
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  // Save and Regenerate from Edited User Message (In-Place without creating duplicate messages)
  const handleSaveEditedMessage = async (
    messageId: string,
    newContent: string,
    attachments?: any[]
  ) => {
    if (isGenerating) return;

    const activeEmail = useChatStore.getState().userEmail;
    const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
    const isAuthenticated = !!(
      (activeEmail && !activeEmail.startsWith("usr_guest_") && !activeEmail.startsWith("guest_user@")) ||
      (cookieData?.email && !cookieData.email.startsWith("usr_guest_") && !cookieData.email.startsWith("guest_user@"))
    );

    if (!isAuthenticated) {
      router.replace(`/${locale}/login?redirect=chat`);
      return;
    }

    setEditingMessage(null);

    // Update the message in-place and truncate subsequent messages in the conversation branch
    useChatStore.getState().updateAndTruncateMessage(messageId, {
      content: newContent,
      attachments: attachments || [],
    });

    await streamAssistantResponse(newContent, attachments);
  };

  // Regenerate Handler
  const handleRegenerate = async (targetMessage: any) => {
    if (isGenerating) return;

    const allMsgs = useChatStore.getState().messages;
    if (targetMessage.role === "user") {
      useChatStore.getState().truncateMessagesAfter(targetMessage.id);
      await streamAssistantResponse(targetMessage.content, targetMessage.attachments);
    } else {
      // Find the user message immediately preceding this assistant message
      const msgIndex = allMsgs.findIndex((m) => m.id === targetMessage.id);
      if (msgIndex > 0) {
        const prevUserMsg = allMsgs
          .slice(0, msgIndex)
          .reverse()
          .find((m) => m.role === "user");
        if (prevUserMsg) {
          useChatStore.getState().truncateMessagesAfter(prevUserMsg.id);
          await streamAssistantResponse(prevUserMsg.content, prevUserMsg.attachments);
        }
      } else {
        const lastUser = [...allMsgs].reverse().find((m) => m.role === "user");
        if (lastUser) {
          useChatStore.getState().truncateMessagesAfter(lastUser.id);
          await streamAssistantResponse(lastUser.content, lastUser.attachments);
        }
      }
    }
  };

  // Rate Message Handler
  const handleRateMessage = (messageId: string, rating: "like" | "dislike" | null) => {
    rateMessage(messageId, rating);
  };

  const handleSendMessageRef = React.useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;

  // Consume pending intent from Smart Launch screen if present
  React.useEffect(() => {
    if (!authInitialized) return;

    if (typeof window !== "undefined") {
      const rawPending = sessionStorage.getItem("souf_launch_pending_intent");
      if (rawPending) {
        try {
          const pending = JSON.parse(rawPending);
          sessionStorage.removeItem("souf_launch_pending_intent");

          // Only apply if recent (within 60 seconds)
          if (pending && Date.now() - (pending.timestamp || 0) < 60000) {
            if (pending.model) {
              useChatStore.getState().setCurrentModel(pending.model);
            }
            if (pending.tools && Array.isArray(pending.tools)) {
              useChatStore.getState().clearTools();
              pending.tools.forEach((t: string) => {
                useChatStore.getState().setToolActive(t, true);
              });
            }
            if (pending.prompt || (pending.attachments && pending.attachments.length > 0)) {
              setTimeout(() => {
                handleSendMessageRef.current(pending.prompt || "", pending.attachments || []);
              }, 150);
            }
          }
        } catch (e) {
          console.warn("Failed to parse pending launch intent:", e);
        }
      }
    }
  }, [authInitialized]);

  const activeSessionEmail = userEmail || resolvedSessionEmail;

  if (!authInitialized && !activeSessionEmail) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-[#0a0c10] text-[#00d4aa]">
        <div className="w-6 h-6 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#94a3b8]">
          {isRtl ? "جارٍ التحقق من جلسة الدخول..." : "Checking your sign-in session..."}
        </p>
      </div>
    );
  }

  if (!activeSessionEmail) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#0a0c10] px-6 text-center text-[#e8f5f5]">
        <p role="alert" className="text-sm text-[#94a3b8]">
          {isRtl
            ? "تعذر التحقق من جلسة الدخول. سجّل الدخول لفتح الدردشة."
            : "Your session could not be verified. Sign in to open chat."}
        </p>
        <Link
          href={`/${locale}/login?redirect=chat`}
          className="rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/10 px-4 py-2 text-sm font-semibold text-[#00d4aa] transition-colors hover:bg-[#00d4aa]/20"
        >
          {isRtl ? "تسجيل الدخول" : "Sign in"}
        </Link>
      </div>
    );
  }

  const handleSelectSuggestion = (arg: any) => {
    if (isGenerating) return;

    let selectedList: SoufAISuggestionItem[] = [];
    let customAnswer = "";
    let messageId = "";

    if (arg && typeof arg === "object" && "selectedList" in arg) {
      selectedList = arg.selectedList || [];
      customAnswer = arg.customAnswer || "";
      messageId = arg.messageId || "";
    } else if (Array.isArray(arg)) {
      selectedList = arg;
    } else if (arg) {
      selectedList = [arg];
    }

    // Compose user submission text
    let textToSubmit = "";
    const titles: string[] = [];

    if (selectedList.length > 0) {
      const payloads = selectedList.map((s) => {
        titles.push(s.title);
        return s.payload || s.title;
      });
      textToSubmit = payloads.join(" + ");
    }

    if (customAnswer.trim()) {
      if (textToSubmit) {
        textToSubmit += ` (${customAnswer.trim()})`;
      } else {
        textToSubmit = customAnswer.trim();
      }
      titles.push(customAnswer.trim());
    }

    if (!textToSubmit) return;

    // Update message state in store to mark options as selected
    if (messageId && titles.length > 0) {
      useChatStore.getState().updateMessage(messageId, {
        selectedSuggestions: titles,
      });
    }

    handleSendMessage(textToSubmit);
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0c10] text-[#f1f5f9] overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar locale={locale} />

      {/* Main Chat Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden bg-[#0a0c10]">
        {/* Top Header Bar */}
        <header className="h-14 sm:h-16 shrink-0 border-b border-[#1f2633] bg-[#0a0c10]/95 backdrop-blur-xl px-3 sm:px-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Return to Home / Platform Hub */}
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] hover:border-[#00d4aa]/50 text-[#94a3b8] hover:text-[#00d4aa] text-xs font-semibold transition-all shadow-sm active:scale-95 shrink-0"
              title={isRtl ? "الرجوع للصفحة الرئيسية للمنصة" : "Back to Home Hub"}
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline">{isRtl ? "الرئيسية" : "Home"}</span>
            </Link>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-xl transition-all shrink-0 cursor-pointer border ${
                sidebarOpen
                  ? "bg-[#00d4aa]/15 text-[#00d4aa] border-[#00d4aa]/30 shadow-sm shadow-[#00d4aa]/10"
                  : "text-[#94a3b8] hover:text-[#00d4aa] hover:bg-[#12161f] border-transparent hover:border-[#1f2633]"
              }`}
              aria-label="Toggle Navigation Sidebar"
              title={isRtl ? (sidebarOpen ? "إخفاء القائمة الجانبية" : "إظهار القائمة الجانبية") : (sidebarOpen ? "Collapse sidebar" : "Expand sidebar")}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-[#f1f5f9]">
                {isRtl ? "محادثة SoufAI" : "SoufAI Chat"}
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CloudSyncIndicator locale={locale} />
            <BehavioralNotificationHub locale={locale} />

            <button
              onClick={() => {
                setDashboardTab("roadmap");
                setIsDashboardOpen(true);
              }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] hover:border-[#00d4aa]/40 text-[#94a3b8] hover:text-[#00d4aa] text-xs font-medium transition-all cursor-pointer"
              title={isRtl ? "استعراض ميزات وخارطة طريق المستقبل" : "Future Roadmap & Labs"}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00d4aa]" />
              <span>{isRtl ? "ميزات المستقبل" : "Roadmap"}</span>
            </button>
          </div>
        </header>

        {/* Message List */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <MessageList
            messages={messages}
            locale={locale}
            onRegenerate={handleRegenerate}
            onEditUserMessage={handleStartEditUserMessage}
            onRateMessage={handleRateMessage}
            onSelectSuggestion={handleSelectSuggestion}
            onStop={handleStopGeneration}
          />
        </div>

        {/* Bottom Input Floating Bar */}
        <div className="shrink-0 w-full">
          <InputBar
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            locale={locale}
            editingMessage={editingMessage}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEditedMessage}
          />
        </div>
      </div>
    </div>
  );
};
