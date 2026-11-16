"use client";

import React, { useState, useEffect } from "react";
import { ImageGenAdminPanel } from "@/components/admin/ImageGenAdminPanel";
import { getAuthCookie } from "@/lib/authCookies";
import {
  Wrench,
  Search,
  Link2,
  Key,
  ToggleLeft,
  ToggleRight,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  RefreshCw,
  Calculator,
  Activity,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  BarChart3,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface ToolKeyItem {
  id: string;
  key: string;
  status: "active" | "failed" | "unverified";
  lastTestedAt?: string;
  lastUsedAt?: string;
  failureReason?: string;
}

export interface ToolItem {
  id: string;
  name: string;
  category: "search" | "reader" | "math" | "system" | "custom";
  enabled: boolean;
  priority: number;
  isFree?: boolean;
  rotationMode?: "priority" | "round_robin";
  description?: string;
  keys: ToolKeyItem[];
}

export interface ToolLogEntry {
  id: string;
  timestamp: number;
  tool: string;
  toolName: string;
  query?: string;
  status: "success" | "fallback" | "failed";
  latencyMs?: number;
  note?: string;
}

export interface ToolsStats {
  todayTotal: number;
  tavily: number;
  exa: number;
  serper: number;
  ddg: number;
  firecrawl: number;
  jina: number;
  calculator?: number;
  system_stats?: number;
  time_tools?: number;
  successCount?: number;
  failCount?: number;
  lastUsedAt?: string;
  recentLogs?: ToolLogEntry[];
  [key: string]: any;
}

export default function AdminToolsPage() {
  const [activeTab, setActiveTab] = useState<"web_tools" | "image_gen">("web_tools");
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [stats, setStats] = useState<ToolsStats>({
    todayTotal: 0,
    tavily: 0,
    exa: 0,
    serper: 0,
    ddg: 0,
    firecrawl: 0,
    jina: 0,
    calculator: 0,
    system_stats: 0,
    time_tools: 0,
    successCount: 0,
    failCount: 0,
    lastUsedAt: undefined,
    recentLogs: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [showLiveLogs, setShowLiveLogs] = useState(false);

  // Key testing state
  const [verifyingKeys, setVerifyingKeys] = useState<Record<string, boolean>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, { valid: boolean; message: string }>>({});

  // Hidden/Visible raw keys toggle map
  const [showKeysMap, setShowKeysMap] = useState<Record<string, boolean>>({});

  // Modal state for adding a new tool
  const [showAddModal, setShowAddModal] = useState(false);
  const [newToolName, setNewToolName] = useState("");
  const [newToolCategory, setNewToolCategory] = useState<"search" | "reader" | "custom">("custom");
  const [newToolKey, setNewToolKey] = useState("");
  const [newToolDesc, setNewToolDesc] = useState("");

  // 1. Fetch initial tools config & usage stats
  const loadData = async () => {
    setLoading(true);
    let loadedTools: ToolItem[] | null = null;
    let loadedStats: ToolsStats | null = null;

    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = {};
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/tools", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tools) && data.tools.length > 0) {
          loadedTools = data.tools;
        }
        if (data.stats) {
          loadedStats = data.stats;
        }
      }
    } catch (fetchErr) {
      console.warn("API /api/admin/tools fetch fallback:", fetchErr);
    }

    try {
      // Direct client Cloud Backend read fallback
      if (!loadedTools) {
        try {
          const { getAdminConfigFromCloud } = await import("@/lib/backendServices");
          const fsConfig = await getAdminConfigFromCloud();
          if (fsConfig?.toolsConfig && Array.isArray(fsConfig.toolsConfig) && fsConfig.toolsConfig.length > 0) {
            loadedTools = fsConfig.toolsConfig;
          }
          if (fsConfig?.toolsStats) {
            loadedStats = fsConfig.toolsStats;
          }
        } catch (fsErr) {
          console.warn("Firestore tools fallback error:", fsErr);
        }
      }

      if (loadedTools) {
        setTools(loadedTools);
      } else {
        // Initial fallback tools setup
        setTools([
          {
            id: "tavily",
            name: "Tavily Web Search",
            category: "search",
            enabled: true,
            priority: 1,
            rotationMode: "priority",
            description: "محرك بحث متطور مخصص للذكاء الاصطناعي لتزويد الإجابات بمعلومات حية ودقيقة",
            keys: [{ id: "tvly_1", key: "tvly-sample-key-101", status: "active" }],
          },
          {
            id: "exa",
            name: "Exa Neural Search",
            category: "search",
            enabled: true,
            priority: 2,
            rotationMode: "priority",
            description: "بحث دلالي فائق السرعة يعتمد على نماذج الشبكات العصبية",
            keys: [{ id: "exa_1", key: "", status: "unverified" }],
          },
          {
            id: "serper",
            name: "Serper Google Search API",
            category: "search",
            enabled: true,
            priority: 3,
            rotationMode: "priority",
            description: "واجهة برمجية لجلب نتائج بحث جوجل المباشرة والدقيقة",
            keys: [{ id: "serper_1", key: "serper-key-x88", status: "active" }],
          },
          {
            id: "ddg",
            name: "DuckDuckGo Free Search",
            category: "search",
            enabled: true,
            priority: 4,
            isFree: true,
            description: "بحث مجاني ومفتوح بدون حاجة لمفاتيح - الاحتياطي الأخير المقاوم للفشل",
            keys: [],
          },
          {
            id: "firecrawl",
            name: "Firecrawl Web Scraper",
            category: "reader",
            enabled: true,
            priority: 1,
            rotationMode: "priority",
            description: "زاحف ويب متكامل لاستخراج قراءة ومحتوى المواقع والصفحات الكاملة",
            keys: [{ id: "fc_1", key: "", status: "unverified" }],
          },
          {
            id: "jina",
            name: "Jina Reader",
            category: "reader",
            enabled: true,
            priority: 2,
            rotationMode: "priority",
            description: "تحويل روابط المواقع والصفحات إلى نص Markdown نظيف للتحليل",
            keys: [{ id: "jina_1", key: "jina_key_990", status: "active" }],
          },
          {
            id: "calculator",
            name: "الحاسبة الرياضية الدقيقة",
            category: "math",
            enabled: true,
            priority: 1,
            isFree: true,
            description: "أداة تنفيذ العمليات الحسابية والمعادلات بسرعة وبدقة 100%",
            keys: [],
          },
          {
            id: "system_stats",
            name: "فحص حالة النظام والمزودين",
            category: "system",
            enabled: true,
            priority: 1,
            isFree: true,
            description: "قراءة مؤشرات أداء الخادم وقواعد البيانات والنماذج المربوطة",
            keys: [],
          },
        ]);
      }

      if (loadedStats) {
        setStats(loadedStats);
      }
    } catch (err) {
      console.error("Error loading tools data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetch("/api/admin/tools")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.stats) {
            setStats(data.stats);
          }
        })
        .catch(() => null);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshStats = async () => {
    setRefreshingStats(true);
    try {
      const res = await fetch("/api/admin/tools");
      if (res.ok) {
        const data = await res.json();
        if (data?.stats) {
          setStats(data.stats);
        }
      }
    } catch (e) {
      console.warn("Failed to refresh stats:", e);
    } finally {
      setTimeout(() => setRefreshingStats(false), 400);
    }
  };

  // Tool controls
  const toggleTool = (toolId: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t))
    );
    setHasUnsavedChanges(true);
  };

  const changeRotationMode = (toolId: string, mode: "priority" | "round_robin") => {
    setTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, rotationMode: mode } : t))
    );
    setHasUnsavedChanges(true);
  };

  const shiftPriority = (toolId: string, direction: "up" | "down") => {
    setTools((prev) => {
      const toolToMove = prev.find((t) => t.id === toolId);
      if (!toolToMove) return prev;

      const sameCategoryTools = prev
        .filter((t) => t.category === toolToMove.category)
        .sort((a, b) => a.priority - b.priority);

      const currIndex = sameCategoryTools.findIndex((t) => t.id === toolId);
      if (currIndex === -1) return prev;

      const targetIndex = direction === "up" ? currIndex - 1 : currIndex + 1;
      if (targetIndex < 0 || targetIndex >= sameCategoryTools.length) return prev;

      // Swap priorities
      const otherTool = sameCategoryTools[targetIndex];
      const tempP = toolToMove.priority;
      toolToMove.priority = otherTool.priority;
      otherTool.priority = tempP;

      return [...prev].sort((a, b) => a.priority - b.priority);
    });
    setHasUnsavedChanges(true);
  };

  // Keys management inside a tool
  const updateKeyVal = (toolId: string, keyId: string, newVal: string) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        const updatedKeys = (t.keys || []).map((k) =>
          k.id === keyId ? { ...k, key: newVal, status: "unverified" as const } : k
        );
        return { ...t, keys: updatedKeys };
      })
    );
    setHasUnsavedChanges(true);
  };

  const addKeyToTool = (toolId: string) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        const newKeyObj: ToolKeyItem = {
          id: `${toolId}_key_${Date.now()}`,
          key: "",
          status: "unverified",
        };
        return { ...t, keys: [...(t.keys || []), newKeyObj] };
      })
    );
    setHasUnsavedChanges(true);
  };

  const deleteKeyFromTool = (toolId: string, keyId: string) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        return { ...t, keys: (t.keys || []).filter((k) => k.id !== keyId) };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Live Test key execution
  const testKey = async (toolId: string, keyObj: ToolKeyItem) => {
    const keyId = keyObj.id;
    setVerifyingKeys((prev) => ({ ...prev, [keyId]: true }));
    try {
      const res = await fetch("/api/admin/tools/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, key: keyObj.key }),
      });
      const data = await res.json();

      setVerifyResults((prev) => ({
        ...prev,
        [keyId]: { valid: data.valid, message: data.message || "اكتمل الفحص" },
      }));

      // Update key status in tools state
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== toolId) return t;
          const updatedKeys = (t.keys || []).map((k) => {
            if (k.id === keyId) {
              return {
                ...k,
                status: (data.valid ? "active" : "failed") as any,
                lastTestedAt: new Date().toISOString(),
                failureReason: data.valid ? undefined : data.message,
              };
            }
            return k;
          });
          return { ...t, keys: updatedKeys };
        })
      );
      setHasUnsavedChanges(true);
    } catch (err: any) {
      setVerifyResults((prev) => ({
        ...prev,
        [keyId]: { valid: false, message: "فشل الاتصال بسيرفر الفحص" },
      }));
    } finally {
      setVerifyingKeys((prev) => ({ ...prev, [keyId]: false }));
    }
  };

  // Save all tools and keys configuration
  const handleSaveAll = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // 1. Direct Cloud save for instant persistence
      let fsSaved = false;
      let fsErrMsg = "";
      try {
        const { saveAdminConfigToCloud } = await import("@/lib/backendServices");
        fsSaved = await saveAdminConfigToCloud(undefined, undefined, undefined, undefined, tools, undefined);
      } catch (fsErr: any) {
        fsErrMsg = fsErr?.message || String(fsErr);
        console.warn("Direct Cloud save error:", fsErr);
      }

      // 2. Call API route to update server memory cache
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/tools", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ tools }),
      }).catch(() => null);

      if (fsSaved || (res && res.ok)) {
        setSaveSuccess(true);
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        const serverData = res ? await res.json().catch(() => ({})) : {};
        const reason = serverData.error || fsErrMsg || "تعذر الحفظ المباشر في Cloud Firestore.";
        setSaveError(`فشل حفظ إعدادات الأدوات والمفاتيح: ${reason}`);
      }
    } catch (err: any) {
      setSaveError(`خطأ غير متوقع أثناء الحفظ: ${err?.message || "خطأ عام"}`);
    } finally {
      setSaving(false);
    }
  };

  // Reset Stats
  const handleResetStats = async () => {
    if (!confirm("هل أنت تأكد من تصفير إحصائيات الاستخدام اليومية للأدوات؟")) return;
    try {
      await fetch("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetStats: true }),
      });
      setStats({ todayTotal: 0, tavily: 0, exa: 0, serper: 0, ddg: 0, firecrawl: 0, jina: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  // Helper for toggle show/hide key
  const toggleShowKey = (keyId: string) => {
    setShowKeysMap((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  // Helper mask key string
  const maskKeyStr = (str: string) => {
    if (!str || str.length <= 8) return "••••••••";
    return `${str.slice(0, 4)}••••${str.slice(-4)}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "search":
        return <Search className="w-4 h-4 text-[#0ea5e9]" />;
      case "reader":
        return <Link2 className="w-4 h-4 text-[#a855f7]" />;
      case "math":
        return <Calculator className="w-4 h-4 text-[#eab308]" />;
      case "system":
        return <Activity className="w-4 h-4 text-[#10b981]" />;
      default:
        return <Wrench className="w-4 h-4 text-[#00d4aa]" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-9 h-9 text-[#00d4aa] animate-spin" />
        <p className="text-sm font-semibold text-[#4a7070]">جاري تحميل شبكة أدوات الويب والبدائل والمفاتيح...</p>
      </div>
    );
  }

  // Group tools by search, reader, and other
  const searchTools = tools.filter((t) => t.category === "search").sort((a, b) => a.priority - b.priority);
  const readerTools = tools.filter((t) => t.category === "reader").sort((a, b) => a.priority - b.priority);
  const otherTools = tools.filter((t) => t.category !== "search" && t.category !== "reader");

  return (
    <div className="space-y-6">
      {/* Tools Section Subtabs Bar */}
      <div className="flex items-center gap-2 p-1.5 bg-[#0a0f0f] border border-[#1e2e2e] rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("web_tools")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "web_tools"
              ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
              : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
          }`}
        >
          <Wrench className="w-4 h-4" />
          أدوات البحث والقراءة المباشرة
        </button>

        <button
          onClick={() => setActiveTab("image_gen")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "image_gen"
              ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
              : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          توليد الصور (Image Generation)
        </button>
      </div>

      {activeTab === "image_gen" ? (
        <ImageGenAdminPanel />
      ) : (
        <>
          {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-[#1e2e2e]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-xl text-[#00d4aa]">
              <Wrench className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-[#e8f5f5]">إدارة أدوات الويب ونظام الـ Fallback المتقدم</h2>
          </div>
          <p className="text-xs text-[#4a7070] pr-10">
            تكوين تدوير المفاتيح والبدائل التلقائية لمحركات البحث (Tavily → Exa → Serper → DuckDuckGo) وقراء الروابط
          </p>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-auto">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#88b0b0] rounded-xl border border-[#1e2e2e] transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
              saveSuccess
                ? "bg-green-500 text-black shadow-green-500/20 font-extrabold"
                : hasUnsavedChanges
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-[#00d4aa]/30 animate-pulse font-extrabold ring-2 ring-[#00d4aa]/50"
                : "bg-[#00d4aa] text-[#0a0f0f] hover:bg-[#00b894]"
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
            <span>
              {saving
                ? "جاري الحفظ المباشر..."
                : saveSuccess
                ? "تم الحفظ بنجاح ✅"
                : hasUnsavedChanges
                ? "حفظ التغييرات الجديدة ⚠️"
                : "حفظ إعدادات الأدوات"}
            </span>
          </button>
        </div>
      </div>

      {/* Top Usage Statistics Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2e2e] pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4aa] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00d4aa]"></span>
            </span>
            <span className="text-xs font-bold text-[#e8f5f5]">
              إحصائيات استخدام الأدوات الحقيقية وسجل الاستدعاءات:
            </span>
            {stats.lastUsedAt && (
              <span className="text-[10px] text-[#4a7070] bg-[#141f1f] px-2 py-0.5 rounded-full border border-[#1e2e2e]">
                آخر نشاط: {new Date(stats.lastUsedAt).toLocaleTimeString("ar-EG")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLiveLogs((prev) => !prev)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                showLiveLogs
                  ? "bg-[#00d4aa]/15 border-[#00d4aa]/40 text-[#00d4aa]"
                  : "bg-[#141f1f] border-[#1e2e2e] text-[#8ea8a8] hover:text-[#e8f5f5]"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>سجل العمليات المباشر ({stats.recentLogs?.length || 0})</span>
            </button>

            <button
              onClick={handleRefreshStats}
              disabled={refreshingStats}
              className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#141f1f] hover:bg-[#1a2929] border border-[#1e2e2e] text-[#8ea8a8] hover:text-[#00d4aa] flex items-center gap-1.5 transition-all cursor-pointer"
              title="تحديث فوري للإحصائيات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingStats ? "animate-spin text-[#00d4aa]" : ""}`} />
              <span>تحديث</span>
            </button>

            <button
              onClick={handleResetStats}
              className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#141f1f] hover:bg-red-500/10 border border-[#1e2e2e] hover:border-red-500/30 text-[#4a7070] hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
              title="تصفير العدادات"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير</span>
            </button>
          </div>
        </div>

        {/* Primary Health & Total Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-[#0a0f0f] p-3 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#4a7070] block font-medium">إجمالي الاستدعاءات</span>
            <span className="text-base font-black text-[#00d4aa]">{stats.todayTotal || 0}</span>
          </div>
          <div className="bg-[#0a0f0f] p-3 rounded-xl border border-green-500/20">
            <span className="text-[10px] text-green-400/80 block font-medium">العمليات الناجحة</span>
            <span className="text-base font-extrabold text-green-400">{stats.successCount || 0}</span>
          </div>
          <div className="bg-[#0a0f0f] p-3 rounded-xl border border-red-500/20">
            <span className="text-[10px] text-red-400/80 block font-medium">عمليات التبديل / التعثر</span>
            <span className="text-base font-extrabold text-red-400">{stats.failCount || 0}</span>
          </div>
          <div className="bg-[#0a0f0f] p-3 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#0ea5e9] block font-medium">نسبة نجاح المنظومة</span>
            <span className="text-base font-black text-[#e8f5f5]">
              {stats.todayTotal && stats.todayTotal > 0
                ? `${Math.round(((stats.successCount || 0) / stats.todayTotal) * 100)}%`
                : "100%"}
            </span>
          </div>
        </div>

        {/* Per-Tool Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center pt-1">
          <div className="bg-[#0c1414] p-2.5 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#0ea5e9] block font-medium">Tavily</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{stats.tavily || 0}</span>
          </div>
          <div className="bg-[#0c1414] p-2.5 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#a855f7] block font-medium">Exa Neural</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{stats.exa || 0}</span>
          </div>
          <div className="bg-[#0c1414] p-2.5 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#eab308] block font-medium">Serper Google</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{stats.serper || 0}</span>
          </div>
          <div className="bg-[#0c1414] p-2.5 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#10b981] block font-medium">DuckDuckGo</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{stats.ddg || 0}</span>
          </div>
          <div className="bg-[#0c1414] p-2.5 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#f43f5e] block font-medium">Firecrawl</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{stats.firecrawl || 0}</span>
          </div>
          <div className="bg-[#0c1414] p-2.5 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#3b82f6] block font-medium">Jina Reader</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{stats.jina || 0}</span>
          </div>
          <div className="bg-[#0c1414] p-2.5 rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#00d4aa] block font-medium">الحاسبة & الأدوات</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{stats.calculator || 0}</span>
          </div>
        </div>

        {/* Live Operational Audit Logs Drawer */}
        {showLiveLogs && (
          <div className="mt-3 p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e] space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs text-[#8ea8a8] border-b border-[#1e2e2e] pb-2">
              <span className="font-semibold text-[#e8f5f5]">سجل أحدث العمليات والاستدعاءات الحية:</span>
              <span className="text-[10px] text-[#4a7070]">يتم تسجيل كافة استعلامات البحث وقراءة الروابط لحظياً</span>
            </div>

            {(!stats.recentLogs || stats.recentLogs.length === 0) ? (
              <div className="py-6 text-center text-xs text-[#4a7070]">
                لا توجد سجلات بعد. عند قيام المستخدم بالبحث في الويب أو قراءة الروابط ستظهر العمليات هنا فوراً.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {stats.recentLogs.slice(0, 15).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 p-2 bg-[#101717] rounded-lg border border-[#1a2626] text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-bold flex-shrink-0 ${
                          log.status === "success"
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : log.status === "fallback"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-red-500/15 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {log.status === "success" ? "ناجح" : log.status === "fallback" ? "تبديل" : "تعثر"}
                      </span>
                      <span className="text-[11px] font-bold text-[#e8f5f5] flex-shrink-0">
                        {log.toolName || log.tool}
                      </span>
                      <span className="text-[11px] text-[#8ea8a8] truncate max-w-[220px] sm:max-w-xs md:max-w-md">
                        {log.query || "-"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-[#4a7070]">
                      {log.latencyMs ? (
                        <span className="text-[#00d4aa]">{log.latencyMs}ms</span>
                      ) : null}
                      <span>{new Date(log.timestamp).toLocaleTimeString("ar-EG")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          <span>تمت عملية حفظ وقفل ترتيب ومفاتيح الأدوات بنجاح في Cloud Firestore وقواعد البيانات.</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* SECTION 1: SEARCH TOOLS FALLBACK CHAIN */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-[#1e2e2e]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#0ea5e9]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">تسلسل محركات البحث المباشر (Search Fallback Chain)</h3>
          </div>
          <span className="text-[10px] text-[#4a7070]">ترتيب الأولوية 1 ← 2 ← 3 ← 4</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {searchTools.map((tool) => (
            <ToolCardItem
              key={tool.id}
              tool={tool}
              toggleTool={toggleTool}
              changeRotationMode={changeRotationMode}
              shiftPriority={shiftPriority}
              updateKeyVal={updateKeyVal}
              addKeyToTool={addKeyToTool}
              deleteKeyFromTool={deleteKeyFromTool}
              testKey={testKey}
              verifyingKeys={verifyingKeys}
              verifyResults={verifyResults}
              showKeysMap={showKeysMap}
              toggleShowKey={toggleShowKey}
              maskKeyStr={maskKeyStr}
              getCategoryIcon={getCategoryIcon}
            />
          ))}
        </div>
      </div>

      {/* SECTION 2: URL READER TOOLS FALLBACK CHAIN */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between pb-1 border-b border-[#1e2e2e]">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#a855f7]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">أدوات قراءة وتفريغ الروابط والمواقع (URL Reader Fallback)</h3>
          </div>
          <span className="text-[10px] text-[#4a7070]">1. Firecrawl ← 2. Jina</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {readerTools.map((tool) => (
            <ToolCardItem
              key={tool.id}
              tool={tool}
              toggleTool={toggleTool}
              changeRotationMode={changeRotationMode}
              shiftPriority={shiftPriority}
              updateKeyVal={updateKeyVal}
              addKeyToTool={addKeyToTool}
              deleteKeyFromTool={deleteKeyFromTool}
              testKey={testKey}
              verifyingKeys={verifyingKeys}
              verifyResults={verifyResults}
              showKeysMap={showKeysMap}
              toggleShowKey={toggleShowKey}
              maskKeyStr={maskKeyStr}
              getCategoryIcon={getCategoryIcon}
            />
          ))}
        </div>
      </div>

      {/* SECTION 3: BUILT-IN & OTHER TOOLS */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between pb-1 border-b border-[#1e2e2e]">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#eab308]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">الأدوات المدمجة والنظام العام</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {otherTools.map((tool) => (
            <ToolCardItem
              key={tool.id}
              tool={tool}
              toggleTool={toggleTool}
              changeRotationMode={changeRotationMode}
              shiftPriority={shiftPriority}
              updateKeyVal={updateKeyVal}
              addKeyToTool={addKeyToTool}
              deleteKeyFromTool={deleteKeyFromTool}
              testKey={testKey}
              verifyingKeys={verifyingKeys}
              verifyResults={verifyResults}
              showKeysMap={showKeysMap}
              toggleShowKey={toggleShowKey}
              maskKeyStr={maskKeyStr}
              getCategoryIcon={getCategoryIcon}
            />
          ))}
        </div>
      </div>
    </>
    )}
  </div>
  );
}

// ==========================================
// TOOL CARD COMPONENT
// ==========================================
interface ToolCardProps {
  tool: ToolItem;
  toggleTool: (id: string) => void;
  changeRotationMode: (id: string, mode: "priority" | "round_robin") => void;
  shiftPriority: (id: string, dir: "up" | "down") => void;
  updateKeyVal: (toolId: string, keyId: string, val: string) => void;
  addKeyToTool: (toolId: string) => void;
  deleteKeyFromTool: (toolId: string, keyId: string) => void;
  testKey: (toolId: string, keyObj: ToolKeyItem) => void;
  verifyingKeys: Record<string, boolean>;
  verifyResults: Record<string, { valid: boolean; message: string }>;
  showKeysMap: Record<string, boolean>;
  toggleShowKey: (keyId: string) => void;
  maskKeyStr: (str: string) => string;
  getCategoryIcon: (cat: string) => React.ReactNode;
}

function ToolCardItem({
  tool,
  toggleTool,
  changeRotationMode,
  shiftPriority,
  updateKeyVal,
  addKeyToTool,
  deleteKeyFromTool,
  testKey,
  verifyingKeys,
  verifyResults,
  showKeysMap,
  toggleShowKey,
  maskKeyStr,
  getCategoryIcon,
}: ToolCardProps) {
  return (
    <div
      className={`glass-card p-5 rounded-2xl border transition-all relative ${
        tool.enabled ? "border-[#00d4aa]/40 glow-teal-active bg-[#0d1414]" : "border-[#1e2e2e] opacity-60 bg-[#080c0c]"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2e2e]">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-center flex-shrink-0">
            {getCategoryIcon(tool.category)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-[#e8f5f5]">{tool.name}</h4>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#111a1a] text-[#00d4aa] border border-[#1e2e2e] uppercase">
                {tool.category}
              </span>

              {tool.isFree ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  مجاني - لا يحتاج مفتاح
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#0ea5e9]/20 text-[#0ea5e9] border border-[#0ea5e9]/30">
                  أولوية الـ Fallback: #{tool.priority}
                </span>
              )}
            </div>

            {tool.description && <p className="text-[11px] text-[#4a7070] mt-1">{tool.description}</p>}
          </div>
        </div>

        {/* Priority buttons and Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!tool.isFree && (
            <div className="flex items-center bg-[#111a1a] rounded-xl border border-[#1e2e2e] p-0.5">
              <button
                type="button"
                onClick={() => shiftPriority(tool.id, "up")}
                className="p-1.5 text-[#4a7070] hover:text-[#00d4aa] transition-colors cursor-pointer"
                title="رفع أولوية الأداة"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => shiftPriority(tool.id, "down")}
                className="p-1.5 text-[#4a7070] hover:text-[#00d4aa] transition-colors cursor-pointer"
                title="تخفيض أولوية الأداة"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => toggleTool(tool.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tool.enabled
                ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/40"
                : "bg-[#111a1a] text-[#4a7070] border border-[#1e2e2e]"
            }`}
          >
            {tool.enabled ? <ToggleRight className="w-4 h-4 text-[#00d4aa]" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{tool.enabled ? "مُفعل" : "معطل"}</span>
          </button>
        </div>
      </div>

      {/* Free Tool Banner */}
      {tool.isFree ? (
        <div className="mt-3 p-3 rounded-xl bg-green-500/5 border border-green-500/20 text-[11px] text-green-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>NO API KEY REQUIRED — تعمل الأداة تلقائياً كـ Fallback مجاني ومباشر.</span>
          </div>
          <span className="text-[10px] text-green-400/80 font-mono">100% Guaranteed</span>
        </div>
      ) : (
        /* Multi-Keys Section */
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-[#00d4aa]" />
              <span className="text-xs font-bold text-[#e8f5f5]">مفاتيح الـ API المتاحة ({tool.keys?.length || 0}):</span>
            </div>

            {/* Rotation mode selector */}
            <div className="flex items-center gap-2 text-[10px] text-[#4a7070]">
              <span>نمط التدوير:</span>
              <select
                value={tool.rotationMode || "priority"}
                onChange={(e) => changeRotationMode(tool.id, e.target.value as any)}
                className="bg-[#111a1a] text-[#00d4aa] text-[10px] font-bold px-2 py-1 rounded-lg border border-[#1e2e2e] outline-none cursor-pointer"
              >
                <option value="priority">حسب الأولوية (Priority)</option>
                <option value="round_robin">تدوير متكافئ (Round Robin)</option>
              </select>
            </div>
          </div>

          {/* Keys list */}
          <div className="space-y-2">
            {(tool.keys || []).map((kObj, idx) => {
              const isTesting = verifyingKeys[kObj.id];
              const testRes = verifyResults[kObj.id];
              const showRaw = showKeysMap[kObj.id];

              return (
                <div
                  key={kObj.id}
                  className="bg-[#0a0f0f] p-3 rounded-xl border border-[#1e2e2e] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] font-mono text-[#4a7070] px-1.5 py-0.5 rounded bg-[#111a1a]">
                      مفتاح {idx + 1}
                    </span>

                    {/* Status Pill */}
                    {kObj.status === "active" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                        🟢 نشط
                      </span>
                    ) : kObj.status === "failed" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                        🔴 فشل ({kObj.failureReason || "تعدى المحاولات"})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        🟡 غير مفحوص
                      </span>
                    )}

                    {/* Input */}
                    <div className="relative flex-1">
                      <input
                        type={showRaw ? "text" : "password"}
                        value={kObj.key}
                        onChange={(e) => updateKeyVal(tool.id, kObj.id, e.target.value)}
                        placeholder="أدخل مفتاح الـ API..."
                        className="w-full bg-[#111a1a] text-xs font-mono text-[#00d4aa] px-3 py-1.5 pr-8 rounded-lg border border-[#1e2e2e] focus:border-[#00d4aa] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(kObj.id)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-[#4a7070] hover:text-[#e8f5f5] cursor-pointer"
                      >
                        {showRaw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => testKey(tool.id, kObj)}
                      disabled={isTesting || !kObj.key.trim()}
                      className="px-3 py-1.5 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#00d4aa] border border-[#00d4aa]/30 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTesting ? "animate-spin" : ""}`} />
                      <span>{isTesting ? "فحص..." : "فحص المفتاح"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteKeyFromTool(tool.id, kObj.id)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="حذف المفتاح"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {testRes && (
                    <div
                      className={`text-[10px] font-semibold w-full mt-1 ${
                        testRes.valid ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      نتيجة الفحص: {testRes.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => addKeyToTool(tool.id)}
            className="w-full py-2 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#00d4aa] border border-dashed border-[#00d4aa]/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ إضافة مفتاح آخر لـ {tool.name}</span>
          </button>
        </div>
      )}
    </div>
  );
}
