"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Code,
  Bot,
  Palette,
  FileText,
  BarChart3,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Paperclip,
  Mic,
  MicOff,
  Image as ImageIcon,
  Sliders,
  RotateCcw,
  Globe,
  LogOut,
  LogIn,
  ChevronDown,
  Layers,
  Zap,
  Check,
  X,
  Play,
  Clock,
  ExternalLink,
  MessageSquare,
  Compass,
  Loader2,
  Menu,
  User,
  Settings,
  Calculator,
  FolderCode,
  Plus,
  Trash2,
  Send,
  Square,
} from "lucide-react";
import { SoufToolsLogo, ModelLogo } from "@/components/ui/Logos";
import { useChatStore, SoufAIModelId } from "@/store/chatStore";
import { useCodingStore, WorkspaceItem } from "@/store/codingStore";
import { SoufBehaviorEngine } from "@/lib/behavior/behaviorEngine";
import {
  UserBehaviorProfile,
  QuickIntentItem,
  SmartLaunchSuggestion,
  GreetingInfo,
} from "@/lib/behavior/types";
import { PersonalizationDrawer } from "./PersonalizationDrawer";
import { OnboardingView } from "./OnboardingView";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { performCompleteSignOut } from "@/lib/auth/unifiedAuth";
import { auth } from "@/lib/firebase";
import { getAuthCookie, setAuthCookie, removeAuthCookie } from "@/lib/authCookies";
import { isRtlLocale, SUPPORTED_LOCALES, LOCALE_METADATA_MAP, SupportedLocale } from "@/lib/i18n";
import { useSoufI18n } from "@/components/providers/I18nProvider";
import { getWorkspaceStrings } from "@/lib/i18n/multilingualStrings";

interface LaunchWorkspaceProps {
  locale: string;
}

export const LaunchWorkspace: React.FC<LaunchWorkspaceProps> = ({ locale }) => {
  const router = useRouter();
  const { setLocale } = useSoufI18n();
  const isRtl = isRtlLocale(locale);
  const ws = getWorkspaceStrings(locale);

  const {
    userEmail,
    setUserEmail,
    setUserId,
    sessions,
    activeSessionId,
    setActiveSession,
    createNewSession,
    deleteSession,
    setCurrentModel,
    currentModel,
    setWebSearchEnabled,
    setToolActive,
    clearTools,
    addMessage,
  } = useChatStore();

  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    createWorkspace,
    deleteWorkspace,
  } = useCodingStore();

  const [profile, setProfile] = useState<UserBehaviorProfile>(SoufBehaviorEngine.getProfile());
  const [greeting, setGreeting] = useState<GreetingInfo>(
    SoufBehaviorEngine.getGreeting(locale, userEmail)
  );
  const [quickIntents, setQuickIntents] = useState<QuickIntentItem[]>(
    SoufBehaviorEngine.getPersonalizedQuickIntents(locale)
  );
  const [suggestions, setSuggestions] = useState<SmartLaunchSuggestion[]>(
    SoufBehaviorEngine.getPersonalizedSuggestions(locale, sessions)
  );

  const [promptInput, setPromptInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<
    Array<{ type: "image" | "file"; name: string; size: number; data: string; mimeType: string }>
  >([]);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const launchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCancelLaunch = () => {
    setIsLaunching(false);
    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
    }
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("souf_launch_pending_intent");
      } catch {}
    }
  };

  const [activeTiers, setActiveTiers] = useState<string[] | null>(null);

  // 1. Initial Behavior Profile & Auth Setup
  useEffect(() => {
    const init = async () => {
      // Purge legacy active tiers from browser/phone localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("souftools_active_tiers");
        } catch {}
      }

      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const fbUser = auth.currentUser;
      const storeEmail = useChatStore.getState().userEmail;
      const rawCandidate = userEmail || storeEmail || cookieData?.email || fbUser?.email || null;
      const isReal = Boolean(
        rawCandidate &&
        rawCandidate.includes("@") &&
        !rawCandidate.endsWith("@souftools.app") &&
        !rawCandidate.endsWith("@souftools.internal") &&
        !rawCandidate.startsWith("usr_guest_") &&
        !rawCandidate.startsWith("guest_user@")
      );
      const effectiveEmail = isReal ? rawCandidate : null;
      const effectiveUid = cookieData?.uid || fbUser?.uid || useChatStore.getState().userId || undefined;

      if (effectiveEmail && !userEmail) {
        setUserEmail(effectiveEmail);
      }

      await SoufBehaviorEngine.initialize(effectiveUid);
      const prof = SoufBehaviorEngine.getProfile();
      setProfile(prof);
      setGreeting(SoufBehaviorEngine.getGreeting(locale, effectiveEmail));
      setQuickIntents(SoufBehaviorEngine.getPersonalizedQuickIntents(locale));
      setSuggestions(SoufBehaviorEngine.getPersonalizedSuggestions(locale, sessions));

      // Fetch active model tiers configured in Control Panel from the server platform
      fetch("/api/admin/keys")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.activeModelTiers) && data.activeModelTiers.length > 0) {
            setActiveTiers(data.activeModelTiers);
          }
        })
        .catch(() => null);
    };

    init();

    const unsub = SoufBehaviorEngine.subscribe((updated) => {
      setProfile(updated);
      setGreeting(SoufBehaviorEngine.getGreeting(locale, userEmail));
      setQuickIntents(SoufBehaviorEngine.getPersonalizedQuickIntents(locale));
      setSuggestions(SoufBehaviorEngine.getPersonalizedSuggestions(locale, sessions));
    });

    const handleTierChange = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setActiveTiers(e.detail);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "souftools_active_tiers" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActiveTiers(parsed);
          }
        } catch {}
      }
    };

    window.addEventListener("souftools_active_tiers_changed", handleTierChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("souftools_active_tiers_changed", handleTierChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [locale, isRtl, userEmail, sessions, setUserEmail]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (menuDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuDrawerOpen]);

  // 2. Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechRecognitionSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = isRtl ? "ar-SA" : "en-US";

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setPromptInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [isRtl]);

  const toggleVoiceRecording = () => {
    if (!speechRecognitionSupported || !recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.warn("Speech recognition error:", err);
      }
    }
  };

  // 3. Handle File Uploads (Unified for images, documents, code, etc.)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isImage = file.type.startsWith("image/");
      reader.onload = (uploadEv) => {
        const base64 = uploadEv.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            type: isImage ? "image" : "file",
            name: file.name,
            size: file.size,
            data: base64,
            mimeType: file.type || "application/octet-stream",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (e.target) e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // 4. Primary Launch Dispatcher
  const handleLaunchChat = (
    customPrompt?: string,
    overrideTools?: string[],
    overrideModel?: SoufAIModelId
  ) => {
    if (isLaunching) return;
    setIsLaunching(true);

    let finalPrompt = (customPrompt !== undefined ? customPrompt : promptInput).trim();
    const finalTools = overrideTools || selectedTools;
    const finalModel = overrideModel || currentModel;

    // If user clicked launch without text or attachments, initialize an engaging smart kickoff
    if (!finalPrompt && attachments.length === 0) {
      finalPrompt = isRtl
        ? "مرحباً SoufAI! ابدأ معي جلسة ذكية جديدة واعرض أهم ما يمكنك إنجازه ومساعدتي به اليوم."
        : "Hello SoufAI! Start a smart session with me and show what we can achieve today.";
    }

    // Enforce strict authentication - unauthenticated users must login
    if (typeof window !== "undefined") {
      const cookieData = getAuthCookie();
      const rawEmail = userEmail || cookieData?.email;
      const isGuest = !rawEmail || rawEmail.startsWith("usr_guest_") || rawEmail.startsWith("guest_user@") || rawEmail === "user@ocean.ai" || rawEmail === "default_user";
      if (isGuest) {
        router.push(`/${locale}/login?redirect=chat`);
        return;
      }
    }

    // Set model
    setCurrentModel(finalModel);

    // Synchronize tools
    clearTools();
    finalTools.forEach((tool) => {
      setToolActive(tool, true);
    });

    // Log behavior event
    SoufBehaviorEngine.logEvent("launch_intent_selected", {
      promptLength: finalPrompt.length,
      tools: finalTools,
      model: finalModel,
    });

    // Create fresh session
    const sessionId = createNewSession();

    // Store pending intent in sessionStorage so Chat starts immediately
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "souf_launch_pending_intent",
          JSON.stringify({
            prompt: finalPrompt,
            attachments,
            tools: finalTools,
            model: finalModel,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.warn("Storage save error:", e);
      }
    }

    // Smooth instant navigation to chat with robust safety fallback
    const targetUrl = `/${locale}/chat`;
    router.push(targetUrl);

    // Safety fallback navigation in case router.push is delayed
    launchTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined" && !window.location.pathname.includes("/chat")) {
        window.location.href = targetUrl;
      }
    }, 350);
  };

  // 5. Quick Intent Click Handler
  const handleQuickIntentClick = (intent: QuickIntentItem) => {
    SoufBehaviorEngine.logEvent("tool_opened", { toolName: intent.key, workflowType: intent.workflowType });
    handleLaunchChat(intent.defaultPrompt, intent.activeTools, intent.modelId as SoufAIModelId);
  };

  // 6. Suggestion Click Handler
  const handleSuggestionClick = (sug: SmartLaunchSuggestion) => {
    SoufBehaviorEngine.logEvent("suggestion_clicked", { suggestionId: sug.id, category: sug.category });
    handleLaunchChat(sug.prompt, sug.activeTools, sug.modelId as SoufAIModelId);
  };

  // 7. Resume Recent Session
  const handleResumeSession = (sessionId: string) => {
    setActiveSession(sessionId);
    router.push(`/${locale}/chat`);
  };

  // 8. Sign Out
  const handleLogout = async () => {
    await performCompleteSignOut(locale);
  };

  // If user hasn't completed onboarding yet, show the tailored Onboarding questionnaire first
  if (!profile.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-[#070b0b] text-[#e8f5f5] flex flex-col justify-center items-center py-12 px-4 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#00d4aa]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-[#00ff88]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full">
          <OnboardingView
            locale={locale}
            userEmail={userEmail}
            onComplete={() => {
              const updated = SoufBehaviorEngine.getProfile();
              setProfile(updated);
              setGreeting(SoufBehaviorEngine.getGreeting(isRtl, userEmail));
              setQuickIntents(SoufBehaviorEngine.getPersonalizedQuickIntents(isRtl));
              setSuggestions(SoufBehaviorEngine.getPersonalizedSuggestions(isRtl, sessions));
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b0b] text-[#e8f5f5] flex flex-col relative overflow-x-hidden selection:bg-[#00d4aa]/30 selection:text-[#00ff88]">
      {/* Background Subtle Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-[#00d4aa]/10 via-[#00ff88]/5 to-transparent rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[450px] h-[450px] bg-[#38bdf8]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Hidden Unified File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />

      {/* Top Navbar */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-3.5 border-b border-[#141e1e] flex items-center justify-between backdrop-blur-md bg-[#070b0b]/70 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <Link href={`/${locale}/launch`} className="flex items-center gap-2.5 group">
            <SoufToolsLogo size={34} glow={true} />
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-[#e8f5f5] group-hover:text-[#00d4aa] transition-colors whitespace-nowrap">
              SoufTools
            </span>
          </Link>
        </div>

        {/* Single Unified 3-Lines (Hamburger) Menu Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMenuDrawerOpen(true)}
            className="relative w-10 h-10 rounded-xl bg-[#101818] hover:bg-[#162222] border border-[#1f2e2e] hover:border-[#00d4aa]/50 text-[#a0bcbc] hover:text-[#00d4aa] flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            title={isRtl ? "القائمة والإعدادات" : "Menu & Settings"}
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
            {userEmail && (
              <span className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 w-2 h-2 rounded-full bg-[#00d4aa] ring-2 ring-[#070b0b] animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Unified Sidebar Menu & Settings rendered via Portal to prevent any clipping/interference */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {menuDrawerOpen && (
              <>
                {/* Backdrop Dim Scrim */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMenuDrawerOpen(false)}
                  className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm"
                />

                {/* Sidebar Container */}
                <motion.div
                  initial={{ opacity: 0, x: isRtl ? "-100%" : "100%" }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? "-100%" : "100%" }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`fixed top-0 bottom-0 h-full ${
                    isRtl ? "left-0 border-r border-[#1a2828] rounded-r-3xl" : "right-0 border-l border-[#1a2828] rounded-l-3xl"
                  } z-[99999] w-[85%] sm:w-[60%] min-w-[280px] max-w-[540px] bg-[#091010] shadow-[0_0_60px_rgba(0,0,0,0.95)] p-4 sm:p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar`}
                >
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#142020]">
                  <div className="flex items-center gap-2.5">
                    <SoufToolsLogo size={26} />
                    <span className="text-xs sm:text-sm font-bold text-[#e8f5f5] tracking-wide">
                      {isRtl ? "القائمة والإعدادات" : "Menu & Settings"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuDrawerOpen(false)}
                    className="p-1.5 rounded-xl text-[#6a8585] hover:text-[#e8f5f5] hover:bg-[#142020] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 1. User Profile Card */}
                <div className="p-4 rounded-2xl bg-[#0e1616] border border-[#1b2a2a] shadow-sm">
                  {userEmail ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00d4aa]/25 to-[#00d4aa]/5 border border-[#00d4aa]/40 flex items-center justify-center text-base font-extrabold text-[#00d4aa] shrink-0 shadow-inner">
                        {userEmail[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-[#e8f5f5] truncate block">
                            {userEmail.split("@")[0]}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-[#00d4aa] shrink-0 animate-pulse" />
                        </div>
                        <p className="text-[10px] sm:text-xs text-[#6a8585] truncate mt-0.5 font-mono">
                          {userEmail}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#142020] border border-[#223333] flex items-center justify-center text-[#6a8585] shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#e8f5f5] block">
                            {isRtl ? "غير مسجل الدخول" : "Not signed in"}
                          </span>
                          <span className="text-[10px] text-[#6a8585] block truncate">
                            {isRtl ? "سجل الدخول للمتابعة" : "Sign in to continue"}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/${locale}/login`}
                        onClick={() => setMenuDrawerOpen(false)}
                        className="px-3.5 py-2 rounded-xl bg-[#00d4aa] hover:bg-[#00e6b8] text-[#0a0f0f] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{ws.login}</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 2. Language Switcher Button & Dropdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-[#8aa5a5] flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-[#00d4aa]" />
                      {isRtl ? "لغة المنصة والترجمة" : "Interface & Language"}
                    </span>
                  </div>

                  {/* Single Main Trigger Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                      className="w-full p-3 rounded-2xl bg-[#0e1616] hover:bg-[#121c1c] border border-[#1b2a2a] hover:border-[#00d4aa]/50 transition-all flex items-center justify-between gap-3 shadow-sm cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl leading-none bg-[#142020] p-1.5 rounded-xl border border-[#203030] shrink-0">
                          {LOCALE_METADATA_MAP[locale as SupportedLocale]?.flagSymbol || "🌐"}
                        </span>
                        <div className="min-w-0 text-start">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-[#e8f5f5] group-hover:text-[#00d4aa] transition-colors truncate">
                              {LOCALE_METADATA_MAP[locale as SupportedLocale]?.nativeName || locale}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20 font-bold font-mono">
                              {LOCALE_METADATA_MAP[locale as SupportedLocale]?.englishName}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#6a8585] mt-0.5">
                            {isRtl ? "اختر لغة المنصة والترجمة الفورية" : "Choose platform language"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[#4a6b6b] font-mono bg-[#142020] px-2 py-1 rounded-lg border border-[#203030]">
                          12 {isRtl ? "لغات" : "langs"}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#6a8585] group-hover:text-[#00d4aa] transition-transform duration-200 ${
                            langDropdownOpen ? "rotate-180 text-[#00d4aa]" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {/* Language Selection Dropdown Panel */}
                    <AnimatePresence>
                      {langDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="mt-2 p-2 bg-[#0b1313] rounded-2xl border border-[#1b2a2a] shadow-2xl space-y-1 max-h-64 overflow-y-auto custom-scrollbar z-10"
                        >
                          {SUPPORTED_LOCALES.map((locKey) => {
                            const meta = LOCALE_METADATA_MAP[locKey];
                            const isCurrent = locale === locKey;
                            return (
                              <button
                                key={locKey}
                                type="button"
                                onClick={() => {
                                  setLocale(locKey);
                                  setLangDropdownOpen(false);
                                  setMenuDrawerOpen(false);
                                }}
                                className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-start transition-all cursor-pointer ${
                                  isCurrent
                                    ? "bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/40 font-bold shadow-sm"
                                    : "text-[#8aa5a5] hover:text-[#e8f5f5] hover:bg-[#121c1c] border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-lg leading-none">{meta.flagSymbol}</span>
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold block truncate leading-tight">
                                      {meta.nativeName}
                                    </span>
                                    <span className="text-[10px] opacity-60 block truncate font-mono">
                                      {meta.englishName}
                                    </span>
                                  </div>
                                </div>
                                {isCurrent && (
                                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#00d4aa]/20 text-[#00d4aa] font-bold">
                                    <Check className="w-3.5 h-3.5 text-[#00d4aa]" />
                                    {isRtl ? "المُحدّدة" : "Selected"}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 3. User Projects & Workspaces */}
                <div className="space-y-2 pt-3 border-t border-[#142020]">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-[#8aa5a5] flex items-center gap-1.5">
                      <FolderCode className="w-4 h-4 text-[#00d4aa]" />
                      {isRtl ? "مشاريعك وورش العمل" : "Projects & Workspaces"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const id = createWorkspace("react", isRtl ? "مشروع جديد" : "New Project");
                        setActiveWorkspace(id);
                        setMenuDrawerOpen(false);
                        router.push(`/${locale}/chat`);
                      }}
                      className="text-[11px] font-bold text-[#00d4aa] hover:text-[#00e6b8] flex items-center gap-1 bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 px-2 py-1 rounded-lg border border-[#00d4aa]/20 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isRtl ? "مشروع جديد" : "New"}</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {workspaces && workspaces.length > 0 ? (
                      workspaces.slice(0, 8).map((wsItem: WorkspaceItem) => {
                        const isActive = activeWorkspaceId === wsItem.id;
                        return (
                          <div
                            key={wsItem.id}
                            onClick={() => {
                              setActiveWorkspace(wsItem.id);
                              setMenuDrawerOpen(false);
                              router.push(`/${locale}/chat`);
                            }}
                            className={`group w-full p-2.5 rounded-xl border flex items-center justify-between gap-2 text-start transition-all cursor-pointer ${
                              isActive
                                ? "bg-[#00d4aa]/15 border-[#00d4aa]/40 text-[#e8f5f5]"
                                : "bg-[#0d1616] hover:bg-[#121d1d] border-[#182626] hover:border-[#223838] text-[#9ab0b0]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[#142222] border border-[#203232] flex items-center justify-center shrink-0 text-[#00d4aa]">
                                <Code className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold block truncate group-hover:text-[#00d4aa] transition-colors">
                                  {wsItem.title || (isRtl ? "مشروع بدون عنوان" : "Untitled Project")}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-[#5c7a7a] font-mono mt-0.5">
                                  <span className="uppercase text-[#00d4aa]/80">{wsItem.framework || "React"}</span>
                                  <span>•</span>
                                  <span>{new Date(wsItem.updatedAt || Date.now()).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              title={isRtl ? "حذف المشروع" : "Delete Project"}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteWorkspace(wsItem.id);
                              }}
                              className="p-1.5 rounded-lg text-[#5c7a7a] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 rounded-xl bg-[#0b1313] border border-[#162323] text-center text-[11px] text-[#5c7a7a]">
                        {isRtl ? "لا توجد مشاريع سابقة، أنشئ مشروعك الأول الآن" : "No projects yet. Create your first project."}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. User Chats & History */}
                <div className="space-y-2 pt-3 border-t border-[#142020]">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-[#8aa5a5] flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#00d4aa]" />
                      {isRtl ? "محادثاتك السابقة" : "Recent Conversations"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = createNewSession();
                        setActiveSession(newId);
                        setMenuDrawerOpen(false);
                        router.push(`/${locale}/chat`);
                      }}
                      className="text-[11px] font-bold text-[#00d4aa] hover:text-[#00e6b8] flex items-center gap-1 bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 px-2 py-1 rounded-lg border border-[#00d4aa]/20 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isRtl ? "محادثة جديدة" : "New Chat"}</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar p-1">
                    {sessions && sessions.length > 0 ? (
                      sessions.slice(0, 10).map((sess) => {
                        const isActive = activeSessionId === sess.id;
                        const msgCount = sess.messages ? sess.messages.length : 0;
                        return (
                          <div
                            key={sess.id}
                            onClick={() => {
                              setActiveSession(sess.id);
                              setMenuDrawerOpen(false);
                              router.push(`/${locale}/chat`);
                            }}
                            className={`group w-full p-2.5 rounded-xl border flex items-center justify-between gap-2 text-start transition-all cursor-pointer ${
                              isActive
                                ? "bg-[#00d4aa]/15 border-[#00d4aa]/40 text-[#e8f5f5]"
                                : "bg-[#0d1616] hover:bg-[#121d1d] border-[#182626] hover:border-[#223838] text-[#9ab0b0]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[#142222] border border-[#203232] flex items-center justify-center shrink-0 text-[#00d4aa]">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold block truncate group-hover:text-[#00d4aa] transition-colors">
                                  {sess.title || (isRtl ? "محادثة جديدة" : "New Conversation")}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-[#5c7a7a] font-mono mt-0.5">
                                  <span>{msgCount} {isRtl ? "رسائل" : "msgs"}</span>
                                  <span>•</span>
                                  <span>{new Date(sess.updatedAt || Date.now()).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              title={isRtl ? "حذف المحادثة" : "Delete Chat"}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(sess.id);
                              }}
                              className="p-1.5 rounded-lg text-[#5c7a7a] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 rounded-xl bg-[#0b1313] border border-[#162323] text-center text-[11px] text-[#5c7a7a]">
                        {isRtl ? "لا توجد محادثات سابقة حتى الآن" : "No recent conversations."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer with Logout / Session */}
              <div className="pt-4 mt-4 border-t border-[#142020]">
                {userEmail ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuDrawerOpen(false);
                      handleLogout();
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{ws.logout}</span>
                  </button>
                ) : (
                  <p className="text-[11px] text-center text-[#4a6b6b] font-medium">
                    SoufTools AI Workspace
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Main Content Workspace */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* Dynamic Context-Aware Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-center space-y-2.5 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/25 text-[11px] font-semibold text-[#00d4aa]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{ws.smartWorkspaceReady}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#e8f5f5] tracking-tight leading-snug">
            {greeting.title}
          </h1>

          <p className="text-xs sm:text-sm text-[#7a9595] leading-relaxed">
            {greeting.subtitle}
          </p>
        </motion.div>

        {/* Central Unified AI Command Prompt Dock */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="relative bg-[#0d1414]/90 backdrop-blur-xl border border-[#1e2e2e] focus-within:border-[#00d4aa] rounded-3xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(0,0,0,0.5)] transition-all focus-within:shadow-[0_0_35px_rgba(0,212,170,0.2)]"
        >
          {/* Attachments Preview Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-[#1a2626]">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#142020] border border-[#223333] text-xs text-[#e8f5f5]"
                >
                  {att.type === "image" ? (
                    <ImageIcon className="w-3.5 h-3.5 text-[#00d4aa]" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className="truncate max-w-[150px]">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="text-[#6a8585] hover:text-red-400 transition-colors ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Prompt Textarea */}
          <textarea
            ref={textareaRef}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleLaunchChat();
              }
            }}
            rows={3}
            placeholder={ws.promptPlaceholder}
            className="w-full bg-transparent border-0 resize-none text-sm sm:text-base text-[#e8f5f5] placeholder-[#4a6565] focus:outline-none leading-relaxed"
          />

          {/* Dock Bottom Bar (Controls & Execution) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#182424]">
            {/* Left Tools & Inputs */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Command Center Plus Menu */}
              <div className="relative">
                <button
                  onClick={() => setCommandMenuOpen(!commandMenuOpen)}
                  title={ws.addTools}
                  className="w-9 h-9 rounded-xl bg-[#142020] hover:bg-[#1c2c2c] border border-[#223333] flex items-center justify-center text-[#8aa5a5] hover:text-[#00d4aa] transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <AnimatePresence>
                  {commandMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-12 start-0 z-30 w-56 p-2 rounded-2xl bg-[#0f1717] border border-[#243636] shadow-2xl space-y-1 text-xs"
                    >
                      {/* Single Unified File Upload Button */}
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setCommandMenuOpen(false);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-[#e8f5f5] hover:bg-[#172424] hover:text-[#00d4aa] transition-colors text-start font-medium"
                      >
                        <Paperclip className="w-4 h-4 text-[#00d4aa]" />
                        <span>{ws.attachFile}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTools((prev) =>
                            prev.includes("web_search")
                              ? prev.filter((t) => t !== "web_search")
                              : [...prev, "web_search"]
                          );
                          setCommandMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-[#e8f5f5] hover:bg-[#172424] transition-colors text-start"
                      >
                        <span className="flex items-center gap-2.5">
                          <Search className="w-4 h-4 text-[#00ff88]" />
                          <span>{ws.toggleWebSearch}</span>
                        </span>
                        {selectedTools.includes("web_search") && (
                          <Check className="w-3.5 h-3.5 text-[#00ff88]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTools((prev) =>
                            prev.includes("agent_mode")
                              ? prev.filter((t) => t !== "agent_mode")
                              : [...prev, "agent_mode"]
                          );
                          setCommandMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-[#e8f5f5] hover:bg-[#172424] transition-colors text-start"
                      >
                        <span className="flex items-center gap-2.5">
                          <Bot className="w-4 h-4 text-[#38bdf8]" />
                          <span>{ws.toggleAgentMode}</span>
                        </span>
                        {selectedTools.includes("agent_mode") && (
                          <Check className="w-3.5 h-3.5 text-[#38bdf8]" />
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Voice Recording Button */}
              {speechRecognitionSupported && (
                <button
                  onClick={toggleVoiceRecording}
                  title={isRecording ? ws.stopVoice : ws.voiceInput}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                    isRecording
                      ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                      : "bg-[#142020] hover:bg-[#1c2c2c] border-[#223333] text-[#8aa5a5] hover:text-[#00d4aa]"
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              {/* Active Tools Badges */}
              {selectedTools.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  {selectedTools.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-lg bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] text-[10px] font-mono flex items-center gap-1"
                    >
                      <span>{t}</span>
                      <button
                        onClick={() => setSelectedTools((prev) => prev.filter((x) => x !== t))}
                        className="hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right Dispatch & Model Selector */}
            <div className="flex items-center gap-2.5">
              {/* Compact Dynamic Model Selector */}
              <ModelSelector locale={locale} dropUp={true} />

              {/* Execution / Launch / Stop / Send Button */}
              {isLaunching ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleCancelLaunch}
                  className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-500/30 transition-all cursor-pointer shadow-lg shadow-red-500/15 shrink-0"
                  title={isRtl ? "إيقاف الإطلاق" : "Stop launch"}
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{isRtl ? "إيقاف" : "Stop"}</span>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  disabled={!promptInput.trim() && attachments.length === 0}
                  whileHover={{ scale: (promptInput.trim() || attachments.length > 0) ? 1.05 : 1 }}
                  whileTap={{ scale: (promptInput.trim() || attachments.length > 0) ? 0.95 : 1 }}
                  onClick={() => handleLaunchChat()}
                  title={isRtl ? "إرسال" : "Send"}
                  className={`p-2.5 rounded-xl font-bold flex items-center justify-center transition-all shrink-0 ${
                    promptInput.trim() || attachments.length > 0
                      ? "bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] shadow-[0_0_20px_rgba(0,212,170,0.4)] hover:shadow-[0_0_30px_rgba(0,212,170,0.65)] cursor-pointer"
                      : "bg-[#1e2e2e] text-[#4a7070] cursor-not-allowed opacity-50"
                  }`}
                >
                  <Send className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Personalization & Privacy Drawer Modal */}
      <PersonalizationDrawer
        isOpen={isPersonalizationOpen}
        onClose={() => setIsPersonalizationOpen(false)}
        locale={locale}
        onResetOnboarding={() => {
          const updated = SoufBehaviorEngine.getProfile();
          setProfile(updated);
        }}
      />
    </div>
  );
};
