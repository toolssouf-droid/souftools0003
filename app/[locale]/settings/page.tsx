"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  Sliders,
  Cpu,
  Brain,
  KeyRound,
  Workflow,
  Palette,
  Database,
  ArrowRight,
  ArrowLeft,
  Shield,
  Sparkles,
  Bot,
  User,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Layers,
  Plus,
  Compass,
  CheckCircle2,
  Terminal,
  Activity,
  HardDrive,
  Cloud,
  RefreshCw,
  Download,
  ShieldCheck,
  MessageSquare,
  Volume2,
  Zap,
  Globe,
  Lock,
  Trash2,
  Server,
  Code2,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  FolderGit2,
  BookOpen,
  Send,
  Power
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useChatStore, SoufAIModelId } from "@/store/chatStore";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { cloudSyncService, SyncStateInfo } from "@/lib/sync/cloudSyncService";
import { SoufAIIcon } from "@/components/icons/SoufIcons";
import { SoufBotIcon, SoufBrainIcon } from "@/components/ui/BrandIcons";

interface ServerTelemetry {
  database: {
    engine: string;
    status: string;
    latencyMs: number;
  };
  storage: {
    engine: string;
    status: string;
  };
  workerQueue: {
    status: string;
  };
}

export default function SettingsControlPanelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const router = useRouter();
  const isRtl = isRtlLocale(locale);
  const { user, signOut } = useAuth();
  const {
    userEmail,
    userId,
    isAdmin,
    defaultModelId,
    setDefaultModel,
    webSearchEnabled,
    setWebSearchEnabled,
    sessions,
    createNewSession,
    clearAllSessions,
  } = useChatStore();

  type TabKey =
    | "live_chat"
    | "memory"
    | "ai_core"
    | "security"
    | "interface"
    | "cloud_sync";

  const [activeTab, setActiveTab] = useState<TabKey>("live_chat");
  const [syncState, setSyncState] = useState<SyncStateInfo>(cloudSyncService.getState());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Real Server State
  const [telemetry, setTelemetry] = useState<ServerTelemetry | null>(null);
  const [serverMemories, setServerMemories] = useState<any[]>([]);
  const [memoryStats, setMemoryStats] = useState<any>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [memorySettings, setMemorySettings] = useState({
    memoryEnabled: true,
    autoSuggest: true,
    autoExtract: true,
  });

  // User Profile & Preferences from Server
  const [serverPreferences, setServerPreferences] = useState<any>({
    soundEnabled: true,
    autoScroll: true,
    defaultModelId: defaultModelId || "spark",
    theme: "dark",
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // New Memory Modal inside Tab
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryType, setNewMemoryType] = useState("project");
  const [newMemoryProject, setNewMemoryProject] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);

  const loadServerMemories = React.useCallback(async () => {
    setLoadingMemory(true);
    try {
      const effectiveId = userId || userEmail || "default_user";
      const [memRes, statsRes] = await Promise.all([
        fetch(`/api/v1/memory?userId=${encodeURIComponent(effectiveId)}`),
        fetch(`/api/v1/memory/stats`),
      ]);

      if (memRes.ok) {
        const memData = await memRes.json();
        setServerMemories(memData.memories || []);
        if (memData.settings) {
          setMemorySettings(memData.settings);
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setMemoryStats(statsData.stats);
      }
    } catch (err) {
      console.error("Failed to load server memories:", err);
    } finally {
      setLoadingMemory(false);
    }
  }, [userId, userEmail]);

  // Load server telemetry & preferences on mount
  useEffect(() => {
    const unsub = cloudSyncService.subscribe((s) => setSyncState(s));

    // 1. Fetch real health/telemetry from server
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((data) => setTelemetry(data))
      .catch(() => {});

    // 2. Fetch real preferences from server
    fetch("/api/v1/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data?.preferences) {
          setServerPreferences(data.preferences);
          if (data.preferences.defaultModelId) {
            setDefaultModel(data.preferences.defaultModelId);
          }
        }
      })
      .catch(() => {});

    // 3. Fetch real memory data & stats from server
    loadServerMemories();

    return () => unsub();
  }, [loadServerMemories, setDefaultModel]);

  const handleUpdatePreferences = async (updates: Partial<typeof serverPreferences>) => {
    const newPrefs = { ...serverPreferences, ...updates };
    setServerPreferences(newPrefs);
    setSavingPrefs(true);
    try {
      const response = await fetch("/api/v1/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error(`Preferences save failed (${response.status})`);
      }
      if (updates.defaultModelId !== undefined) {
        const syncResponse = await fetch("/api/user/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { currentModel: updates.defaultModelId } }),
        });
        if (!syncResponse.ok) {
          throw new Error(`Model preference sync failed (${syncResponse.status})`);
        }
      }
      setSyncFeedback(isRtl ? "تم حفظ وتحديث تفضيلاتك على السيرفر مباشرة" : "Preferences saved to server directly");
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err) {
      console.error("Preferences save error:", err);
      setSyncFeedback(isRtl ? "تعذر حفظ التفضيلات على السيرفر" : "Failed to save preferences to the server");
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    setSavingMemory(true);
    const effectiveId = userId || userEmail || "default_user";
    try {
      const res = await fetch("/api/v1/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: effectiveId,
          memory: {
            type: newMemoryType,
            content: newMemoryText.trim(),
            projectName: newMemoryProject.trim() || undefined,
            importance: 0.9,
            confidence: 1.0,
            source: "user",
            enabled: true,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.memory) {
          setServerMemories((prev) => [data.memory, ...prev]);
        }
        setNewMemoryText("");
        setNewMemoryProject("");
        setSyncFeedback(isRtl ? "تمت إضافة المعلومة وحفظها في الذاكرة السحابية" : "Memory saved to cloud");
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Failed to add memory:", err);
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    const effectiveId = userId || userEmail || "default_user";
    setServerMemories((prev) => prev.filter((m) => m.id !== memoryId));
    try {
      await fetch(`/api/v1/memory?userId=${encodeURIComponent(effectiveId)}&memoryId=${encodeURIComponent(memoryId)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  const handleToggleMemoryStatus = async (mem: any) => {
    const effectiveId = userId || userEmail || "default_user";
    const newEnabled = !mem.enabled;
    setServerMemories((prev) =>
      prev.map((m) => (m.id === mem.id ? { ...m, enabled: newEnabled } : m))
    );
    try {
      await fetch("/api/v1/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: effectiveId,
          memoryId: mem.id,
          updates: { enabled: newEnabled },
        }),
      });
    } catch (err) {
      console.error("Failed to update memory status:", err);
    }
  };

  const handleTriggerCloudSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    const success = await cloudSyncService.executeCloudSync();
    setIsSyncing(false);
    if (success) {
      setSyncFeedback(isRtl ? "تمت المزامنة بنجاح وحفظ كافة البيانات على السيرفر!" : "Successfully synced to cloud server!");
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleExportJSON = () => {
    const store = useChatStore.getState();
    const exportData = {
      userEmail,
      userId,
      exportedAt: new Date().toISOString(),
      sessions: store.sessions || [],
      memories: serverMemories,
      preferences: serverPreferences,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `souftools_cloud_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navigationTabs = [
    {
      id: "live_chat" as TabKey,
      icon: MessageSquare,
      titleAr: "الدردشة الحية والمحركات",
      titleEn: "Live Chat & Engines",
      badgeAr: "مباشر",
      badgeEn: "Live",
      descAr: "التحكم في نموذج الدردشة الافتراضي وتفضيلات الصوت والرد",
    },
    {
      id: "memory" as TabKey,
      icon: Brain,
      titleAr: "الذاكرة الذكية (SoufAI Memory)",
      titleEn: "SoufAI Memory",
      badgeAr: `${serverMemories.length}`,
      badgeEn: `${serverMemories.length}`,
      descAr: "إدارة الحقائق والسياقات والمشاريع المحفوظة سحابياً",
    },
    {
      id: "ai_core" as TabKey,
      icon: Cpu,
      titleAr: "قدرات ومواصفات السيرفر",
      titleEn: "Server Telemetry & AI Core",
      badgeAr: "سيرفر",
      badgeEn: "Server",
      descAr: "فحص حالة قاعدة البيانات، المحركات، والسرعة اللحظية",
    },
    {
      id: "security" as TabKey,
      icon: KeyRound,
      titleAr: "الأمان والخزنة (BYOK)",
      titleEn: "Security & Keys Vault",
      badgeAr: "حماية",
      badgeEn: "Vault",
      descAr: "حماية المفاتيح والتشفير وربط خوادم الذكاء الاصطناعي",
    },
    {
      id: "interface" as TabKey,
      icon: Palette,
      titleAr: "تفضيلات الواجهة والتجربة",
      titleEn: "Appearance & Experience",
      badgeAr: "تخصيص",
      badgeEn: "Custom",
      descAr: "تخصيص سرعة التمرير والأصوات التفاعلية",
    },
    {
      id: "cloud_sync" as TabKey,
      icon: Database,
      titleAr: "المزامنة والنسخ الاحتياطي",
      titleEn: "Cloud Sync & Backup",
      badgeAr: "حفظ",
      badgeEn: "Sync",
      descAr: "حفظ ومزامنة كافة السجلات بأمان على السيرفر",
    },
  ];

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-[#040707] text-[#e8f5f5] flex flex-col selection:bg-[#00d4aa]/30 selection:text-[#00d4aa]"
    >
      {/* Top Header Navigation */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "لوحة الإعدادات والتحكم" : "Control & Settings Hub"}
        subtitle={isRtl ? "إدارة النماذج والذاكرة وقواعد البيانات والمزامنة" : "Engines, persistent memory, database & cloud sync"}
        icon={<Settings className="w-4 h-4 text-[#00d4aa]" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="settings"
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher locale={locale} align="end" />

            <div className="hidden md:flex items-center gap-2 pl-2 rtl:pr-2 border-s rtl:border-r border-[#162323]">
              <div className="w-7 h-7 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/40 flex items-center justify-center text-xs font-bold text-[#00d4aa]">
                {userEmail ? userEmail[0].toUpperCase() : "S"}
              </div>
              <div className="flex flex-col text-start">
                <span className="text-[11px] font-semibold text-white leading-tight truncate max-w-[120px]">
                  {userEmail || (isRtl ? "مستخدم المنصة" : "SoufTools User")}
                </span>
                <span className="text-[9px] text-[#00d4aa] font-mono">
                  {isAdmin ? "Admin" : "Member"}
                </span>
              </div>
            </div>
          </div>
        }
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* Dynamic Breadcrumb & Server Banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#132222] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#527373] mb-1">
              <Link href={`/${locale}`} className="hover:text-[#00d4aa] transition-colors">
                {isRtl ? "الرئيسية" : "Home"}
              </Link>
              <span>/</span>
              <span className="text-[#88b0b0]">{isRtl ? "الإعدادات والتحكم" : "Settings & Control"}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>{isRtl ? "مركز التحكم المركزي بالمنظومة" : "Central Intelligence Control"}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs bg-[#070d0d] px-3.5 py-1.5 rounded-xl border border-[#132222]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="text-[#88b0b0] font-mono text-[11px]">
              {telemetry ? `${telemetry.database.engine} (${telemetry.database.latencyMs}ms)` : "Server Connected"}
            </span>
          </div>
        </div>

        {/* Global Action Feedback Alert */}
        {syncFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3.5 rounded-2xl bg-[#00d4aa]/10 border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-semibold flex items-center justify-between shadow-lg shadow-[#00d4aa]/5"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00d4aa]" />
              <span>{syncFeedback}</span>
            </div>
            <button onClick={() => setSyncFeedback(null)} className="text-[#88b0b0] hover:text-white text-xs">
              ✕
            </button>
          </motion.div>
        )}

        {/* Responsive Grid: Navigation + Dynamic Tab Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
          {/* Sidebar Tabs */}
          <aside className="lg:col-span-4 xl:col-span-3 w-full">
            {/* Mobile Tab Scroll */}
            <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {navigationTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all border shrink-0 ${
                      isActive
                        ? "bg-[#00d4aa]/15 border-[#00d4aa]/50 text-[#00d4aa] shadow-sm shadow-[#00d4aa]/10"
                        : "bg-[#070d0d] border-[#132222] text-[#88b0b0] hover:text-white hover:bg-[#0c1515]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{isRtl ? tab.titleAr : tab.titleEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop Vertical Menu */}
            <div className="hidden lg:flex flex-col gap-1.5 p-2 rounded-2xl bg-[#070d0d] border border-[#132222] shadow-xl">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#4a7070]">
                {isRtl ? "الوحدات والخيارات" : "Control Modules"}
              </div>

              {navigationTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all text-start border cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-[#00d4aa]/15 to-[#0ea5e9]/10 border-[#00d4aa]/40 text-white shadow-md shadow-black/20"
                        : "bg-transparent border-transparent text-[#88b0b0] hover:text-white hover:bg-[#0d1717] hover:border-[#162727]"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                          isActive
                            ? "bg-[#00d4aa] text-[#040707] shadow-sm"
                            : "bg-[#0d1717] text-[#88b0b0] group-hover:text-white"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="truncate">{isRtl ? tab.titleAr : tab.titleEn}</span>
                        <span className="text-[10px] text-[#4a7070] font-normal truncate">
                          {isRtl ? tab.descAr : ""}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono shrink-0 ${
                        isActive
                          ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/30"
                          : "bg-[#0d1717] text-[#4a7070]"
                      }`}
                    >
                      {isRtl ? tab.badgeAr : tab.badgeEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Tab Canvas */}
          <section className="lg:col-span-8 xl:col-span-9 w-full flex flex-col gap-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full space-y-6"
              >
                {/* 1. Live Chat Module */}
                {activeTab === "live_chat" && (
                  <div className="space-y-6">
                    {/* Header Card */}
                    <div className="p-6 rounded-2xl bg-[#070d0d] border border-[#132222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 text-base font-bold text-white">
                          <MessageSquare className="w-5 h-5 text-[#00d4aa]" />
                          <span>{isRtl ? "إعدادات الدردشة الحية وتفضيلات النموذج" : "Live Chat & Engine Settings"}</span>
                        </div>
                        <p className="text-xs text-[#6e9999]">
                          {isRtl
                            ? "تخصيص سلوك محادثة الذكاء الاصطناعي، النموذج الافتراضي المعتمد، وميزات البحث والتفاعل الصوتي."
                            : "Configure default AI conversation engine, web search grounding, and vocal synthesis."}
                        </p>
                      </div>

                      <Link
                        href={`/${locale}/chat`}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00f5c4] text-[#040707] font-bold text-xs flex items-center gap-2 hover:opacity-95 transition-all shadow-md shadow-[#00d4aa]/15"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isRtl ? "فتح شاشة الدردشة الآن" : "Launch Live Chat"}</span>
                      </Link>
                    </div>

                    {/* Model Quick Selector */}
                    <div className="p-6 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          {isRtl ? "النموذج الافتراضي للمحادثات" : "Default Chat Model"}
                        </span>
                        <Link
                          href={`/${locale}/models`}
                          className="text-xs text-[#00d4aa] hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>{isRtl ? "استكشاف جميع النماذج" : "Explore All Models"}</span>
                          {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { id: "spark", name: "SoufAI Spark 3.5", desc: "فائق السرعة وخفيف للمهام اللحظية", speed: "94 tok/s" },
                          { id: "core", name: "SoufAI Core 3.5", desc: "المحرك المرجعي المتوازن للأعمال العامة", speed: "78 tok/s" },
                          { id: "pro", name: "SoufAI Pro 3.7", desc: "تفكير هجين وتحليل عميق معقد", speed: "52 tok/s" },
                          { id: "coder", name: "SoufAI Coder 3.7", desc: "متخصص في هندسة البرمجيات والتطوير", speed: "65 tok/s" },
                          { id: "ultra", name: "SoufAI Ultra 3.7", desc: "أعلى دقة للمشاريع الصعبة والاستنتاج الفائق", speed: "40 tok/s" },
                        ].map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setDefaultModel(m.id as SoufAIModelId);
                              handleUpdatePreferences({ defaultModelId: m.id });
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                              defaultModelId === m.id
                                ? "bg-[#00d4aa]/10 border-[#00d4aa] text-white shadow-md shadow-[#00d4aa]/10"
                                : "bg-[#0a1111] border-[#132222] text-[#88b0b0] hover:border-[#1a2e2e] hover:text-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">{m.name}</span>
                              {defaultModelId === m.id && (
                                <CheckCircle2 className="w-4 h-4 text-[#00d4aa]" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#527373] leading-relaxed">{m.desc}</p>
                            <span className="text-[10px] font-mono text-[#00d4aa]">{m.speed}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chat Behavior Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-white">
                            <Globe className="w-4 h-4 text-[#0ea5e9]" />
                            <span>{isRtl ? "البحث الحي في الويب (Web Search)" : "Web Search Grounding"}</span>
                          </div>
                          <p className="text-[11px] text-[#527373]">
                            {isRtl ? "تمكين استرجاع المعلومات اللحظية والأخبار والمصادر" : "Allow AI to search live web data"}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const next = !webSearchEnabled;
                            setWebSearchEnabled(next);
                            handleUpdatePreferences({ webSearchEnabled: next });
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                            webSearchEnabled ? "bg-[#00d4aa]" : "bg-[#162424]"
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                              webSearchEnabled ? (isRtl ? "left-1" : "right-1") : isRtl ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-white">
                            <Volume2 className="w-4 h-4 text-[#a855f7]" />
                            <span>{isRtl ? "القراءة الصوتية التلقائية (TTS)" : "Auto Text-to-Speech"}</span>
                          </div>
                          <p className="text-[11px] text-[#527373]">
                            {isRtl ? "قراءة الردود صوتياً فور اكتمال التوليد" : "Play vocal playback on response complete"}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const next = !serverPreferences.soundEnabled;
                            handleUpdatePreferences({ soundEnabled: next });
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                            serverPreferences.soundEnabled ? "bg-[#a855f7]" : "bg-[#162424]"
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                              serverPreferences.soundEnabled ? (isRtl ? "left-1" : "right-1") : isRtl ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. SoufAI Memory Module */}
                {activeTab === "memory" && (
                  <div className="space-y-6">
                    {/* Header Card */}
                    <div className="p-6 rounded-2xl bg-[#070d0d] border border-[#132222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 text-base font-bold text-white">
                          <Brain className="w-5 h-5 text-[#a855f7]" />
                          <span>{isRtl ? "ذاكرة SoufAI الذكية والسياق الممتد" : "SoufAI Smart Memory Engine"}</span>
                        </div>
                        <p className="text-xs text-[#6e9999]">
                          {isRtl
                            ? "يسترجع الذكاء الاصطناعي تفضيلاتك وسياق مشاريعك المحفوظة على السيرفر تلقائياً لتقديم إجابات مخصصة."
                            : "AI retrieves your saved facts, preferences, and project guidelines automatically for contextual accuracy."}
                        </p>
                      </div>

                      <button
                        onClick={loadServerMemories}
                        disabled={loadingMemory}
                        className="px-3.5 py-2 rounded-xl bg-[#0f1818] hover:bg-[#162525] border border-[#1c2e2e] text-[#88b0b0] hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingMemory ? "animate-spin text-[#00d4aa]" : ""}`} />
                        <span>{isRtl ? "تحديث السجلات" : "Refresh"}</span>
                      </button>
                    </div>

                    {/* Add Memory Input Form */}
                    <form
                      onSubmit={handleAddMemory}
                      className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-4"
                    >
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#a855f7]" />
                        <span>{isRtl ? "إضافة معلومة جديدة إلى الذاكرة السحابية" : "Add Memory Item to Server"}</span>
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#527373] mb-1">
                            {isRtl ? "نوع السياق" : "Context Category"}
                          </label>
                          <select
                            value={newMemoryType}
                            onChange={(e) => setNewMemoryType(e.target.value)}
                            className="w-full bg-[#0a1111] border border-[#132222] rounded-xl p-2 text-xs text-[#e8f5f5] outline-none focus:border-[#a855f7]"
                          >
                            <option value="project">{isRtl ? "مشروع وتقنية (Project)" : "Project"}</option>
                            <option value="preference">{isRtl ? "تفضيل شخصي (Preference)" : "Preference"}</option>
                            <option value="user">{isRtl ? "بيانات المستخدم (User Info)" : "User Info"}</option>
                            <option value="knowledge">{isRtl ? "قاعدة معرفة (Knowledge)" : "Knowledge"}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#527373] mb-1">
                            {isRtl ? "اسم المشروع (اختياري)" : "Project Tag (Optional)"}
                          </label>
                          <input
                            type="text"
                            value={newMemoryProject}
                            onChange={(e) => setNewMemoryProject(e.target.value)}
                            placeholder={isRtl ? "مثال: SoufTools, AI Assistant" : "e.g. SoufTools, Mobile App"}
                            className="w-full bg-[#0a1111] border border-[#132222] rounded-xl p-2 text-xs text-[#e8f5f5] outline-none focus:border-[#a855f7]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#527373] mb-1">
                          {isRtl ? "المحتوى أو القاعدة المطلوب تذكرها" : "Memory Content"}
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={newMemoryText}
                          onChange={(e) => setNewMemoryText(e.target.value)}
                          placeholder={
                            isRtl
                              ? "مثال: المستخدم يفضل بناء الأنظمة عبر Next.js وتمرير كافة مفاتيح API عبر مسارات الخادم server-side."
                              : "e.g. User prefers complete production-ready code with full types."
                          }
                          className="w-full bg-[#0a1111] border border-[#132222] rounded-xl p-2.5 text-xs text-[#e8f5f5] outline-none focus:border-[#a855f7] resize-none"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingMemory || !newMemoryText.trim()}
                          className="px-4 py-2 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] text-white font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{savingMemory ? (isRtl ? "جاري الحفظ..." : "Saving...") : isRtl ? "حفظ بالذاكرة" : "Save Memory"}</span>
                        </button>
                      </div>
                    </form>

                    {/* Saved Memories List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          {isRtl ? `العناصر المحفوظة سحابياً (${serverMemories.length})` : `Saved Memories (${serverMemories.length})`}
                        </span>
                      </div>

                      {loadingMemory ? (
                        <div className="p-8 text-center text-xs text-[#527373]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#a855f7]" />
                          <span>{isRtl ? "جاري تحميل البيانات من السيرفر..." : "Loading memory from server..."}</span>
                        </div>
                      ) : serverMemories.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-[#070d0d] border border-[#132222] text-center space-y-2">
                          <Brain className="w-8 h-8 text-[#1a2b2b] mx-auto" />
                          <p className="text-xs font-semibold text-[#88b0b0]">
                            {isRtl ? "لا توجد ذكريات مسجلة بعد" : "No saved memories yet"}
                          </p>
                          <p className="text-[11px] text-[#527373]">
                            {isRtl ? "أضف أول معلومة بالأعلى لتخصيص إجابات النماذج" : "Add memory above to personalize responses"}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {serverMemories.map((mem) => (
                            <div
                              key={mem.id}
                              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                                mem.enabled
                                  ? "bg-[#070d0d] border-[#132222] hover:border-[#a855f7]/40"
                                  : "bg-[#050808] border-[#0f1717] opacity-60"
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]/30">
                                    {mem.type || "Context"}
                                  </span>
                                  {mem.projectName && (
                                    <span className="text-[10px] font-mono text-[#527373] bg-[#0a1111] px-2 py-0.5 rounded-md border border-[#132222]">
                                      {mem.projectName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#e8f5f5] leading-relaxed">
                                  &ldquo;{mem.content}&rdquo;
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-[#132222] text-[10px] text-[#527373]">
                                <span>{new Date(mem.updatedAt || Date.now()).toLocaleDateString(isRtl ? "ar-EG" : "en-US")}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleMemoryStatus(mem)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                      mem.enabled ? "bg-[#10b981]/20 text-[#10b981]" : "bg-[#162424] text-[#527373]"
                                    }`}
                                  >
                                    {mem.enabled ? (isRtl ? "مُفعّل" : "Active") : isRtl ? "معطّل" : "Disabled"}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMemory(mem.id)}
                                    className="p-1 rounded text-[#527373] hover:text-red-400 hover:bg-red-950/20"
                                    title={isRtl ? "حذف" : "Delete"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. AI Core & Server Telemetry */}
                {activeTab === "ai_core" && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-1">
                      <div className="flex items-center gap-2.5 text-base font-bold text-white">
                        <Server className="w-5 h-5 text-[#00d4aa]" />
                        <span>{isRtl ? "مراقبة البنية التحتية والسيرفر الحقيقي" : "Real Server Infrastructure Telemetry"}</span>
                      </div>
                      <p className="text-xs text-[#6e9999]">
                        {isRtl
                          ? "بيانات حية مباشرة من محرك الخادم، قاعدة البيانات، وسعة التخزين الخاصة."
                          : "Live telemetry from private server backend, database engine, and storage layer."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-2">
                        <span className="text-[11px] text-[#527373] font-semibold">{isRtl ? "محرك قاعدة البيانات" : "Database Engine"}</span>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <Database className="w-4 h-4 text-[#00d4aa]" />
                          <span>PostgreSQL (Drizzle)</span>
                        </div>
                        <div className="text-[11px] font-mono text-[#00d4aa] flex items-center gap-1.5 pt-1">
                          <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-ping" />
                          <span>{telemetry?.database?.status || "Healthy"} • {telemetry?.database?.latencyMs || 5}ms</span>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-2">
                        <span className="text-[11px] text-[#527373] font-semibold">{isRtl ? "خزنة التخزين السحابية" : "Object Storage"}</span>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-[#0ea5e9]" />
                          <span>Private Cloud Vault</span>
                        </div>
                        <div className="text-[11px] font-mono text-[#0ea5e9] pt-1">
                          Operational • Real-time
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-2">
                        <span className="text-[11px] text-[#527373] font-semibold">{isRtl ? "طابور المهام البرمجية" : "Worker Queue"}</span>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <Workflow className="w-4 h-4 text-[#a855f7]" />
                          <span>Async Task Processor</span>
                        </div>
                        <div className="text-[11px] font-mono text-[#a855f7] pt-1">
                          Active • Ready
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Security & BYOK */}
                {activeTab === "security" && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-1">
                      <div className="flex items-center gap-2.5 text-base font-bold text-white">
                        <KeyRound className="w-5 h-5 text-[#00d4aa]" />
                        <span>{isRtl ? "خزنة الأمان والمفاتيح (BYOK & Keys Vault)" : "Security & Key Vault"}</span>
                      </div>
                      <p className="text-xs text-[#6e9999]">
                        {isRtl
                          ? "جميع المفاتيح الحساسة والاستدعاءات تمر حصراً عبر خادم المنصة الآمن دون كشف أي مفاتيح في المتصفح."
                          : "All secrets and AI calls are strictly mediated server-side with zero browser exposure."}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-4">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-white">
                        <ShieldCheck className="w-4 h-4 text-[#00d4aa]" />
                        <span>{isRtl ? "حماية وتشفير الجلسات" : "Session & Key Isolation"}</span>
                      </div>
                      <p className="text-xs text-[#527373] leading-relaxed">
                        {isRtl
                          ? "النظام مفعل بأعلى معايير الحماية (AES-256) مع التحقق من صلاحيات المستخدم والمزامنة عبر معرف الجهاز الآمن."
                          : "Encrypted under standard architecture guidelines with server-only key resolution."}
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. Interface Preferences */}
                {activeTab === "interface" && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-[#070d0d] border border-[#132222] space-y-1">
                      <div className="flex items-center gap-2.5 text-base font-bold text-white">
                        <Palette className="w-5 h-5 text-[#00d4aa]" />
                        <span>{isRtl ? "تفضيلات الواجهة والتفاعل" : "UI Preferences"}</span>
                      </div>
                      <p className="text-xs text-[#6e9999]">
                        {isRtl
                          ? "التحكم في التمرير التلقائي، مؤثرات النقر، ونظام الألوان المعتمد."
                          : "Control auto-scrolling, sound feedback, and visual comfort settings."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-white">{isRtl ? "التمرير التلقائي أثناء الكتابة" : "Auto Scroll"}</span>
                          <p className="text-[11px] text-[#527373]">
                            {isRtl ? "تمرير شاشة الدردشة للأسفل مع وصول الردود" : "Keep chat scrolled to bottom"}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const next = !serverPreferences.autoScroll;
                            handleUpdatePreferences({ autoScroll: next });
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                            serverPreferences.autoScroll ? "bg-[#00d4aa]" : "bg-[#162424]"
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                              serverPreferences.autoScroll ? (isRtl ? "left-1" : "right-1") : isRtl ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Cloud Sync & Backup */}
                {activeTab === "cloud_sync" && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-[#070d0d] border border-[#132222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 text-base font-bold text-white">
                          <Cloud className="w-5 h-5 text-[#00d4aa]" />
                          <span>{isRtl ? "المزامنة السحابية وحفظ بيانات الحساب" : "Cloud Sync & Storage"}</span>
                        </div>
                        <p className="text-xs text-[#6e9999]">
                          {isRtl
                            ? "مزامنة كافة المحادثات والذكريات والإعدادات تلقائياً على السيرفر."
                            : "Auto-sync chats, preferences, and memories safely to backend."}
                        </p>
                      </div>

                      <button
                        onClick={handleTriggerCloudSync}
                        disabled={isSyncing}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#040707] font-bold text-xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                        <span>{isRtl ? "مزامنة سحابية الآن" : "Sync Now"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-[#070d0d] border border-[#132222] flex flex-col justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-white">{isRtl ? "تصدير نسخة احتياطية (JSON)" : "Export Archive"}</span>
                          <p className="text-[11px] text-[#527373]">
                            {isRtl ? "تحميل نسخة كاملة من المحادثات والذكريات" : "Download comprehensive JSON archive"}
                          </p>
                        </div>
                        <button
                          onClick={handleExportJSON}
                          className="w-fit px-3.5 py-1.5 rounded-lg bg-[#0f1717] hover:bg-[#142222] border border-[#1a2c2c] text-[#88b0b0] hover:text-[#00d4aa] text-xs font-medium transition-all flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isRtl ? "تنزيل الملف" : "Download JSON"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}
