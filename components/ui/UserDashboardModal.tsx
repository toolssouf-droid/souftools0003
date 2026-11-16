"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Brain,
  Sparkles,
  Settings,
  Plus,
  Trash2,
  Check,
  Search,
  Bot,
  Volume2,
  Download,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Shield,
  ShieldAlert,
  Layers,
  Send,
  Sliders,
  Cpu,
  Bookmark,
  ToggleLeft,
  ToggleRight,
  Database,
  Radio,
  FileCode2,
  Workflow,
  KeyRound,
  Smartphone
} from "lucide-react";
import { useChatStore, SoufAIModelId } from "@/store/chatStore";
import { performCompleteSignOut } from "@/lib/auth/unifiedAuth";
import { isRtlLocale } from "@/lib/i18n";
import { removeAuthCookie } from "@/lib/authCookies";
import { isUserAdmin } from "@/lib/auth/adminRoles";

interface UserDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  initialTab?: "memory" | "roadmap" | "settings";
}

interface MemoryEntry {
  id: string;
  content: string;
  category: "project" | "preference" | "identity" | "knowledge";
  createdAt: number;
}

export const UserDashboardModal: React.FC<UserDashboardModalProps> = ({
  isOpen,
  onClose,
  locale,
  initialTab = "settings",
}) => {
  const isRtl = isRtlLocale(locale);
  const {
    userEmail,
    userId,
    isAdmin,
    currentModel,
    setCurrentModel,
    clearAllSessions,
    clearAllMemory,
    sessions,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<"memory" | "roadmap" | "settings">(initialTab);
  
  // Memory State
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memories, setMemories] = useState<MemoryEntry[]>([
    {
      id: "mem-1",
      content: isRtl ? "المستخدم يفضل كتابة الشفرات البرمجية بلغة TypeScript و Tailwind CSS." : "User prefers TypeScript and Tailwind CSS for coding solutions.",
      category: "preference",
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: "mem-2",
      content: isRtl ? "الرد دائماً باللغة العربية الفصحى المعاصرة وبشكل منسق ودقيق." : "Always reply in modern clear Arabic unless instructed otherwise.",
      category: "preference",
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: "mem-3",
      content: isRtl ? "تطبيق SoufTools هو منصة أدوات ذكاء اصطناعي شاملة ومتعددة النماذج." : "Project context: SoufTools is an all-in-one multi-model AI suite.",
      category: "project",
      createdAt: Date.now() - 86400000 * 1,
    },
  ]);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryEntry["category"]>("preference");
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryFilter, setMemoryFilter] = useState<string>("all");

  // Roadmap & Feedback State
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("feature");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Settings State
  const [ttsAutoplay, setTtsAutoplay] = useState(false);
  const [saveHistory, setSaveHistory] = useState(true);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  React.useEffect(() => {
    if (isOpen) {
      fetch("/api/v1/memory")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.memories) && data.memories.length > 0) {
            setMemories(
              data.memories.map((m: any) => ({
                id: m.id,
                content: m.content,
                category: (m.type || "preference").toLowerCase(),
                createdAt: m.createdAt || Date.now(),
              }))
            );
          }
          if (data && data.settings) {
            setMemoryEnabled(data.settings.memoryEnabled !== false);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    const content = newMemoryText.trim();
    const category = newMemoryCategory;
    setNewMemoryText("");

    try {
      const res = await fetch("/api/v1/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory: {
            content,
            type: category.toUpperCase(),
            importance: 0.85,
            source: "user",
          },
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const saved = data?.memory;
        if (saved) {
          setMemories((prev) => [
            {
              id: saved.id,
              content: saved.content,
              category: (saved.type || category).toLowerCase(),
              createdAt: saved.createdAt || Date.now(),
            },
            ...prev,
          ]);
        }
      }
    } catch (err) {
      console.error("Add memory error:", err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    setMemories(memories.filter((m) => m.id !== id));
    try {
      await fetch(`/api/v1/memory?id=${id}`, { method: "DELETE" });
    } catch {}
  };

  const handleExportBackup = () => {
    const backupData = {
      userEmail,
      userId,
      exportedAt: new Date().toISOString(),
      memories,
      sessionsCount: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        modelId: s.modelId,
        createdAt: s.createdAt,
        messagesCount: s.messages.length,
      })),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `souftools_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSubmitted(true);
    setTimeout(() => {
      setFeedbackText("");
      setFeedbackSubmitted(false);
    }, 3000);
  };

  const handleLogout = async () => {
    onClose();
    await performCompleteSignOut(locale);
  };

  const filteredMemories = memories.filter((m) => {
    const matchesSearch = m.content.toLowerCase().includes(memorySearch.toLowerCase());
    const matchesCategory = memoryFilter === "all" || m.category === memoryFilter;
    return matchesSearch && matchesCategory;
  });

  const roadmapItems = [
    {
      id: "live-voice",
      icon: Radio,
      titleAr: "المحادثة الصوتية اللحظية الفائقة (Live Voice AI)",
      titleEn: "Live Voice AI & Speech Synthesis",
      descAr: "حوار صوتي تفاعلي حي بدون تأخير زمني وبنبرات عربية طبيعية متعددة.",
      descEn: "Ultra-low-latency real-time voice conversations with multiple natural accents.",
      progress: 85,
      tagAr: "قريباً في v2.6",
      tagEn: "Coming in v2.6",
      badgeColor: "border-[#00d4aa]/40 text-[#00d4aa] bg-[#00d4aa]/10",
    },
    {
      id: "deep-research",
      icon: Brain,
      titleAr: "محرك البحث والتحليل الأكاديمي (Deep Research Agent)",
      titleEn: "Deep Autonomous Research Agent",
      descAr: "وكيل ذكي يبحث في عشرات المصادر عبر الويب ويولد تقارير أكاديمية موثقة.",
      descEn: "Autonomous agent searching dozens of web sources to synthesize comprehensive reports.",
      progress: 90,
      tagAr: "مرحلة الاختبار التجريبي",
      tagEn: "Beta Testing",
      badgeColor: "border-[#0ea5e9]/40 text-[#0ea5e9] bg-[#0ea5e9]/10",
    },
    {
      id: "workflows",
      icon: Workflow,
      titleAr: "أتمتة المهام والوكلاء البرمجيين (Autonomous Workflows)",
      titleEn: "Multi-step Autonomous Workflows",
      descAr: "سلاسل أتمتة تنفذ المهام المعقدة وربط الـ APIs وقواعد البيانات تلقائياً.",
      descEn: "Execute scheduled chains, multi-step tasks, and custom third-party integrations.",
      progress: 65,
      tagAr: "قيد التطوير",
      tagEn: "In Development",
      badgeColor: "border-[#f59e0b]/40 text-[#f59e0b] bg-[#f59e0b]/10",
    },
    {
      id: "canvas-studio",
      icon: FileCode2,
      titleAr: "استوديو الثيمات واللوحة الإبداعية (Custom Canvas Studio)",
      titleEn: "Interactive Canvas & Theme Studio",
      descAr: "مساحة عمل بصرية لتحرير الأكواد والمستندات والرسوم البيانية جنباً إلى جنب.",
      descEn: "Split-pane visual workspace for live document, code, and diagram co-creation.",
      progress: 70,
      tagAr: "قيد التطوير",
      tagEn: "In Development",
      badgeColor: "border-[#8b5cf6]/40 text-[#8b5cf6] bg-[#8b5cf6]/10",
    },
    {
      id: "byok-vault",
      icon: KeyRound,
      titleAr: "خزنة المفاتيح والنماذج المخصصة (BYOK Vault)",
      titleEn: "Bring Your Own Key & Private Models",
      descAr: "تشغيل مفاتيحك الخاصة لـ OpenAI و Claude و Grok و Ollama بدون قيود.",
      descEn: "Connect your custom API keys for third-party and self-hosted private models.",
      progress: 80,
      tagAr: "قريباً",
      tagEn: "Coming Soon",
      badgeColor: "border-[#10b981]/40 text-[#10b981] bg-[#10b981]/10",
    },
    {
      id: "mobile-apps",
      icon: Smartphone,
      titleAr: "تطبيقات الهواتف الذكية المستقلة (Native iOS & Android)",
      titleEn: "Native iOS & Android Mobile Apps",
      descAr: "تطبيق موبايل سريع بكامل إمكانيات SoufTools مع دعم وضع عدم الاتصال.",
      descEn: "Full-featured native mobile experience with offline sync and widget support.",
      progress: 40,
      tagAr: "في الخطة",
      tagEn: "Planned",
      badgeColor: "border-[#ec4899]/40 text-[#ec4899] bg-[#ec4899]/10",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-4xl max-h-[90vh] bg-[#0c1414] border border-[#1e2e2e] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#e8f5f5]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1e2e2e] flex items-center justify-between bg-[#111a1a]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00d4aa]/20 to-[#0ea5e9]/20 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa]">
              {activeTab === "memory" && <Brain className="w-5 h-5" />}
              {activeTab === "roadmap" && <Sparkles className="w-5 h-5" />}
              {activeTab === "settings" && <Settings className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {isRtl ? "لوحة التحكم والإعدادات المتقدمة" : "Dashboard & Settings"}
              </h2>
              <p className="text-xs text-[#6e9999]">
                {isRtl
                  ? "إدارة الذاكرة الذكية، استكشاف ميزات المستقبل، وتخصيص تجربة SoufTools."
                  : "Manage SoufAI Memory, explore future roadmaps, and configure workspace."}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6e9999] hover:text-white hover:bg-[#1a2626] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#1e2e2e] px-4 bg-[#0a0f0f] gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "settings"
                ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/5"
                : "border-transparent text-[#6e9999] hover:text-[#e8f5f5]"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{isRtl ? "الحساب والإعدادات العامة" : "Account & General"}</span>
          </button>

          <button
            onClick={() => setActiveTab("memory")}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "memory"
                ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/5"
                : "border-transparent text-[#6e9999] hover:text-[#e8f5f5]"
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>{isRtl ? "الذاكرة الذكية (SoufAI Memory)" : "SoufAI Memory"}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#00d4aa]/15 text-[#00d4aa] font-mono">
              {memories.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("roadmap")}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "roadmap"
                ? "border-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/5"
                : "border-transparent text-[#6e9999] hover:text-[#e8f5f5]"
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#0ea5e9]" />
            <span>{isRtl ? "سنطورها في المستقبل (Roadmap)" : "Future Roadmap & Labs"}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0ea5e9]/15 text-[#0ea5e9] font-bold">
              6 {isRtl ? "ميزات" : "Labs"}
            </span>
          </button>

          {(useChatStore.getState().isAdmin || isUserAdmin(useChatStore.getState().userEmail) || useChatStore.getState().userEmail === "toolssouf@gmail.com") && (
            <Link
              href={`/${locale}/admin`}
              onClick={onClose}
              className="py-1.5 px-3 font-semibold text-xs flex items-center gap-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition-all cursor-pointer whitespace-nowrap rtl:mr-auto ltr:ml-auto my-auto"
              title={isRtl ? "دخول لوحة تحكم المسؤول" : "Open Admin Dashboard"}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRtl ? "لوحة الإدارة (Admin)" : "Admin Panel"}</span>
            </Link>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: SETTINGS & ACCOUNT */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Account Identity Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00d4aa]/20 to-[#0ea5e9]/20 border border-[#00d4aa]/40 flex items-center justify-center text-lg font-bold text-[#00d4aa]">
                    {userEmail ? userEmail[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm sm:text-base">
                        {userEmail || (isRtl ? "زائر غير مسجل" : "Guest User")}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                        isAdmin
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                          : "bg-[#00d4aa]/15 border-[#00d4aa]/30 text-[#00d4aa]"
                      }`}>
                        {isAdmin ? (isRtl ? "مدير النظام (Admin)" : "System Admin") : (isRtl ? "الباقة المجانية" : "Free Tier")}
                      </span>
                    </div>
                    <p className="text-xs text-[#6e9999] mt-0.5">
                      UID: <span className="font-mono text-[11px] text-[#4a7070]">{userId || "—"}</span>
                    </p>
                  </div>
                </div>

                {userEmail && (
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isRtl ? "تسجيل الخروج" : "Sign Out"}</span>
                  </button>
                )}
              </div>

              {/* Preferences Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Default Engine Selector */}
                <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Cpu className="w-4 h-4 text-[#00d4aa]" />
                    <span>{isRtl ? "النموذج الافتراضي المفضل" : "Default AI Model"}</span>
                  </div>
                  <p className="text-xs text-[#6e9999]">
                    {isRtl ? "اختر النموذج الذي يبدأ العمل تلقائياً في كل جلسة جديدة." : "Select the default engine used when starting new conversations."}
                  </p>
                  <select
                    value={currentModel}
                    onChange={(e) => setCurrentModel(e.target.value as SoufAIModelId)}
                    className="w-full bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-xs text-[#e8f5f5] focus:outline-none transition-colors"
                  >
                    <option value="spark">⚡ SoufAI Spark — Ultra Fast & Lightweight</option>
                    <option value="core">SoufAI Core — Balanced Multipurpose</option>
                    <option value="pro">SoufAI Pro — Deep Reasoning & Analysis</option>
                    <option value="coder">SoufAI Coder — Full-Stack Programming</option>
                    <option value="ultra">SoufAI Ultra — Flagship Architecture</option>
                    <option value="vision">SoufAI Vision — Multimodal & Image QA</option>
                  </select>
                </div>

                {/* Speech Synthesis (TTS) Toggle */}
                <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Volume2 className="w-4 h-4 text-[#0ea5e9]" />
                        <span>{isRtl ? "النطق الصوتي التلقائي" : "Auto-Play Voice (TTS)"}</span>
                      </div>
                      <button
                        onClick={() => setTtsAutoplay(!ttsAutoplay)}
                        className="cursor-pointer text-[#0ea5e9]"
                      >
                        {ttsAutoplay ? (
                          <ToggleRight className="w-7 h-7 text-[#00d4aa]" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-[#4a7070]" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-[#6e9999] mt-2">
                      {isRtl ? "قراءة ردود الذكاء الاصطناعي صوتياً بصوت عربي فصيح وطبيعي فور اكتمال التوليد." : "Automatically read aloud model responses in clear Arabic speech."}
                    </p>
                  </div>
                  <div className="text-[11px] text-[#4a7070]">
                    {ttsAutoplay ? (isRtl ? "مفعل حالياً" : "Enabled") : (isRtl ? "معطل" : "Disabled")}
                  </div>
                </div>
              </div>

              {/* Data & Backup Tools */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Database className="w-4 h-4 text-[#00d4aa]" />
                  <span>{isRtl ? "النسخ الاحتياطي والبيانات" : "Data Backup & Privacy"}</span>
                </div>
                <p className="text-xs text-[#6e9999]">
                  {isRtl
                    ? "يمكنك تصدير كافة المحادثات والذكريات وقواعد البيانات الخاصة بك كملف JSON آمن للنسخ الاحتياطي."
                    : "Export your entire conversation history and saved memories as a JSON archive."}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExportBackup}
                    className="px-4 py-2.5 rounded-xl bg-[#00d4aa]/15 hover:bg-[#00d4aa] text-[#00d4aa] hover:text-[#0a0f0f] border border-[#00d4aa]/30 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isRtl ? "تصدير نسخة احتياطية (JSON)" : "Export Backup (JSON)"}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(isRtl ? "هل أنت متأكد من مسح سجل المحادثات بالكامل؟" : "Clear all chat sessions?")) {
                        clearAllSessions();
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isRtl ? "مسح المحادثات السابقة" : "Clear Chat History"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOUFAI MEMORY */}
          {activeTab === "memory" && (
            <div className="space-y-6">
              {/* Memory Status & Toggle Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#00d4aa]/10 via-[#0ea5e9]/10 to-transparent border border-[#00d4aa]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-[#00d4aa]" />
                    <h3 className="font-bold text-white text-sm sm:text-base">
                      {isRtl ? "محرك الذاكرة المستمرة (SoufAI Long-Term Memory)" : "SoufAI Long-Term Memory Engine"}
                    </h3>
                  </div>
                  <p className="text-xs text-[#8db3b3]">
                    {isRtl
                      ? "يتذكر المساعد تفضيلاتك وسياق مشاريعك عبر كافة الجلسات لتقديم إجابات مخصصة ودقيقة دائماً."
                      : "SoufAI remembers your preferences, project context, and custom rules across all sessions."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-[#8db3b3]">
                    {memoryEnabled ? (isRtl ? "الذاكرة نشطة" : "Active") : (isRtl ? "معطلة" : "Disabled")}
                  </span>
                  <button
                    onClick={() => setMemoryEnabled(!memoryEnabled)}
                    className="cursor-pointer"
                    title={memoryEnabled ? "Disable memory" : "Enable memory"}
                  >
                    {memoryEnabled ? (
                      <ToggleRight className="w-8 h-8 text-[#00d4aa]" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[#4a7070]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Add Custom Memory Form */}
              <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#00d4aa]" />
                  <span>{isRtl ? "إضافة حقيقة أو قاعدة جديدة إلى الذاكرة" : "Add New Memory Fact or Preference"}</span>
                </h4>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder={isRtl ? "مثال: أنا أعمل على مشروع متجر إلكتروني بنكست وتيلويند..." : "e.g., I prefer concise code snippets without redundant comments..."}
                    className="flex-1 bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-xs text-[#e8f5f5] focus:outline-none placeholder-[#4a7070]"
                  />
                  <select
                    value={newMemoryCategory}
                    onChange={(e) => setNewMemoryCategory(e.target.value as any)}
                    className="bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-xs text-[#e8f5f5] focus:outline-none"
                  >
                    <option value="preference">{isRtl ? "تفضيل شخصي" : "Preference"}</option>
                    <option value="project">{isRtl ? "سياق مشروع" : "Project Context"}</option>
                    <option value="identity">{isRtl ? "معلومات الهوية" : "Identity"}</option>
                    <option value="knowledge">{isRtl ? "معرفة مخصصة" : "Custom Knowledge"}</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#00d4aa] hover:bg-[#00ffcc] text-[#0a0f0f] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isRtl ? "حفظ" : "Save"}</span>
                  </button>
                </div>
              </form>

              {/* Memory Search and Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className={`w-3.5 h-3.5 absolute ${isRtl ? "right-3" : "left-3"} top-3 text-[#4a7070]`} />
                  <input
                    type="text"
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    placeholder={isRtl ? "بحث في الذكريات..." : "Search saved memories..."}
                    className={`w-full bg-[#111a1a] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl ${
                      isRtl ? "pr-9 pl-3" : "pl-9 pr-3"
                    } py-2 text-xs text-[#e8f5f5] focus:outline-none placeholder-[#4a7070]`}
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                  {["all", "preference", "project", "identity", "knowledge"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMemoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                        memoryFilter === cat
                          ? "bg-[#00d4aa]/15 border-[#00d4aa]/40 text-[#00d4aa]"
                          : "bg-[#111a1a] border-[#1e2e2e] text-[#6e9999] hover:text-[#e8f5f5]"
                      }`}
                    >
                      {cat === "all" && (isRtl ? "الكل" : "All")}
                      {cat === "preference" && (isRtl ? "تفضيلات" : "Preferences")}
                      {cat === "project" && (isRtl ? "مشاريع" : "Projects")}
                      {cat === "identity" && (isRtl ? "هوية" : "Identity")}
                      {cat === "knowledge" && (isRtl ? "معرفة" : "Knowledge")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Memories List */}
              <div className="space-y-2.5">
                {filteredMemories.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#1e2e2e] rounded-2xl text-[#6e9999]">
                    <Brain className="w-8 h-8 mx-auto text-[#2d4545] mb-2" />
                    <p className="text-xs">{isRtl ? "لا توجد ذكريات تطابق البحث." : "No memories found matching your search."}</p>
                  </div>
                ) : (
                  filteredMemories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-3.5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/30 transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#0a0f0f] border border-[#1e2e2e] flex items-center justify-center text-[#00d4aa] text-xs shrink-0 mt-0.5">
                          {mem.category === "preference" && "⚙️"}
                          {mem.category === "project" && "📁"}
                          {mem.category === "identity" && "👤"}
                          {mem.category === "knowledge" && "💡"}
                        </div>
                        <div>
                          <p className="text-xs text-[#e8f5f5] leading-relaxed">{mem.content}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#4a7070]">
                            <span className="capitalize">{mem.category}</span>
                            <span>•</span>
                            <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#4a7070] hover:text-red-400 hover:bg-[#0a0f0f] transition-all cursor-pointer shrink-0"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FUTURE ROADMAP & LABS */}
          {activeTab === "roadmap" && (
            <div className="space-y-6">
              {/* Roadmap Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0ea5e9]/10 via-[#00d4aa]/10 to-transparent border border-[#0ea5e9]/20 space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#0ea5e9]" />
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    {isRtl ? "ميزات قادمة سنطورها في التحديثات القادمة" : "Upcoming Features & SoufTools Labs"}
                  </h3>
                </div>
                <p className="text-xs text-[#8db3b3]">
                  {isRtl
                    ? "خارطة طريق التطوير الحية لأدوات الذكاء الاصطناعي، والوكلاء البرمجيين، والميزات التفاعلية القادمة."
                    : "Live roadmap of state-of-the-art AI agents, voice synthesis, and autonomous coding tools in progress."}
                </p>
              </div>

              {/* Roadmap Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roadmapItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/40 transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] flex items-center justify-center text-[#00d4aa] group-hover:border-[#00d4aa]/50 transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${item.badgeColor}`}>
                            {isRtl ? item.tagAr : item.tagEn}
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#00d4aa] transition-colors">
                          {isRtl ? item.titleAr : item.titleEn}
                        </h4>

                        <p className="text-xs text-[#6e9999] leading-relaxed">
                          {isRtl ? item.descAr : item.descEn}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-[#1e2e2e]/50">
                        <div className="flex items-center justify-between text-[10px] text-[#8db3b3]">
                          <span>{isRtl ? "نسبة الإنجاز" : "Progress"}</span>
                          <span className="font-mono font-bold text-[#00d4aa]">{item.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#0a0f0f] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] transition-all duration-500"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Suggest a Feature Section */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-3">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#00d4aa]" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {isRtl ? "اقترح ميزة أو أداة ترغب في رؤيتها في SoufTools" : "Suggest a Feature or New AI Capability"}
                  </h4>
                </div>
                <p className="text-xs text-[#6e9999]">
                  {isRtl
                    ? "نحن نبني المنصة بناءً على طلباتكم المباشرة! شاركنا بأي نموذج أو أداة ترغب في دعمها."
                    : "We build features based on direct user feedback! Tell us what tools or models you want next."}
                </p>

                {feedbackSubmitted ? (
                  <div className="p-3 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>{isRtl ? "شكراً لك! تم استلام اقتراحك وسنضمه إلى خطة التطوير القادمة." : "Thank you! Your suggestion has been logged for our next sprint."}</span>
                  </div>
                ) : (
                  <form onSubmit={handleSendFeedback} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={isRtl ? "اكتب فكرتك أو الميزة التي تحتاجها هنا..." : "Describe the feature or integration you want..."}
                      className="flex-1 bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-xs text-[#e8f5f5] focus:outline-none placeholder-[#4a7070]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#0ea5e9] hover:bg-[#38bdf8] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isRtl ? "إرسال الاقتراح" : "Submit"}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#1e2e2e] bg-[#111a1a]/80 flex items-center justify-between text-xs text-[#6e9999]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span>SoufTools OS v2.5.0 Production Ready</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#1a2626] hover:bg-[#253636] text-[#e8f5f5] font-medium transition-colors cursor-pointer"
          >
            {isRtl ? "إغلاق" : "Close"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
