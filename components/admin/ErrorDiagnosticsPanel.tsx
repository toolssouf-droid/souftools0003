"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Wrench,
  ShieldCheck,
  Zap,
  Activity,
  Server,
  Bot,
  MessageSquare,
  Send,
  Database,
  Terminal,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  Flame,
  Check,
  Sparkles,
  Info,
  Layers,
  Copy,
  Sliders,
  ExternalLink,
} from "lucide-react";
import {
  ServerErrorRecord,
  ErrorDiagnosticsStats,
  ErrorCategory,
  ErrorSeverity,
  ErrorResolutionStatus,
} from "@/lib/errors/types";
import { getAuthCookie } from "@/lib/authCookies";

interface ErrorDiagnosticsPanelProps {
  initialRefreshInterval?: number;
}

export function ErrorDiagnosticsPanel({ initialRefreshInterval = 5000 }: ErrorDiagnosticsPanelProps) {
  const [errors, setErrors] = useState<ServerErrorRecord[]>([]);
  const [stats, setStats] = useState<ErrorDiagnosticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(initialRefreshInterval);

  // Helper for authenticated requests
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
    const headers: Record<string, string> = {};
    if (cookieData?.email) headers["x-user-email"] = cookieData.email;
    if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;
    return headers;
  }, []);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<"stream" | "remediation" | "simulate">("stream");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | "all">("all");
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorSeverity | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<ErrorResolutionStatus | "all">("all");

  // Expanded Stack Traces
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Action states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [globalFeedback, setGlobalFeedback] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (selectedSeverity !== "all") params.set("severity", selectedSeverity);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const headers = getAuthHeaders();
      const res = await fetch(`/api/admin/errors?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setErrors(data.errors || []);
          setStats(data.stats || null);
        }
      }
    } catch (err) {
      console.error("Failed to load server errors:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCategory, selectedSeverity, selectedStatus, searchQuery, getAuthHeaders]);

  // Initial load and filter change
  useEffect(() => {
    fetchDiagnostics(false);
  }, [fetchDiagnostics]);

  // Live Auto-Refresh Interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDiagnostics(true);
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchDiagnostics]);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleResolveError = async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/admin/errors/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "resolve", errorId: id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlobalFeedback({ type: "success", msg: "تم تحديد الخطأ كمحلول بنجاح." });
        fetchDiagnostics(true);
      } else {
        setGlobalFeedback({ type: "error", msg: data.error || "فشل تحديث حالة الخطأ." });
      }
    } catch (err: any) {
      setGlobalFeedback({ type: "error", msg: err.message || "خطأ اتصال" });
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
      setTimeout(() => setGlobalFeedback(null), 4000);
    }
  };

  const handleExecuteFix = async (errorIdOrAction: string, label: string) => {
    setActionLoading((prev) => ({ ...prev, [errorIdOrAction]: true }));
    try {
      const res = await fetch("/api/admin/errors/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "execute_fix", errorId: errorIdOrAction, fixType: errorIdOrAction }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlobalFeedback({ type: "success", msg: `✅ ${data.message || `تم تنفيذ إجراء: ${label}`}` });
        fetchDiagnostics(true);
      } else {
        setGlobalFeedback({ type: "error", msg: `❌ ${data.message || data.error || "فشل تنفيذ إجراء الإصلاح."}` });
      }
    } catch (err: any) {
      setGlobalFeedback({ type: "error", msg: err.message || "خطأ أثناء تنفيذ الإصلاح" });
    } finally {
      setActionLoading((prev) => ({ ...prev, [errorIdOrAction]: false }));
      setTimeout(() => setGlobalFeedback(null), 5000);
    }
  };

  const handleAiAnalyzeError = async (errorId: string) => {
    setActionLoading((prev) => ({ ...prev, [`ai_${errorId}`]: true }));
    try {
      const res = await fetch("/api/admin/errors/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "ai_analyze_error", errorId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlobalFeedback({
          type: "success",
          msg: "✨ تم إتمام التحليل الذكي للخطأ وتقديم التوصيات الهندسية الدقيقة عبر Gemini.",
        });
        fetchDiagnostics(true);
      } else {
        setGlobalFeedback({
          type: "error",
          msg: `تعذر تحليل الخطأ: ${data.error || "خطأ غير معروف"}`,
        });
      }
    } catch (err: any) {
      setGlobalFeedback({ type: "error", msg: err.message || "فشل الاتصال بالذكاء الاصطناعي" });
    } finally {
      setActionLoading((prev) => ({ ...prev, [`ai_${errorId}`]: false }));
      setTimeout(() => setGlobalFeedback(null), 5000);
    }
  };

  const handleResolveAll = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في تحديد جميع الأعطال غير المحلولة كمحلولة؟")) return;
    try {
      const res = await fetch("/api/admin/errors/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "resolve_all" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlobalFeedback({ type: "success", msg: `تم تحديد ${data.resolvedCount} خطأ كمحلول بنجاح.` });
        fetchDiagnostics(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearResolved = async () => {
    try {
      const res = await fetch("/api/admin/errors/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "clear_resolved" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlobalFeedback({ type: "info", msg: `تم تنظيف ${data.clearedCount} سجل محلول من الذاكرة.` });
        fetchDiagnostics(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateTestError = async (type: "critical_ai" | "gateway_timeout" | "api_500") => {
    try {
      const res = await fetch("/api/admin/errors/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "simulate_test_error", simulationType: type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlobalFeedback({ type: "success", msg: "تم توليد عطل اختباري ورصده حياً في النظام!" });
        setActiveTab("stream");
        fetchDiagnostics(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyDebugInfo = (item: ServerErrorRecord) => {
    const jsonStr = JSON.stringify(item, null, 2);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(jsonStr).catch(() => {
          fallbackCopyText(jsonStr);
        });
      } else {
        fallbackCopyText(jsonStr);
      }
    } catch {
      fallbackCopyText(jsonStr);
    }
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch (e) {
      console.warn("Fallback copy failed:", e);
    }
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify({ exportTime: new Date().toISOString(), stats, errors }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soufai-server-errors-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryIcon = (category: ErrorCategory) => {
    switch (category) {
      case "ai_engine":
        return <Bot className="w-4 h-4 text-[#00d4aa]" />;
      case "telegram":
        return <Send className="w-4 h-4 text-[#0088cc]" />;
      case "whatsapp":
        return <MessageSquare className="w-4 h-4 text-[#25D366]" />;
      case "database":
        return <Database className="w-4 h-4 text-amber-400" />;
      case "sandbox":
        return <Terminal className="w-4 h-4 text-purple-400" />;
      case "system":
        return <Server className="w-4 h-4 text-cyan-400" />;
      default:
        return <Activity className="w-4 h-4 text-blue-400" />;
    }
  };

  const getCategoryLabel = (category: ErrorCategory) => {
    switch (category) {
      case "ai_engine":
        return "محرك الذكاء (AI Engine)";
      case "telegram":
        return "بوابة تيليجرام (Telegram)";
      case "whatsapp":
        return "بوابة واتساب (WhatsApp)";
      case "database":
        return "قاعدة البيانات (Database)";
      case "sandbox":
        return "بيئة الكود (Sandbox)";
      case "system":
        return "نظام السيرفر (System Core)";
      default:
        return "مسار API / Network";
    }
  };

  const getSeverityBadge = (severity: ErrorSeverity) => {
    switch (severity) {
      case "critical":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            <span>حرج للغاية (Critical)</span>
          </span>
        );
      case "high":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>عالي التأثير (High)</span>
          </span>
        );
      case "medium":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>متوسط (Medium)</span>
          </span>
        );
      case "low":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>منخفض / معلوماتي (Low)</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: ErrorResolutionStatus) => {
    switch (status) {
      case "resolved":
      case "auto_resolved":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{status === "auto_resolved" ? "مُصلح تلقائياً" : "تم الإصلاح"}</span>
          </span>
        );
      case "investigating":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>قيد الفحص والتحليل</span>
          </span>
        );
      case "unresolved":
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>نشط بحاجة لمعالجة</span>
          </span>
        );
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `منذ ${diff} ثانية`;
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return `منذ ${Math.floor(diff / 86400)} يوم`;
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* 1. Master Header Banner & Live Stream Controls */}
      <div className="glass-panel p-6 rounded-3xl border border-[#1e2e2e] relative overflow-hidden bg-gradient-to-br from-[#121c1c] via-[#0d1414] to-[#080d0d]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00d4aa]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-500/20 via-[#00d4aa]/20 to-[#0088cc]/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-500/10">
              <Server className="w-7 h-7 text-[#00d4aa]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-[#e8f5f5]">
                  مركز تشخيص ومراقبة أخطاء السيرفر الحية (Runtime Error & Self-Healing Hub)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-[#00d4aa] animate-pulse" : "bg-gray-500"}`} />
                  <span>{autoRefresh ? "البث المباشر نشط" : "متوقف مؤقتاً"}</span>
                </span>
              </div>
              <p className="text-xs text-[#88b0b0] mt-1 leading-relaxed max-w-2xl">
                رصد فوري لجميع استثناءات الخادم، أعطال مزودي الذكاء الاصطناعي، انقطاعات واتساب وتيليجرام، مع أدوات الإصلاح التلقائي والتشخيص الذكي بنقرة واحدة.
              </p>
            </div>
          </div>

          {/* Quick Actions & Live Stream Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                autoRefresh
                  ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/40 hover:bg-[#00d4aa]/30"
                  : "bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e] hover:border-[#00d4aa]/40"
              }`}
              title="تشغيل / إيقاف التحديث التلقائي اللحظي"
            >
              <Activity className={`w-4 h-4 ${autoRefresh ? "animate-pulse" : ""}`} />
              <span>{autoRefresh ? "تحديث تلقائي (نشط)" : "تحديث يدوي"}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchDiagnostics(false)}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-[#111a1a] hover:bg-[#1a2626] text-[#e8f5f5] border border-[#1e2e2e] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#00d4aa]" : ""}`} />
              <span>تحديث الآن</span>
            </button>

            {/* Export JSON Button */}
            <button
              onClick={handleExportLogs}
              className="px-3.5 py-2 bg-[#111a1a] hover:bg-[#1a2626] text-[#88b0b0] hover:text-[#e8f5f5] border border-[#1e2e2e] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="تصدير سجل الأخطاء بصيغة JSON"
            >
              <Download className="w-4 h-4" />
              <span>تصدير السجل</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {globalFeedback && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
              globalFeedback.type === "success"
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300"
                : globalFeedback.type === "error"
                ? "bg-red-500/15 border border-red-500/40 text-red-300"
                : "bg-blue-500/15 border border-blue-500/40 text-blue-300"
            }`}
          >
            {globalFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : globalFeedback.type === "error" ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-blue-400" />
            )}
            <span>{globalFeedback.msg}</span>
          </div>
        )}
      </div>

      {/* 2. Real-time Telemetry & Health Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: System Health Score */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#88b0b0] font-bold block mb-1">
              معدل استقرار وصحة السيرفر
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-black font-mono ${
                  (stats?.systemHealthScore || 100) >= 90
                    ? "text-[#00d4aa]"
                    : (stats?.systemHealthScore || 100) >= 70
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {stats?.systemHealthScore || 100}%
              </span>
              <span className="text-[11px] text-[#4a7070]">
                {(stats?.systemHealthScore || 100) >= 90
                  ? "ممتاز ومستقر"
                  : (stats?.systemHealthScore || 100) >= 70
                  ? "تنبيه خفيف"
                  : "يحتاج فحص"}
              </span>
            </div>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
              (stats?.systemHealthScore || 100) >= 90
                ? "bg-[#00d4aa]/15 border-[#00d4aa]/40 text-[#00d4aa]"
                : (stats?.systemHealthScore || 100) >= 70
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                : "bg-red-500/15 border-red-500/40 text-red-400"
            }`}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Unresolved Critical & High Errors */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#88b0b0] font-bold block mb-1">
              أعطال نشطة غير محلولة
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-black font-mono ${
                  (stats?.unresolvedCount || 0) > 0 ? "text-red-400" : "text-[#00d4aa]"
                }`}
              >
                {stats?.unresolvedCount || 0}
              </span>
              <span className="text-[11px] text-[#4a7070]">
                {stats?.criticalCount ? `(${stats.criticalCount} حرج)` : "لا توجد أخطاء حرجة"}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Total 24h Recorded Events */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#88b0b0] font-bold block mb-1">
              إجمالي الاستثناءات (24 ساعة)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-[#e8f5f5]">
                {stats?.last24HoursCount || 0}
              </span>
              <span className="text-[11px] text-[#4a7070]">
                من أصل {stats?.totalErrorsRecorded || 0} مسجل
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#0088cc]/15 border border-[#0088cc]/30 flex items-center justify-center text-[#0088cc]">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Successfully Resolved */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#88b0b0] font-bold block mb-1">
              الأعطال التي تم إصلاحها
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-400">
                {stats?.resolvedCount || 0}
              </span>
              <span className="text-[11px] text-[#4a7070]">
                إصلاح يدوي وتلقائي
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1e2e2e] pb-3 overflow-x-auto">
        {[
          { id: "stream", label: "سجل الأعطال الحية والتتبع (Error Stream)", icon: Activity },
          { id: "remediation", label: "أدوات الإصلاح السريع والفحص الذاتي (Self-Healing Suite)", icon: Wrench },
          { id: "simulate", label: "محاكي الأعطال واختبار الإنذار (Error Simulator)", icon: Zap },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#00d4aa] text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/20 font-black"
                  : "bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e] hover:border-[#00d4aa]/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: LIVE ERROR STREAM ================= */}
      {activeTab === "stream" && (
        <div className="space-y-4">
          {/* Search, Filter Bar & Bulk Actions */}
          <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] bg-[#0d1414] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#4a7070] absolute right-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث في نص الخطأ، المسار، أو المزود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 bg-[#111a1a] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-2.5 text-xs text-[#4a7070] hover:text-white"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Filter Selects */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="px-3 py-2 bg-[#111a1a] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
              >
                <option value="all">كل الأقسام</option>
                <option value="ai_engine">محرك الذكاء (AI)</option>
                <option value="telegram">تيليجرام (Telegram)</option>
                <option value="whatsapp">واتساب (WhatsApp)</option>
                <option value="api_route">مسارات API</option>
                <option value="system">نظام السيرفر</option>
                <option value="sandbox">Sandbox</option>
              </select>

              {/* Severity Filter */}
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value as any)}
                className="px-3 py-2 bg-[#111a1a] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
              >
                <option value="all">كل درجات الخطورة</option>
                <option value="critical">حرج (Critical)</option>
                <option value="high">عالي (High)</option>
                <option value="medium">متوسط (Medium)</option>
                <option value="low">منخفض (Low)</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="px-3 py-2 bg-[#111a1a] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
              >
                <option value="all">كل الحالات</option>
                <option value="unresolved">غير محلول (نشط)</option>
                <option value="resolved">تم الإصلاح</option>
                <option value="investigating">قيد الفحص</option>
              </select>

              {/* Bulk Resolve Action */}
              <button
                onClick={handleResolveAll}
                className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="تحديد كافة الأعطال النشطة كمحلولة"
              >
                <Check className="w-3.5 h-3.5" />
                <span>إصلاح الكل</span>
              </button>

              {/* Clear History */}
              <button
                onClick={handleClearResolved}
                className="px-3 py-2 bg-[#111a1a] hover:bg-red-500/10 text-[#88b0b0] hover:text-red-400 border border-[#1e2e2e] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="مسح الأخطاء المحلولة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تنظيف السجلات</span>
              </button>
            </div>
          </div>

          {/* Errors List Container */}
          {loading ? (
            <div className="glass-panel p-12 rounded-3xl border border-[#1e2e2e] flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-8 h-8 text-[#00d4aa] animate-spin" />
              <p className="text-xs text-[#88b0b0]">جاري فحص وتحديث سجلات أخطاء السيرفر...</p>
            </div>
          ) : errors.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl border border-[#1e2e2e] text-center space-y-4 bg-[#0a0f0f]">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#e8f5f5]">
                السيرفر يعمل بكفاءة ونقاء 100% بدون أي أخطاء نشطة
              </h3>
              <p className="text-xs text-[#88b0b0] max-w-md mx-auto leading-relaxed">
                لم يتم تسجيل أي استثناءات مطابقة للفلاتر المحددة. جميع مسارات الـ API وخدمات الذكاء الاصطناعي والبوابات تعمل بحالة ممتازة.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map((item) => {
                const isExpanded = !!expandedCards[item.id];
                const isLoadingAction = !!actionLoading[item.id];

                return (
                  <div
                    key={item.id}
                    className={`glass-panel p-5 rounded-2xl border transition-all ${
                      item.status === "resolved" || item.status === "auto_resolved"
                        ? "border-emerald-500/30 bg-[#08120e]/60 opacity-80"
                        : item.severity === "critical"
                        ? "border-red-500/50 bg-gradient-to-r from-red-500/10 via-[#0d1414] to-[#0d1414]"
                        : item.severity === "high"
                        ? "border-orange-500/40 bg-gradient-to-r from-orange-500/10 via-[#0d1414] to-[#0d1414]"
                        : "border-[#1e2e2e] bg-[#0c1414]"
                    }`}
                  >
                    {/* Top Row: Title, Badges, Category, Timestamp */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] shrink-0 mt-0.5">
                          {getCategoryIcon(item.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-extrabold text-[#e8f5f5]">
                              {item.title}
                            </h4>
                            {item.occurrencesCount > 1 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                                تكرر {item.occurrencesCount}×
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-[#4a7070] flex-wrap">
                            <span className="flex items-center gap-1 text-[#88b0b0]">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimeAgo(item.lastOccurredAt)}</span>
                            </span>
                            <span>•</span>
                            <span>{getCategoryLabel(item.category)}</span>
                            {item.endpoint && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[#88b0b0] bg-[#111a1a] px-2 py-0.5 rounded">
                                  {item.method ? `${item.method} ` : ""}
                                  {item.endpoint}
                                </span>
                              </>
                            )}
                            {item.providerId && (
                              <>
                                <span>•</span>
                                <span className="text-[#00d4aa]">
                                  مزود: {item.providerId} {item.modelId ? `(${item.modelId})` : ""}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Badges & Quick Action Controls */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {getSeverityBadge(item.severity)}
                        {getStatusBadge(item.status)}

                        {/* AI Deep Analysis Button */}
                        <button
                          onClick={() => handleAiAnalyzeError(item.id)}
                          disabled={!!actionLoading[`ai_${item.id}`]}
                          className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="تحليل عميق عبر Gemini مع تحديد السبب الجذري وخطوات الإصلاح"
                        >
                          {actionLoading[`ai_${item.id}`] ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          <span>استشارة الذكاء الاصطناعي</span>
                        </button>

                        {/* 1-Click Auto Remediation Button */}
                        {item.status !== "resolved" && item.status !== "auto_resolved" && (
                          <button
                            onClick={() => handleExecuteFix(item.id, item.suggestedFix)}
                            disabled={isLoadingAction}
                            className="px-3.5 py-1.5 bg-[#00d4aa] text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-[#00b894] transition-all flex items-center gap-1.5 shadow-md shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50"
                          >
                            {isLoadingAction ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wrench className="w-3.5 h-3.5" />
                            )}
                            <span>إصلاح الآن</span>
                          </button>
                        )}

                        {/* Mark As Resolved Toggle */}
                        {item.status !== "resolved" && item.status !== "auto_resolved" && (
                          <button
                            onClick={() => handleResolveError(item.id)}
                            disabled={isLoadingAction}
                            className="px-3 py-1.5 bg-[#111a1a] hover:bg-emerald-500/20 text-emerald-400 border border-[#1e2e2e] hover:border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="تعليم كمحلول يدوياً"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>محلول</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Raw Error Message */}
                    <div className="mt-3 p-3 rounded-xl bg-[#090e0e] border border-[#182626] font-mono text-xs text-red-300 break-all text-left" dir="ltr">
                      {item.message}
                    </div>

                    {/* AI & Heuristic Diagnosis & Suggested Fix Box */}
                    <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-[#00d4aa]/10 via-[#111a1a] to-[#111a1a] border border-[#00d4aa]/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#00d4aa]">
                        <Sparkles className="w-4 h-4 text-[#00d4aa]" />
                        <span>تشخيص العطل والحل المقترح:</span>
                      </div>
                      <p className="text-xs text-[#e8f5f5] leading-relaxed">
                        {item.diagnosis}
                      </p>
                      <div className="text-xs text-[#88b0b0] bg-[#0c1414] p-2.5 rounded-lg border border-[#1e2e2e] mt-1">
                        <strong className="text-[#00d4aa]">الإجراء الموصى به:</strong> {item.suggestedFix}
                      </div>
                    </div>

                    {/* Gemini Deep AI Analysis Box */}
                    {item.aiAnalysis && (
                      <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-[#0a121e]/80 to-[#0e1726]/60 border border-indigo-500/30 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-black text-indigo-300">
                            <Bot className="w-4 h-4 text-indigo-400" />
                            <span>تقرير التحليل الذكي التخصصي (Gemini Deep Diagnostics):</span>
                          </div>
                          <span className="text-[10px] text-indigo-400/80 font-mono">
                            {formatTimeAgo(item.aiAnalysis.analyzedAt)}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="font-bold text-amber-300">السبب الجذري: </span>
                            <span className="text-gray-200">{item.aiAnalysis.rootCause}</span>
                          </div>
                          <div>
                            <span className="font-bold text-sky-300">التأثير التشغيلي: </span>
                            <span className="text-gray-300">{item.aiAnalysis.impact}</span>
                          </div>
                        </div>

                        {item.aiAnalysis.steps && item.aiAnalysis.steps.length > 0 && (
                          <div className="pt-2 border-t border-indigo-500/20">
                            <span className="text-[11px] font-bold text-indigo-200 block mb-1">
                              خطوات المعالجة والحل المقترحة:
                            </span>
                            <ul className="space-y-1 text-xs text-gray-300">
                              {item.aiAnalysis.steps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono">
                                    {idx + 1}
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {item.aiAnalysis.suggestedAction && (
                          <div className="p-2 rounded-lg bg-indigo-900/30 border border-indigo-500/30 text-xs text-indigo-200">
                            <strong>الإجراء الفوري: </strong> {item.aiAnalysis.suggestedAction}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stack Trace & Debug Details Toggle */}
                    <div className="mt-3 pt-3 border-t border-[#182626] flex items-center justify-between text-xs text-[#88b0b0]">
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer font-bold"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>{isExpanded ? "إخفاء تفاصيل التتبع (Stack Trace)" : "عرض تفاصيل التتبع الهندسي الكامل"}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyDebugInfo(item)}
                          className="px-2.5 py-1 bg-[#111a1a] hover:bg-[#1a2626] text-[#88b0b0] hover:text-[#e8f5f5] rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-[#1e2e2e]"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#00d4aa]" />
                              <span className="text-[#00d4aa]">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ تقرير الخطأ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Debug Trace Box */}
                    {isExpanded && (
                      <div className="mt-3 p-4 rounded-xl bg-[#060909] border border-[#182626] space-y-2 animate-fade-in font-mono text-[11px]" dir="ltr">
                        <div className="text-[#88b0b0] font-bold text-xs">Error Stack Trace:</div>
                        <pre className="text-red-400 overflow-x-auto p-2 bg-[#0a0f0f] rounded-lg leading-relaxed whitespace-pre-wrap">
                          {item.stackTrace || "No detailed stack trace available for this record."}
                        </pre>
                        {item.metadata && (
                          <>
                            <div className="text-[#88b0b0] font-bold text-xs pt-2">Additional Metadata:</div>
                            <pre className="text-cyan-300 overflow-x-auto p-2 bg-[#0a0f0f] rounded-lg">
                              {JSON.stringify(item.metadata, null, 2)}
                            </pre>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: SELF-HEALING & REMEDIATION SUITE ================= */}
      {activeTab === "remediation" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Tool 1: Reset AI Key Quarantines */}
          <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa]">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-[#e8f5f5]">
                رفع الحظر والتهدئة عن مفاتيح AI (Reset Key Quarantine)
              </h3>
              <p className="text-xs text-[#88b0b0] leading-relaxed">
                يقوم بإلغاء فترات التهدئة المؤقتة (3m/15m/1h) وإعادة تفعيل جميع المفاتيح والنماذج المحظورة فوراً في الذاكرة.
              </p>
            </div>
            <button
              onClick={() => handleExecuteFix("reset_key_quarantine", "رفع الحظر عن المفاتيح")}
              disabled={actionLoading["reset_key_quarantine"]}
              className="w-full py-2.5 bg-[#00d4aa] text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-[#00b894] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50"
            >
              {actionLoading["reset_key_quarantine"] ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>تطبيق رفع الحظر الآن</span>
            </button>
          </div>

          {/* Tool 2: Restart Telegram Polling */}
          <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-[#0088cc]/15 border border-[#0088cc]/30 flex items-center justify-center text-[#0088cc]">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-[#e8f5f5]">
                إعادة تشغيل سحب تيليجرام (Restart Telegram Polling)
              </h3>
              <p className="text-xs text-[#88b0b0] leading-relaxed">
                يقوم بإعادة تشغيل خدمة السحب المباشر للرسائل الواردة لضمان استلام جميع التحديثات فوراً بدون انقطاع.
              </p>
            </div>
            <button
              onClick={() => handleExecuteFix("restart_telegram_polling", "إعادة تشغيل سحب تيليجرام")}
              disabled={actionLoading["restart_telegram_polling"]}
              className="w-full py-2.5 bg-[#0088cc] text-white rounded-xl text-xs font-black hover:bg-[#0077b5] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#0088cc]/20 cursor-pointer disabled:opacity-50"
            >
              {actionLoading["restart_telegram_polling"] ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>إعادة تشغيل البث المباشر</span>
            </button>
          </div>

          {/* Tool 3: Clean WhatsApp Sockets */}
          <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-[#25D366]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-[#e8f5f5]">
                تنظيف مقبس وجلسة واتساب (Clean WhatsApp Sockets)
              </h3>
              <p className="text-xs text-[#88b0b0] leading-relaxed">
                يقوم بمسح اتصالات Baileys المعلقة وإعادة تهيئة الـ WebSocket للسماح بالاقتران النظيف برقم الهاتف أو QR.
              </p>
            </div>
            <button
              onClick={() => handleExecuteFix("clear_wa_socket", "تنظيف جلسة واتساب")}
              disabled={actionLoading["clear_wa_socket"]}
              className="w-full py-2.5 bg-[#25D366] text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-[#20ba59] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/20 cursor-pointer disabled:opacity-50"
            >
              {actionLoading["clear_wa_socket"] ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>تنظيف الجلسات وإعادة الضبط</span>
            </button>
          </div>

          {/* Tool 4: Test Gemini Live Connection */}
          <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-[#e8f5f5]">
                اختبار اتصال محرك Google Gemini (Probe Gemini Engine)
              </h3>
              <p className="text-xs text-[#88b0b0] leading-relaxed">
                يرسل اختبار نبض لحظي للتأكد من وصول السيرفر إلى Gemini API وصلاحية المفتاح وسرعة الاستجابة.
              </p>
            </div>
            <button
              onClick={() => handleExecuteFix("test_gemini_connection", "فحص اتصال Gemini")}
              disabled={actionLoading["test_gemini_connection"]}
              className="w-full py-2.5 bg-cyan-500 text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-cyan-400 transition-all flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
            >
              {actionLoading["test_gemini_connection"] ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>إرسال فحص الاتصال الحي</span>
            </button>
          </div>

          {/* Tool 5: Flush Cache & Store State */}
          <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-[#e8f5f5]">
                تفريغ الذاكرة المؤقتة (Flush Memory Cache)
              </h3>
              <p className="text-xs text-[#88b0b0] leading-relaxed">
                يقوم بتنظيف الكاش المؤقت وعدادات الفشل القديمة لإعادة تشغيل الطلبات بنقاء كامل.
              </p>
            </div>
            <button
              onClick={() => handleExecuteFix("flush_cache", "تفريغ الذاكرة المؤقتة")}
              disabled={actionLoading["flush_cache"]}
              className="w-full py-2.5 bg-amber-500 text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              {actionLoading["flush_cache"] ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>تفريغ الكاش الآن</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: ERROR INJECTION & SIMULATOR ================= */}
      {activeTab === "simulate" && (
        <div className="glass-panel p-6 rounded-3xl border border-[#1e2e2e] bg-[#0c1414] space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-[#e8f5f5] flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>محاكي الأعطال واختبار سرعة استجابة الإنذار</span>
            </h3>
            <p className="text-xs text-[#88b0b0] mt-1 leading-relaxed">
              يمكنك محاكاة وتوليد أعطال برمجية تجريبية للتحقق من أن نظام الرصد الفوري والتشخيص الذكي يعمل ويلتقط الأخطاء فورياً.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => handleSimulateTestError("critical_ai")}
              className="p-5 rounded-2xl bg-[#111a1a] hover:bg-[#1a2626] border border-orange-500/30 hover:border-orange-500 text-right space-y-2 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400">عطل مزود الذكاء 429</span>
                <Bot className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-[#88b0b0]">
                محاكاة خطأ تجاوز سعة الاستهلاك (Rate Limit) لدى مزود الذكاء وتفعيل التدوير التلقائي.
              </p>
            </button>

            <button
              onClick={() => handleSimulateTestError("gateway_timeout")}
              className="p-5 rounded-2xl bg-[#111a1a] hover:bg-[#1a2626] border border-blue-500/30 hover:border-blue-500 text-right space-y-2 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400">انقطاع شبكي تيليجرام</span>
                <Send className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-[#88b0b0]">
                محاكاة انقطاع الاتصال ببوابة تيليجرام واختبار إعادة الربط التلقائي عبر Polling.
              </p>
            </button>

            <button
              onClick={() => handleSimulateTestError("api_500")}
              className="p-5 rounded-2xl bg-[#111a1a] hover:bg-[#1a2626] border border-red-500/30 hover:border-red-500 text-right space-y-2 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400">استثناء غير معالج API 500</span>
                <Flame className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-[#88b0b0]">
                محاكاة خطأ برمجي في معالجة طلبات الـ API واختبار التقاط الـ Stack Trace الكامل.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
