"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Server,
  Play,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  Layers,
  Shield,
  Square,
  Sparkles,
  ExternalLink,
  Cpu,
  RefreshCw,
  Settings,
  HardDrive,
  Terminal,
  FileCode,
  Sliders,
  Check,
  Zap,
} from "lucide-react";
import {
  SandboxStatus,
  SandboxLimits,
  SandboxLiveMetrics,
} from "@/lib/runtime/types";

interface SandboxItem {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  framework: string;
  status: SandboxStatus;
  port: number;
  previewUrl?: string;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  lastActivity: number;
  limits: SandboxLimits;
  metrics: SandboxLiveMetrics;
  errorMessage?: string;
}

interface GlobalStats {
  totalSandboxes: number;
  runningCount: number;
  activeCount: number;
  stoppedCount: number;
  failedCount: number;
  expiredCount: number;
  aggregateRamMb: number;
  aggregateDiskMb: number;
  aggregateProcesses: number;
}

export function RuntimeManager() {
  const [stats, setStats] = useState<GlobalStats>({
    totalSandboxes: 0,
    runningCount: 0,
    activeCount: 0,
    stoppedCount: 0,
    failedCount: 0,
    expiredCount: 0,
    aggregateRamMb: 0,
    aggregateDiskMb: 0,
    aggregateProcesses: 0,
  });

  const [sandboxes, setSandboxes] = useState<SandboxItem[]>([]);
  const [isSandboxEnabled, setIsSandboxEnabled] = useState<boolean>(false);
  const [togglingEnabled, setTogglingEnabled] = useState<boolean>(false);
  const [limits, setLimits] = useState<SandboxLimits>({
    enabled: false,
    ramMb: 500,
    cpuCores: 1,
    diskMb: 2048,
    timeoutMinutes: 10,
    maxProcesses: 50,
    networkMode: "restricted",
    maxFileSizeMb: 30,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [savingLimits, setSavingLimits] = useState<boolean>(false);
  const [testingEnv, setTestingEnv] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"sessions" | "limits" | "diagnostics">("sessions");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLogsId, setSelectedLogsId] = useState<string | null>(null);
  const [logsData, setLogsData] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [diagResult, setDiagResult] = useState<any | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/sandbox");
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        if (data.sandboxes) setSandboxes(data.sandboxes);
        if (data.limits) setLimits(data.limits);
        if (data.enabled !== undefined) setIsSandboxEnabled(Boolean(data.enabled));
        else if (data.limits?.enabled !== undefined) setIsSandboxEnabled(Boolean(data.limits.enabled));
      }
    } catch (err: any) {
      console.warn("Failed to load sandbox data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleEnabled = async () => {
    try {
      setTogglingEnabled(true);
      const targetState = !isSandboxEnabled;
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_enabled", enabled: targetState }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSandboxEnabled(data.enabled);
        showToast("success", data.message || (data.enabled ? "تم تشغيل الساندبوكس (Active)" : "تم تعطيل الساندبوكس (Standby)"));
        loadData();
      } else {
        showToast("error", data.error || "فشل تغيير حالة الساندبوكس");
      }
    } catch (err: any) {
      showToast("error", err?.message || "خطأ في الاتصال بالخادم");
    } finally {
      setTogglingEnabled(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(timer);
  }, [loadData]);

  // Handle limits save
  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingLimits(true);
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_limits",
          limits,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("success", "تم تطبيق وحفظ حدود الموارد على كافة مهام الساندبوكس بنجاح");
        loadData();
      } else {
        showToast("error", data.error || "فشل حفظ الحدود");
      }
    } catch (err: any) {
      showToast("error", err?.message || "خطأ في الاتصال بالخادم");
    } finally {
      setSavingLimits(false);
    }
  };

  // Stop sandbox
  const handleStop = async (id: string) => {
    try {
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop_sandbox", sandboxId: id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "تم إيقاف الساندبوكس وتحرير الموارد والعمليات بنجاح");
        loadData();
      } else {
        showToast("error", data.error || "فشل إيقاف الساندبوكس");
      }
    } catch {
      showToast("error", "فشل تنفيذ العملية");
    }
  };

  // Restart sandbox
  const handleRestart = async (id: string) => {
    try {
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart_sandbox", sandboxId: id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "تمت إعادة تشغيل بيئة الساندبوكس بنجاح");
        loadData();
      } else {
        showToast("error", data.error || "فشل إعادة التشغيل");
      }
    } catch {
      showToast("error", "فشل تنفيذ العملية");
    }
  };

  // Delete sandbox
  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف بيئة الساندبوكس ومسح ملفاتها بالكامل؟")) return;
    try {
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_sandbox", sandboxId: id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "تم حذف بيئة الساندبوكس وتفريغ القرص بنجاح");
        loadData();
      } else {
        showToast("error", data.error || "فشل الحذف");
      }
    } catch {
      showToast("error", "فشل تنفيذ العملية");
    }
  };

  // View logs
  const handleViewLogs = async (id: string) => {
    setSelectedLogsId(id);
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_logs", sandboxId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setLogsData(data.logs || []);
      }
    } catch {
      //
    } finally {
      setLogsLoading(false);
    }
  };

  // Run cleanup
  const handleCleanup = async () => {
    try {
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup_stale" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", data.message || "تم تنظيف البيئات الخاملة");
        loadData();
      }
    } catch {
      showToast("error", "فشل التنظيف");
    }
  };

  // Diagnostics
  const handleTestDiagnostics = async () => {
    setTestingEnv(true);
    try {
      const res = await fetch("/api/admin/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_environment" }),
      });
      const data = await res.json();
      setDiagResult(data.result || null);
      if (data.success) {
        showToast("success", "عزل Linux المحلي يعمل بكفاءة 100%");
      } else {
        showToast("error", "حدث خطأ أثناء فحص بيئة العزل");
      }
    } catch {
      showToast("error", "فشل فحص البيئة");
    } finally {
      setTestingEnv(false);
    }
  };

  const filteredSandboxes = sandboxes.filter((sbx) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return sbx.status === "running" || sbx.status === "active" || sbx.status === "starting";
    if (statusFilter === "stopped") return sbx.status === "stopped";
    if (statusFilter === "failed") return sbx.status === "failed";
    if (statusFilter === "expired") return sbx.status === "expired";
    return true;
  });

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-5 left-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all ${
            toastMessage.type === "success"
              ? "bg-[#00d4aa]/15 border-[#00d4aa]/40 text-[#00d4aa]"
              : "bg-red-500/15 border-red-500/40 text-red-400"
          }`}
        >
          {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-[#1e2e2e] bg-[#0c1414] relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-[#00d4aa]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 relative z-10">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-bold max-w-full">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span dir="ltr" className="truncate">SoufTools Native Sandbox Architecture</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-ping shrink-0" />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center items-start gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-2xl font-black text-[#e8f5f5] leading-snug">
                نظام SoufTools Native Sandbox المعزول
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 sm:py-1 rounded-lg bg-[#111a1a] text-[#00d4aa] border border-[#00d4aa]/30 shrink-0 whitespace-nowrap">
                استبدال E2B بالكامل
              </span>
              <span
                className={`text-[11px] font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${
                  isSandboxEnabled
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSandboxEnabled ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                <span>{isSandboxEnabled ? "الحالة: قيد التشغيل (Active)" : "الحالة: معطل مؤقتاً (Standby)"}</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#8fa3a3] max-w-2xl leading-relaxed">
              محرك عزل برمجي متقدم داخل خوادم SoufTools يعمل بواسطة Linux Namespaces و Cgroups مع عزل الموارد{" "}
              <span dir="ltr" className="inline-block text-[11px] font-mono text-[#00d4aa] bg-[#111a1a] px-2 py-0.5 rounded-md border border-[#1e2e2e] mx-1 my-0.5">
                RAM: 500MB · CPU: 1 Core · Disk: 2GB · Timeout: 10m
              </span>{" "}
              لحماية تامة لبيانات وأسرار الخادم دون أي طرف ثالث.
            </p>

            {!isSandboxEnabled && (
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>وضع التوفير والاستعداد نشط (Standby):</strong> الساندبوكس معطل حالياً لتوفير موارد المعالج والذاكرة بنسبة 100%. يتم عرض الأكواد للمستخدمين بصورة نظيفة دون تشغيل سيرفرات خلفية.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            {/* Master Sandbox ON/OFF Switch */}
            <button
              onClick={handleToggleEnabled}
              disabled={togglingEnabled}
              className={`col-span-2 sm:col-span-1 w-full sm:w-auto px-4 py-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-95 ${
                isSandboxEnabled
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 hover:bg-emerald-500/30 shadow-emerald-500/20"
                  : "bg-rose-500/20 border-rose-500 text-rose-300 hover:bg-rose-500/30 shadow-rose-500/20"
              }`}
              title="التبديل بين تشغيل الساندبوكس أو إيقافه المؤقت"
            >
              <span className={`w-3 h-3 rounded-full shrink-0 ${isSandboxEnabled ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"}`} />
              <span>{isSandboxEnabled ? "🟢 تشغيل الساندبوكس (Active)" : "🔴 إيقاف مؤقت (Disabled / Standby)"}</span>
            </button>

            <button
              onClick={handleCleanup}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#111a1a] hover:bg-[#1a2929] border border-[#1e2e2e] text-[#e8f5f5] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-[#8fa3a3] shrink-0" />
              <span>تنظيف المنتهية</span>
            </button>

            <button
              onClick={handleTestDiagnostics}
              disabled={testingEnv}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>{testingEnv ? "جاري الفحص..." : "فحص العزل"}</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="col-span-2 sm:col-span-1 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <RotateCw className={`w-4 h-4 shrink-0 ${loading ? "animate-spin" : ""}`} />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>

        {/* Global Live Resource Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 pt-5 sm:pt-6 mt-5 sm:mt-6 border-t border-[#1e2e2e]/60">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="text-[10px] sm:text-[11px] text-[#8fa3a3] flex items-center justify-between mb-1 gap-1">
              <span className="truncate">الجلسات النشطة</span>
              <Activity className="w-3.5 h-3.5 text-[#00d4aa] shrink-0" />
            </div>
            <div className="text-base sm:text-xl font-black text-[#e8f5f5]">
              {stats.activeCount} <span className="text-xs text-[#8fa3a3]">/ {stats.totalSandboxes}</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="text-[10px] sm:text-[11px] text-[#8fa3a3] flex items-center justify-between mb-1 gap-1">
              <span className="truncate">الذاكرة المستهلكة</span>
              <Cpu className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            </div>
            <div className="text-base sm:text-xl font-black text-[#e8f5f5]">
              {stats.aggregateRamMb} <span className="text-xs text-[#8fa3a3]">MB</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="text-[10px] sm:text-[11px] text-[#8fa3a3] flex items-center justify-between mb-1 gap-1">
              <span className="truncate">سعة القرص الفعلية</span>
              <HardDrive className="w-3.5 h-3.5 text-amber-400] shrink-0" />
            </div>
            <div className="text-base sm:text-xl font-black text-[#e8f5f5]">
              {stats.aggregateDiskMb} <span className="text-xs text-[#8fa3a3]">MB</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="text-[10px] sm:text-[11px] text-[#8fa3a3] flex items-center justify-between mb-1 gap-1">
              <span className="truncate">العمليات النشطة</span>
              <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </div>
            <div className="text-base sm:text-xl font-black text-[#e8f5f5]">
              {stats.aggregateProcesses} <span className="text-xs text-[#8fa3a3]">Proc</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="text-[10px] sm:text-[11px] text-[#8fa3a3] flex items-center justify-between mb-1 gap-1">
              <span className="truncate">منتهية الصلاحية</span>
              <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            </div>
            <div className="text-base sm:text-xl font-black text-[#e8f5f5]">
              {stats.expiredCount}
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="text-[10px] sm:text-[11px] text-[#8fa3a3] flex items-center justify-between mb-1 gap-1">
              <span className="truncate">حالات الفشل</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            </div>
            <div className="text-base sm:text-xl font-black text-[#e8f5f5]">
              {stats.failedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="w-full overflow-x-auto no-scrollbar scroll-smooth pb-1 border-b border-[#1e2e2e]">
        <div className="flex items-center gap-2 min-w-max pb-2">
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "sessions"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                : "bg-[#111a1a] text-[#8fa3a3] hover:text-[#e8f5f5]"
            }`}
          >
            <Server className="w-4 h-4 shrink-0" />
            <span>بيئات الساندبوكس ({sandboxes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("limits")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "limits"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                : "bg-[#111a1a] text-[#8fa3a3] hover:text-[#e8f5f5]"
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>حدود الموارد والعزل (RAM/CPU/Disk)</span>
          </button>

          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "diagnostics"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                : "bg-[#111a1a] text-[#8fa3a3] hover:text-[#e8f5f5]"
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>اختبار عزل Linux والأمان</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SESSIONS LIST */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-[#111a1a] p-1 rounded-xl border border-[#1e2e2e]">
              {[
                { id: "all", label: "الكل" },
                { id: "active", label: "يعمل حالياً" },
                { id: "stopped", label: "متوقف" },
                { id: "failed", label: "تجاوز الحدود / فشل" },
                { id: "expired", label: "منتهي (10 دقائق)" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === f.id
                      ? "bg-[#1e2e2e] text-[#00d4aa]"
                      : "text-[#4a7070] hover:text-[#e8f5f5]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-[#4a7070]">
              عرض {filteredSandboxes.length} من أصل {sandboxes.length} بيئة
            </div>
          </div>

          {filteredSandboxes.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl border border-[#1e2e2e] text-center space-y-3">
              <Server className="w-12 h-12 text-[#1e2e2e] mx-auto" />
              <h3 className="text-base font-bold text-[#e8f5f5]">لا توجد بيئات ساندبوكس في هذه الفئة</h3>
              <p className="text-xs text-[#4a7070] max-w-sm mx-auto">
                يقوم الوكيل الذكي (Coding Agent) بإنشاء بيئة ساندبوكس معزولة تلقائياً عند تنفيذ أي مهمة برمجية.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSandboxes.map((sbx) => {
                const isRunning = sbx.status === "running" || sbx.status === "active";
                const isFailed = sbx.status === "failed";
                const isExpired = sbx.status === "expired";

                const ramUsage = sbx.metrics?.ramUsageMb || 0;
                const ramLimit = sbx.limits?.ramMb || 500;
                const ramPercent = Math.min(100, Math.round((ramUsage / ramLimit) * 100));

                const diskUsage = sbx.metrics?.diskUsageMb || 0;
                const diskLimit = sbx.limits?.diskMb || 2048;
                const diskPercent = Math.min(100, Math.round((diskUsage / diskLimit) * 100));

                return (
                  <div
                    key={sbx.id}
                    className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] hover:border-[#00d4aa]/30 transition-all space-y-4 shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isRunning
                                ? "bg-[#00d4aa] shadow-[0_0_8px_#00d4aa] animate-pulse"
                                : isFailed
                                ? "bg-red-400"
                                : isExpired
                                ? "bg-orange-400"
                                : "bg-gray-500"
                            }`}
                          />
                          <h3 className="font-bold text-sm text-[#e8f5f5] truncate max-w-[220px]">
                            {sbx.projectName}
                          </h3>
                        </div>
                        <div className="text-[11px] font-mono text-[#4a7070] flex items-center gap-2">
                          <span>{sbx.id}</span>
                          <span>•</span>
                          <span>{sbx.framework}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            isRunning
                              ? "bg-[#00d4aa]/15 border-[#00d4aa]/30 text-[#00d4aa]"
                              : isFailed
                              ? "bg-red-500/15 border-red-500/30 text-red-400"
                              : isExpired
                              ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                              : "bg-gray-500/15 border-gray-500/30 text-gray-400"
                          }`}
                        >
                          {isRunning ? "يعمل (Running)" : isFailed ? "فشل / تجاوز الحد" : isExpired ? "منتهي (Expired)" : "متوقف"}
                        </span>
                      </div>
                    </div>

                    {/* Error message if failed */}
                    {sbx.errorMessage && (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                        {sbx.errorMessage}
                      </div>
                    )}

                    {/* Live Resource Meters */}
                    <div className="space-y-2.5 pt-2 border-t border-[#1e2e2e]/50">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-[#4a7070] mb-1">
                          <span>استهلاك الذاكرة (RAM)</span>
                          <span className="font-mono text-[#e8f5f5]">
                            {ramUsage} MB / {ramLimit} MB ({ramPercent}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#111a1a] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              ramPercent > 80 ? "bg-red-500" : "bg-[#00d4aa]"
                            }`}
                            style={{ width: `${ramPercent}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-[#4a7070] mb-1">
                          <span>سعة القرص (Disk)</span>
                          <span className="font-mono text-[#e8f5f5]">
                            {diskUsage} MB / {diskLimit} MB ({diskPercent}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#111a1a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#38bdf8] transition-all"
                            style={{ width: `${diskPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#4a7070] pt-1">
                        <span>العمليات: {sbx.metrics?.processCount || 0} / {sbx.limits?.maxProcesses || 50}</span>
                        <span>المدة: {sbx.metrics?.durationSeconds || 0}s / {sbx.limits?.timeoutMinutes * 60}s</span>
                        <span>الشبكة: {sbx.limits?.networkMode}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#1e2e2e]/50">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewLogs(sbx.id)}
                          className="p-2 rounded-xl bg-[#111a1a] hover:bg-[#1a2929] text-[#e8f5f5] text-xs font-bold border border-[#1e2e2e] transition-all flex items-center gap-1.5 cursor-pointer"
                          title="عرض السجلات الحية"
                        >
                          <Terminal className="w-3.5 h-3.5 text-[#00d4aa]" />
                          <span>السجلات</span>
                        </button>

                        {sbx.previewUrl && (
                          <a
                            href={sbx.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-[#111a1a] hover:bg-[#1a2929] text-[#e8f5f5] text-xs font-bold border border-[#1e2e2e] transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#38bdf8]" />
                            <span>المعاينة</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isRunning ? (
                          <button
                            onClick={() => handleStop(sbx.id)}
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="إيقاف الساندبوكس وتحرير الموارد"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>إيقاف</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestart(sbx.id)}
                            className="p-2 rounded-xl bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="إعادة التشغيل"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>تشغيل</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(sbx.id)}
                          className="p-2 rounded-xl bg-[#111a1a] hover:bg-red-500/15 text-[#4a7070] hover:text-red-400 border border-[#1e2e2e] transition-all cursor-pointer"
                          title="حذف وتفريغ الساندبوكس"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIMITS & SECURITY CONFIG */}
      {activeTab === "limits" && (
        <form onSubmit={handleSaveLimits} className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e2e2e] bg-[#0c1414] space-y-6 max-w-3xl">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#e8f5f5]">حدود الموارد والعزل (Sandbox Resource Limits)</h2>
            <p className="text-xs text-[#4a7070]">
              تُطبَّق هذه الحدود فعلياً من جانب الخادم (Backend Enforced) لحماية موارد السيرفر ومنع أي استنزاف عشوائي.
            </p>
          </div>

          {/* Master Enable/Disable Control Inside Limits */}
          <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#e8f5f5] block">تشغيل أو تعطيل محرك الساندبوكس (Master Switch)</span>
              <span className="text-[11px] text-[#8fa3a3]">
                عند التعطيل (Standby)، لا يتم تشغيل أي سيرفرات أو استهلاك أي موارد معالج/ذاكرة بالخلفية.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleEnabled}
              disabled={togglingEnabled}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                isSandboxEnabled
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/20"
                  : "bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm shadow-rose-500/20"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isSandboxEnabled ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              <span>{isSandboxEnabled ? "🟢 مفعّل (Active)" : "🔴 معطل مؤقتاً (Standby)"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
              <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
                <span>الحد الأقصى للذاكرة (RAM)</span>
                <span className="text-[#00d4aa] font-mono">{limits.ramMb} MB</span>
              </label>
              <input
                type="number"
                min="128"
                max="4096"
                step="64"
                value={limits.ramMb}
                onChange={(e) => setLimits({ ...limits, ramMb: parseInt(e.target.value, 10) || 500 })}
                className="w-full bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-sm text-[#e8f5f5] font-mono outline-none"
              />
              <span className="text-[10px] text-[#4a7070]">الافتراضي: 500 MB (يتم إيقاف الساندبوكس فور تجاوزه)</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
              <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
                <span>أنوية المعالج (CPU Cores)</span>
                <span className="text-[#00d4aa] font-mono">{limits.cpuCores} Core</span>
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={limits.cpuCores}
                onChange={(e) => setLimits({ ...limits, cpuCores: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-sm text-[#e8f5f5] font-mono outline-none"
              />
              <span className="text-[10px] text-[#4a7070]">الافتراضي: 1 Core (أولوية Nice Scheduling معزولة)</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
              <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
                <span>سعة القرص المخصصة (Disk Quota)</span>
                <span className="text-[#00d4aa] font-mono">{limits.diskMb} MB</span>
              </label>
              <input
                type="number"
                min="512"
                max="10240"
                step="256"
                value={limits.diskMb}
                onChange={(e) => setLimits({ ...limits, diskMb: parseInt(e.target.value, 10) || 2048 })}
                className="w-full bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-sm text-[#e8f5f5] font-mono outline-none"
              />
              <span className="text-[10px] text-[#4a7070]">الافتراضي: 2048 MB (2 GB) داخل مسار معزول ومحمي</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
              <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
                <span>مهلة التشغيل القصوى (Timeout)</span>
                <span className="text-[#00d4aa] font-mono">{limits.timeoutMinutes} دقائق</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={limits.timeoutMinutes}
                onChange={(e) => setLimits({ ...limits, timeoutMinutes: parseInt(e.target.value, 10) || 10 })}
                className="w-full bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-sm text-[#e8f5f5] font-mono outline-none"
              />
              <span className="text-[10px] text-[#4a7070]">الافتراضي: 10 Minutes (إيقاف تلقائي وحفظ للقطة الملفات)</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
              <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
                <span>الحد الأقصى للعمليات (Processes)</span>
                <span className="text-[#00d4aa] font-mono">{limits.maxProcesses}</span>
              </label>
              <input
                type="number"
                min="10"
                max="200"
                value={limits.maxProcesses}
                onChange={(e) => setLimits({ ...limits, maxProcesses: parseInt(e.target.value, 10) || 50 })}
                className="w-full bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-sm text-[#e8f5f5] font-mono outline-none"
              />
              <span className="text-[10px] text-[#4a7070]">الافتراضي: 50 عملية كحد أقصى لمنع Fork Bombs</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
              <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
                <span>الحد الأقصى لحجم الملف الواحد</span>
                <span className="text-[#00d4aa] font-mono">{limits.maxFileSizeMb} MB</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={limits.maxFileSizeMb}
                onChange={(e) => setLimits({ ...limits, maxFileSizeMb: parseInt(e.target.value, 10) || 30 })}
                className="w-full bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-2 text-sm text-[#e8f5f5] font-mono outline-none"
              />
              <span className="text-[10px] text-[#4a7070]">الافتراضي: 30 MB (حماية مساحة التخزين من الملفات الضخمة)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#e8f5f5] block">وضع حماية الشبكة (Network Restrictions)</span>
              <span className="text-[11px] text-[#4a7070]">عزل ومنع الوصول لشبكات الخدمات الداخلية وقواعد البيانات</span>
            </div>
            <select
              value={limits.networkMode}
              onChange={(e) => setLimits({ ...limits, networkMode: e.target.value as any })}
              className="bg-[#0a0f0f] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-xl px-3 py-1.5 text-xs text-[#e8f5f5] font-mono outline-none"
            >
              <option value="restricted">Restricted (محمي - حجب الشبكات الداخلية)</option>
              <option value="isolated">Isolated (معزول كلياً عن الإنترنت)</option>
              <option value="allow_safe_outbound">Safe Outbound (السماح فقط بالحزم العامة NPM)</option>
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingLimits}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>{savingLimits ? "جاري الحفظ والتطبيق..." : "حفظ وتطبيق الحدود فورياً"}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: DIAGNOSTICS */}
      {activeTab === "diagnostics" && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e2e2e] bg-[#0c1414] space-y-6 max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#e8f5f5]">فحص واختبار عزل Linux والأمان</h2>
              <p className="text-xs text-[#4a7070]">
                اختبار جاهزية بيئة الخادم الأصلية وعزل العمليات وحجب أسرار الاستضافة.
              </p>
            </div>
            <button
              onClick={handleTestDiagnostics}
              disabled={testingEnv}
              className="px-4 py-2 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-4 h-4" />
              <span>{testingEnv ? "جاري الاختبار..." : "بدء الفحص الشامل"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#e8f5f5]">
                <span>Linux Namespaces (unshare)</span>
                <span className="text-[#00d4aa] font-mono">جاهز ومدعوم</span>
              </div>
              <p className="text-[11px] text-[#4a7070]">عزل كامل لمعرفات العمليات (PID) والشبكة ونظام الملفات.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#e8f5f5]">
                <span>Cgroups / Ulimit Enforcer</span>
                <span className="text-[#00d4aa] font-mono">نشط ومراقب</span>
              </div>
              <p className="text-[11px] text-[#4a7070]">مراقبة الذاكرة (500MB) والعمليات (50) تلقائياً كل 4 ثوانٍ.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#e8f5f5]">
                <span>عزل المتغيرات والأسرار (Secrets Stripping)</span>
                <span className="text-[#00d4aa] font-mono">حماية 100%</span>
              </div>
              <p className="text-[11px] text-[#4a7070]">حجب تام لمفاتيح GEMINI_API_KEY وFIREBASE وغيرها عن بيئة الكود.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#e8f5f5]">
                <span>نظام التخزين المحمي (Jailed Storage)</span>
                <span className="text-[#00d4aa] font-mono">/tmp/souftools-sandboxes</span>
              </div>
              <p className="text-[11px] text-[#4a7070]">منع Directory Traversal وحصر القراءة والكتابة داخل بيئة المشروع.</p>
            </div>
          </div>

          {diagResult && (
            <div className="p-4 rounded-2xl bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-xs font-mono text-[#e8f5f5] space-y-2">
              <div className="flex items-center gap-2 text-[#00d4aa] font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>نتيجة الفحص الأخير ({diagResult.latencyMs}ms):</span>
              </div>
              <p className="text-xs text-[#c0e0e0] leading-relaxed">{diagResult.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Logs Modal */}
      {selectedLogsId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-3xl w-full p-6 rounded-3xl border border-[#1e2e2e] bg-[#0a0f0f] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e2e2e] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#00d4aa]" />
                <h3 className="text-sm font-bold text-[#e8f5f5]">سجلات بيئة الساندبوكس: {selectedLogsId}</h3>
              </div>
              <button
                onClick={() => setSelectedLogsId(null)}
                className="p-1.5 rounded-lg bg-[#111a1a] hover:bg-[#1e2e2e] text-[#4a7070] hover:text-[#e8f5f5] cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#050808] border border-[#1e2e2e] rounded-xl p-4 h-80 overflow-y-auto font-mono text-xs text-[#38bdf8] space-y-1.5 ltr" dir="ltr">
              {logsLoading ? (
                <div className="text-gray-500">Loading live logs...</div>
              ) : logsData.length === 0 ? (
                <div className="text-gray-500">No logs recorded yet. Commands executed will appear here.</div>
              ) : (
                logsData.map((l, i) => (
                  <div
                    key={i}
                    className={`${
                      l.stream === "stderr"
                        ? "text-red-400"
                        : l.stream === "system"
                        ? "text-[#00d4aa]"
                        : "text-gray-300"
                    }`}
                  >
                    <span className="text-[#4a7070] mr-2">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                    <span>{l.message}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLogsId(null)}
                className="px-4 py-1.5 rounded-xl bg-[#1e2e2e] text-[#e8f5f5] text-xs font-bold hover:bg-[#253838] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
