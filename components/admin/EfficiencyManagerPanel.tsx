// components/admin/EfficiencyManagerPanel.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getAuthCookie } from "@/lib/authCookies";
import {
  Zap,
  Cpu,
  Layers,
  Activity,
  Database,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  TrendingDown,
  Clock,
  Sparkles,
  Search,
  Code,
  Eye,
  Image as ImageIcon,
  Calculator,
  Mail,
  ShieldCheck,
  RefreshCw,
  BarChart2,
  HelpCircle,
} from "lucide-react";
import {
  EfficiencyConfig,
  EfficiencyAnalyticsSummary,
  MaxStepsMode,
  ReflectionLevel,
} from "@/lib/efficiency/types";

export const EfficiencyManagerPanel: React.FC = () => {
  const [config, setConfig] = useState<EfficiencyConfig | null>(null);
  const [analytics, setAnalytics] = useState<EfficiencyAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Fetch data on mount
  const fetchData = async () => {
    try {
      setLoading(true);
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = {};
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/efficiency", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        if (data.analytics) setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Failed to fetch efficiency config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save changes
  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/efficiency", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(config),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        if (data.analytics) setAnalytics(data.analytics);
        setSaveSuccess(true);
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "فشل حفظ الإعدادات");
      }
    } catch (err: any) {
      setSaveError(err.message || "حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  // Clear Result Cache
  const handleClearCache = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في تفريغ ذاكرة التخزين المؤقت للإجابات (Result Cache)؟")) return;
    setClearingCache(true);
    try {
      const res = await fetch("/api/admin/efficiency?action=cache", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setActionNotice(data.message || "تم تفريغ الكاش بنجاح");
        setTimeout(() => setActionNotice(null), 4000);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to clear cache:", err);
    } finally {
      setClearingCache(false);
    }
  };

  // Reset Telemetry Analytics
  const handleResetAnalytics = async () => {
    if (!confirm("هل تريد تصفير جميع إحصائيات استهلاك وتوفير الـ Tokens؟")) return;
    try {
      const res = await fetch("/api/admin/efficiency?action=analytics", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setActionNotice(data.message || "تمت إعادة الضبط");
        setTimeout(() => setActionNotice(null), 4000);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to reset analytics:", err);
    }
  };

  const updateField = <K extends keyof EfficiencyConfig>(key: K, value: EfficiencyConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setHasUnsavedChanges(true);
  };

  const updateBudget = (toolKey: keyof EfficiencyConfig["toolBudgets"], value: number) => {
    if (!config) return;
    setConfig({
      ...config,
      toolBudgets: {
        ...config.toolBudgets,
        [toolKey]: Math.max(1, value),
      },
    });
    setHasUnsavedChanges(true);
  };

  if (loading || !config) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="w-8 h-8 text-[#00d4aa] animate-spin" />
        <p className="text-xs text-[#4a7070]">جاري تحميل إعدادات وإحصائيات إدارة الكفاءة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 0. Notifications & Notices */}
      {saveSuccess && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4.5 h-4.5 text-green-400 shrink-0" />
          <span>تم حفظ وتفعيل إعدادات كفاءة الذكاء الاصطناعي بنجاح! ⚡</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <AlertTriangle className="w-4.5 h-4.5 text-red-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {actionNotice && (
        <div className="p-4 rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa] text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4.5 h-4.5 text-[#00d4aa] shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 1. Header & Actions */}
      <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00d4aa]/20 to-[#0ea5e9]/20 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa]">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#e8f5f5] flex items-center gap-2">
              نظام إدارة الكفاءة الذكي (AI Efficiency Manager)
              <span className="text-[10px] bg-[#00d4aa]/15 text-[#00d4aa] px-2.5 py-0.5 rounded-full border border-[#00d4aa]/30 font-mono">
                v{config.version}
              </span>
            </h2>
            <p className="text-xs text-[#4a7070] mt-0.5">
              تحسين استخدام الـ Tokens، تخزين التوجيهات السحابي، التوجيه الذكي للنماذج، وتنفيذ الأدوات المتوازي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#8fa8a8] hover:text-[#e8f5f5] border border-[#1e2e2e] rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={saving || !hasUnsavedChanges}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              hasUnsavedChanges
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-[#00d4aa]/25 hover:brightness-110 scale-102"
                : "bg-[#1e2e2e]/60 text-[#4a7070] cursor-not-allowed"
            }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{saving ? "جاري الحفظ..." : "حفظ التغييرات"}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Analytics Metrics Overview */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e]">
            <div className="flex items-center justify-between text-[#4a7070] text-[10px] uppercase font-bold mb-1">
              <span>إجمالي الطلبات</span>
              <Activity className="w-4 h-4 text-[#0ea5e9]" />
            </div>
            <div className="text-xl font-extrabold text-[#e8f5f5] font-mono">
              {analytics.totalRequests.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#4a7070] mt-1">
              استجابات فورية وكاملة
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e]">
            <div className="flex items-center justify-between text-[#4a7070] text-[10px] uppercase font-bold mb-1">
              <span>نسبة توفير الـ Tokens</span>
              <TrendingDown className="w-4 h-4 text-[#00ff88]" />
            </div>
            <div className="text-xl font-extrabold text-[#00ff88] font-mono">
              {analytics.savingsPercentage}%
            </div>
            <div className="text-[10px] text-green-400/80 mt-1">
              وفر عبر الـ Caching والتوجيه
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e]">
            <div className="flex items-center justify-between text-[#4a7070] text-[10px] uppercase font-bold mb-1">
              <span>Tokens تم توفيرها</span>
              <Database className="w-4 h-4 text-[#00d4aa]" />
            </div>
            <div className="text-xl font-extrabold text-[#00d4aa] font-mono">
              {analytics.tokensSaved.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#4a7070] mt-1">
              مقارنة بالاستهلاك المباشر
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e]">
            <div className="flex items-center justify-between text-[#4a7070] text-[10px] uppercase font-bold mb-1">
              <span>ضربات الكاش (Cache Hits)</span>
              <Sparkles className="w-4 h-4 text-[#eab308]" />
            </div>
            <div className="text-xl font-extrabold text-[#eab308] font-mono">
              {analytics.cacheHitsCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#4a7070] mt-1">
              إجابات بـ 0 استهلاك API
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-[#4a7070] text-[10px] uppercase font-bold mb-1">
              <span>متوسط زمن الاستجابة</span>
              <Clock className="w-4 h-4 text-[#a855f7]" />
            </div>
            <div className="text-xl font-extrabold text-[#a855f7] font-mono">
              {analytics.avgLatencyMs > 0 ? `${analytics.avgLatencyMs} ms` : "سريع (<150ms)"}
            </div>
            <div className="text-[10px] text-[#4a7070] mt-1">
              بفضل التوازي والـ TTFT السريع
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Optimization Engine Toggles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Module 1: Prompt & Model Routing */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#1e2e2e]">
            <Cpu className="w-5 h-5 text-[#00d4aa]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">محركات التوجيه والتخزين المؤقت</h3>
          </div>

          {/* Prompt Cache Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="space-y-1 max-w-[75%]">
              <span className="text-xs font-bold text-[#e8f5f5] block">
                تخزين التعليمات والأدوات (Prompt Caching System)
              </span>
              <p className="text-[11px] text-[#4a7070] leading-relaxed">
                تثبيت التعليمات الأساسية وتوقيعات الأدوات الثابتة وتحديث الفروقات فقط لتقليل الـ TTFT والتكلفة.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.promptCacheEnabled}
                onChange={(e) => updateField("promptCacheEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1e2e2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00d4aa]"></div>
            </label>
          </div>

          {/* Smart Model Router Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="space-y-1 max-w-[75%]">
              <span className="text-xs font-bold text-[#e8f5f5] block">
                التوجيه الذكي للنماذج (Smart Model Router)
              </span>
              <p className="text-[11px] text-[#4a7070] leading-relaxed">
                توجيه المهام البسيطة والحسابية لنماذج خفيفة وفائقة السرعة، والرؤية لنماذج الـ Vision، والبرمجة لمحركات الكود.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.modelRouterEnabled}
                onChange={(e) => updateField("modelRouterEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1e2e2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00d4aa]"></div>
            </label>
          </div>

          {/* Result Cache Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="space-y-1 max-w-[75%]">
              <span className="text-xs font-bold text-[#e8f5f5] block">
                كاش الإجابات التلقائي (Result Cache Engine)
              </span>
              <p className="text-[11px] text-[#4a7070] leading-relaxed">
                إعادة الإجابات المسبقة للأسئلة المعرفية المتكررة فورياً بدون استدعاء الـ API (0 استهلاك).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.resultCacheEnabled}
                onChange={(e) => updateField("resultCacheEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1e2e2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00d4aa]"></div>
            </label>
          </div>

          {/* Parallel Execution & Compression */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="space-y-1 max-w-[75%]">
              <span className="text-xs font-bold text-[#e8f5f5] block">
                التنفيذ المتوازي للأدوات (Parallel Tool Execution)
              </span>
              <p className="text-[11px] text-[#4a7070] leading-relaxed">
                تشغيل استعلامات البحث والمواقع المستقلة تزامناً عبر Promise.allSettled لتقليل زمن الانتظار.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.parallelToolsEnabled}
                onChange={(e) => updateField("parallelToolsEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1e2e2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00d4aa]"></div>
            </label>
          </div>
        </div>

        {/* Module 2: Memory & Loop Ceilings */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#1e2e2e]">
            <Layers className="w-5 h-5 text-[#0ea5e9]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">الذاكرة الذكية والتحكم في دورات الوكيل</h3>
          </div>

          {/* Smart Memory Optimization */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="space-y-1 max-w-[75%]">
              <span className="text-xs font-bold text-[#e8f5f5] block">
                ضغط واختزال الذاكرة (Smart Memory Optimizer)
              </span>
              <p className="text-[11px] text-[#4a7070] leading-relaxed">
                فصل الذاكرة لقصيرة المدى وحقن الحقائق ذات الصلة بالكلمات المفتاحية فقط وتجاوز السجلات غير المرتبطة.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.memoryOptimizationEnabled}
                onChange={(e) => updateField("memoryOptimizationEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1e2e2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00d4aa]"></div>
            </label>
          </div>

          {/* Compress Tool Outputs */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e]">
            <div className="space-y-1 max-w-[75%]">
              <span className="text-xs font-bold text-[#e8f5f5] block">
                ضغط مخرجات الأدوات (Tool Output Compressor)
              </span>
              <p className="text-[11px] text-[#4a7070] leading-relaxed">
                تلخيص محتوى صفحات الويب وجداول البيانات الضخمة قبل إرسالها للنموذج لتوفير حتى 70% من الـ Tokens.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.compressToolOutputs}
                onChange={(e) => updateField("compressToolOutputs", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1e2e2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00d4aa]"></div>
            </label>
          </div>

          {/* Agent Max Steps Selector */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5]">
                نمط خطوات الوكيل (Agent Max Steps Mode)
              </span>
              <span className="text-[11px] text-[#00d4aa] font-bold">
                {config.maxStepsMode === "quick" && "سريع (3 خطوات كحد أقصى)"}
                {config.maxStepsMode === "balanced" && "متوازن (7 خطوات كحد أقصى)"}
                {config.maxStepsMode === "deep" && "عميق (15 خطوة كحد أقصى)"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["quick", "balanced", "deep"] as MaxStepsMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateField("maxStepsMode", mode)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    config.maxStepsMode === mode
                      ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa]"
                      : "bg-[#0a0f0f] border-[#1e2e2e] text-[#4a7070] hover:text-[#e8f5f5]"
                  }`}
                >
                  {mode === "quick" && "⚡ سريع (Quick)"}
                  {mode === "balanced" && "⚖️ متوازن (Balanced)"}
                  {mode === "deep" && "🔬 عميق (Deep)"}
                </button>
              ))}
            </div>
          </div>

          {/* Reflection Level Selector */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5]">
                مستوى المراجعة والتدقيق الذاتي (Reflection Level)
              </span>
              <span className="text-[11px] text-[#0ea5e9] font-mono">
                {config.reflectionLevel}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {(["off", "fast", "normal", "deep"] as ReflectionLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateField("reflectionLevel", lvl)}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    config.reflectionLevel === lvl
                      ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                      : "bg-[#0a0f0f] border-[#1e2e2e] text-[#4a7070] hover:text-[#e8f5f5]"
                  }`}
                >
                  {lvl === "off" && "معطل"}
                  {lvl === "fast" && "سريع (أخطاء)"}
                  {lvl === "normal" && "عادي"}
                  {lvl === "deep" && "مكثف"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tool Budget Quotas Manager */}
      <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1e2e2e]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#eab308]" />
            <div>
              <h3 className="text-sm font-bold text-[#e8f5f5]">ميزانيات وسقوف الأدوات لكل مهمة (Tool Budgets)</h3>
              <p className="text-[11px] text-[#4a7070]">
                الحد الأقصى المسموح للوكيل باستدعاء كل أداة في المهمة الواحدة لتفادي الحلقات اللانهائية وهدر الـ Tokens.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[#8fa8a8] bg-[#111a1a] px-3 py-1 rounded-full border border-[#1e2e2e]">
            سقف صارم لكل طلب
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {/* Web Search Budget */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                <Search className="w-4 h-4 text-[#0ea5e9]" />
                البحث والتصفح في الويب
              </span>
              <span className="text-xs font-mono font-bold text-[#0ea5e9]">
                {config.toolBudgets.webSearch} استدعاءات
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={config.toolBudgets.webSearch}
              onChange={(e) => updateBudget("webSearch", parseInt(e.target.value))}
              className="w-full accent-[#0ea5e9] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#4a7070]">
              <span>1</span>
              <span>افتراضي: 5</span>
              <span>15</span>
            </div>
          </div>

          {/* Vision Budget */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#a855f7]" />
                تحليل وتدقيق الصور (Vision)
              </span>
              <span className="text-xs font-mono font-bold text-[#a855f7]">
                {config.toolBudgets.vision} استدعاءات
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={config.toolBudgets.vision}
              onChange={(e) => updateBudget("vision", parseInt(e.target.value))}
              className="w-full accent-[#a855f7] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#4a7070]">
              <span>1</span>
              <span>افتراضي: 3</span>
              <span>10</span>
            </div>
          </div>

          {/* Coding Budget */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                <Code className="w-4 h-4 text-[#00d4aa]" />
                بناء وتعديل الأكواد (Coding Tool)
              </span>
              <span className="text-xs font-mono font-bold text-[#00d4aa]">
                {config.toolBudgets.coding} عمليات
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              value={config.toolBudgets.coding}
              onChange={(e) => updateBudget("coding", parseInt(e.target.value))}
              className="w-full accent-[#00d4aa] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#4a7070]">
              <span>1</span>
              <span>افتراضي: 5</span>
              <span>12</span>
            </div>
          </div>

          {/* Image Gen Budget */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#ec4899]" />
                توليد وتصميم الصور (Image Gen)
              </span>
              <span className="text-xs font-mono font-bold text-[#ec4899]">
                {config.toolBudgets.imageGen} صور
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={config.toolBudgets.imageGen}
              onChange={(e) => updateBudget("imageGen", parseInt(e.target.value))}
              className="w-full accent-[#ec4899] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#4a7070]">
              <span>1</span>
              <span>افتراضي: 2</span>
              <span>5</span>
            </div>
          </div>

          {/* Calculator Budget */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-[#eab308]" />
                أداة العمليات الحسابية
              </span>
              <span className="text-xs font-mono font-bold text-[#eab308]">
                {config.toolBudgets.calculator} عمليات
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={config.toolBudgets.calculator}
              onChange={(e) => updateBudget("calculator", parseInt(e.target.value))}
              className="w-full accent-[#eab308] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#4a7070]">
              <span>1</span>
              <span>افتراضي: 5</span>
              <span>15</span>
            </div>
          </div>

          {/* Gmail / Workspace Budget */}
          <div className="p-3.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#f97316]" />
                أدوات Gmail & Workspace
              </span>
              <span className="text-xs font-mono font-bold text-[#f97316]">
                {config.toolBudgets.gmail} عمليات
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={config.toolBudgets.gmail}
              onChange={(e) => updateBudget("gmail", parseInt(e.target.value))}
              className="w-full accent-[#f97316] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#4a7070]">
              <span>1</span>
              <span>افتراضي: 5</span>
              <span>10</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Result Cache Operations & Telemetry Events Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cache TTL & Flush */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#1e2e2e]">
            <Database className="w-5 h-5 text-[#00ff88]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">إدارة Result Cache</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#e8f5f5] block">
                مدة صلاحية الكاش (TTL بالدقائق)
              </label>
              <input
                type="number"
                min="1"
                max="1440"
                value={config.resultCacheTtlMinutes}
                onChange={(e) => updateField("resultCacheTtlMinutes", parseInt(e.target.value) || 15)}
                className="w-full bg-[#111a1a] text-xs text-[#e8f5f5] px-3.5 py-2.5 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none font-mono"
              />
              <p className="text-[10px] text-[#4a7070]">
                يتم حذف الإجابات المحفوظة تلقائياً بعد انقضاء هذه المدة لضمان حداثة البيانات.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleClearCache}
                disabled={clearingCache}
                className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearingCache ? "جاري التفريغ..." : "تفريغ الـ Result Cache الآن"}</span>
              </button>

              <button
                type="button"
                onClick={handleResetAnalytics}
                className="w-full py-2.5 px-4 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#8fa8a8] border border-[#1e2e2e] rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تصفير إحصائيات الاستهلاك</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Telemetry Stream */}
        <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#1e2e2e]">
            <div className="flex items-center gap-2.5">
              <BarChart2 className="w-5 h-5 text-[#00d4aa]" />
              <h3 className="text-sm font-bold text-[#e8f5f5]">سجل أحداث الكفاءة المباشر (Efficiency Telemetry)</h3>
            </div>
            <span className="text-[10px] text-[#00ff88] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span>
              مراقبة حية
            </span>
          </div>

          {analytics && analytics.recentEvents && analytics.recentEvents.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {analytics.recentEvents.slice().reverse().map((ev) => (
                <div
                  key={ev.id}
                  className="p-2.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        ev.type === "cache_hit"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : ev.type === "parallel_execution"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-[#1e2e2e] text-[#8fa8a8]"
                      }`}
                    >
                      {ev.type === "cache_hit" ? "CACHE HIT ⚡" : ev.type}
                    </span>
                    <span className="text-[#e8f5f5] font-medium truncate max-w-[200px] md:max-w-[300px]">
                      {ev.promptSummary}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[#4a7070] font-mono shrink-0">
                    <span className="text-[#00ff88]">+{ev.tokensSaved} tokens</span>
                    <span>{ev.latencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-[#4a7070] text-xs">
              لا توجد أحداث مسجلة بعد. عند إجراء استفسارات عبر الوكيل أو المحادثة، ستظهر تحليلات التوفير والسرعة هنا مباشرة.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
