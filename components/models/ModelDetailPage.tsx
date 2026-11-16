"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  SoufModelRegistryEntry,
  ModelToolCapability,
} from "@/lib/models/modelRegistry";
import {
  getModelIcon,
  getToolIcon,
  SoufPerformanceIcon,
  SoufToolsIcon,
  SoufAgentIcon,
  SoufFilesIcon,
  SoufSecurityIcon,
  SoufAnalyticsIcon,
  SoufAIIcon,
} from "@/components/icons/SoufIcons";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Terminal,
  Activity,
  Cpu,
  ChevronRight,
  ExternalLink,
  Code2,
  Brain,
  ShieldCheck,
  RefreshCw,
  BarChart2,
  Settings,
  Layers,
  FileCode,
  Globe,
  Eye,
  Sliders,
  X,
  Home,
  MessageSquare,
} from "lucide-react";

interface ModelDetailPageProps {
  locale: string;
  isRtl: boolean;
  model: SoufModelRegistryEntry;
  initialTab?: string;
}

type TabType =
  | "overview"
  | "capabilities"
  | "performance"
  | "usage"
  | "tools"
  | "activity"
  | "limits"
  | "configuration";

export const ModelDetailPage: React.FC<ModelDetailPageProps> = ({
  locale,
  isRtl,
  model,
  initialTab = "overview",
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(
    (initialTab as TabType) || "overview"
  );
  const [selectedToolDrawer, setSelectedToolDrawer] =
    useState<ModelToolCapability | null>(null);

  // Real backend metrics states
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfRange, setPerfRange] = useState<string>("7d");

  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageRange, setUsageRange] = useState<string>("7d");

  const [activityData, setActivityData] = useState<any>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const [configData, setConfigData] = useState<any>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Local temperature / slider states
  const [tempValue, setTempValue] = useState<number>(
    model.configuration_schema?.default_temperature || 0.7
  );
  const [tempMaxTokens, setTempMaxTokens] = useState<number>(
    model.limits.max_output_tokens
  );

  const accent = model.identity.accentColor;

  const loadPerformance = React.useCallback(async (range: string) => {
    setPerfLoading(true);
    try {
      const res = await fetch(
        `/api/v1/models/${model.model_id}/performance?range=${range}`
      );
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) {
          setPerformanceData(data.performance);
        }
      }
    } catch (err) {
      console.warn("Performance data notice:", err);
    } finally {
      setPerfLoading(false);
    }
  }, [model.model_id]);

  const loadUsage = React.useCallback(async (range: string) => {
    setUsageLoading(true);
    try {
      const res = await fetch(
        `/api/v1/models/${model.model_id}/usage?range=${range}`
      );
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) {
          setUsageData(data.usage);
        }
      }
    } catch (err) {
      console.warn("Usage data notice:", err);
    } finally {
      setUsageLoading(false);
    }
  }, [model.model_id]);

  const loadActivity = React.useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/v1/models/${model.model_id}/activity`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) {
          setActivityData(data.activity);
        }
      }
    } catch (err) {
      console.warn("Activity data notice:", err);
    } finally {
      setActivityLoading(false);
    }
  }, [model.model_id]);

  const loadConfiguration = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/models/${model.model_id}/configuration`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) {
          setConfigData(data.configuration);
          if (data.configuration.temperature !== undefined) {
            setTempValue(data.configuration.temperature);
          }
          if (data.configuration.max_output_tokens !== undefined) {
            setTempMaxTokens(data.configuration.max_output_tokens);
          }
        }
      }
    } catch (err) {
      console.warn("Config data notice:", err);
    }
  }, [model.model_id]);

  useEffect(() => {
    if (activeTab === "performance") {
      loadPerformance(perfRange);
    } else if (activeTab === "usage") {
      loadUsage(usageRange);
    } else if (activeTab === "activity") {
      loadActivity();
    } else if (activeTab === "configuration") {
      loadConfiguration();
    }
  }, [activeTab, perfRange, usageRange, loadPerformance, loadUsage, loadActivity, loadConfiguration]);

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSuccessMsg(null);
    try {
      const res = await fetch(
        `/api/v1/models/${model.model_id}/configuration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temperature: tempValue,
            max_output_tokens: tempMaxTokens,
          }),
        }
      );
      if (res.ok) {
        setConfigSuccessMsg(
          isRtl
            ? "تم حفظ الإعدادات بنجاح للمستخدم الحالي"
            : "Configuration persisted successfully"
        );
        setTimeout(() => setConfigSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.warn("Config save error:", err);
    } finally {
      setConfigSaving(false);
    }
  };

  const tabItems: { id: TabType; labelAr: string; labelEn: string; icon: any }[] = [
    { id: "overview", labelAr: "نظرة عامة", labelEn: "Overview", icon: Layers },
    { id: "capabilities", labelAr: "القدرات", labelEn: "Capabilities", icon: Cpu },
    { id: "performance", labelAr: "الأداء الحقيقي", labelEn: "Performance", icon: BarChart2 },
    { id: "usage", labelAr: "الاستهلاك", labelEn: "Usage", icon: Activity },
    { id: "tools", labelAr: "الأدوات المتوافقة", labelEn: "Tools", icon: Terminal },
    { id: "activity", labelAr: "النشاط المباشر", labelEn: "Activity", icon: Clock },
    { id: "limits", labelAr: "الحدود والقيود", labelEn: "Limits", icon: ShieldCheck },
    { id: "configuration", labelAr: "الإعدادات", labelEn: "Configuration", icon: Settings },
  ];

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    if (tabId === "overview") {
      router.push(`/${locale}/models/${model.model_id}`);
    } else {
      router.push(`/${locale}/models/${model.model_id}/${tabId}`);
    }
  };

  const getReasoningLabel = (level: string) => {
    switch (level) {
      case "fast":
        return isRtl ? "استجابة سريعة" : "Fast Low-Latency";
      case "standard":
        return isRtl ? "تفكير قياسي" : "Standard Reasoning";
      case "high":
        return isRtl ? "تفكير واستدلال عميق" : "High Reasoning";
      case "deep_research":
        return isRtl ? "استدلال بحثي متقدم" : "Autonomous Synthesis";
      default:
        return level;
    }
  };

  const getCodingLabel = (level: string) => {
    switch (level) {
      case "basic":
        return isRtl ? "أساسي" : "Basic Assist";
      case "competent":
        return isRtl ? "كفؤ في البرمجة" : "Competent Full-Stack";
      case "expert":
        return isRtl ? "خبير هندسة برمجيات" : "Expert Engineering";
      case "state_of_the_art":
        return isRtl ? "الأعلى هندسياً + ساندبوكس" : "State-of-the-Art + Sandbox";
      default:
        return level;
    }
  };

  return (
    <div
      className="w-full min-h-screen bg-[#040707] text-[#e8f2f2] font-sans selection:bg-[#00d4aa]/25 selection:text-[#00d4aa] pb-24"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-[#0d1616] bg-[#040707]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/models`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8da5a5] hover:text-[#f4f8f8] bg-[#080e0e] hover:bg-[#0c1414] border border-[#131f1f] transition-colors"
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{isRtl ? "مركز النماذج" : "Model Center"}</span>
            </Link>

            <span className="text-xs text-[#506e6e] font-mono hidden sm:inline">/</span>

            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center border"
                style={{
                  backgroundColor: `${accent}20`,
                  borderColor: `${accent}40`,
                }}
              >
                {getModelIcon(model.model_id, {
                  size: 13,
                  accentColor: accent,
                })}
              </div>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-[#f4f8f8]">
                {model.display_name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/chat?model=${model.model_id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg cursor-pointer"
              style={{
                backgroundColor: accent,
                color: "#031111",
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isRtl ? "بدء مهمة بهذا النموذج" : "Launch Model"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Model Identity Hero Block */}
      <section className="border-b border-[#0d1616] bg-[#050909]/60 relative overflow-hidden">
        <div
          className="absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: accent }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border shrink-0 shadow-xl"
                style={{
                  backgroundColor: `${accent}15`,
                  borderColor: `${accent}40`,
                }}
              >
                {getModelIcon(model.model_id, {
                  size: 32,
                  accentColor: accent,
                  glow: true,
                })}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#f4f8f8]">
                    {model.display_name}
                  </h2>
                  <span
                    className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border"
                    style={{
                      color: accent,
                      backgroundColor: `${accent}15`,
                      borderColor: `${accent}35`,
                    }}
                  >
                    {isRtl ? model.identity.badgeAr : model.identity.badgeEn}
                  </span>
                  <span className="text-xs font-mono text-[#557373]">
                    {model.version}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#88a5a5] max-w-2xl leading-relaxed">
                  {isRtl ? model.identity.descriptionAr : model.identity.descriptionEn}
                </p>
              </div>
            </div>

            {/* Live Model Stats Quick Matrix */}
            <div className="grid grid-cols-3 gap-2 shrink-0 font-mono text-center">
              <div className="px-3 py-2 rounded-xl bg-[#090f0f] border border-[#131e1e]">
                <div className="text-[10px] text-[#557373]">{isRtl ? "نافذة السياق" : "Context"}</div>
                <div className="text-sm font-bold text-[#f4f8f8] mt-0.5">
                  {model.capabilities.context_window >= 2000000 ? "2M" : "1M"}
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-[#090f0f] border border-[#131e1e]">
                <div className="text-[10px] text-[#557373]">{isRtl ? "الاستدلال" : "Reasoning"}</div>
                <div className="text-xs font-bold text-[#f4f8f8] mt-0.5 capitalize">
                  {getReasoningLabel(model.capabilities.reasoning_level)}
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-[#090f0f] border border-[#131e1e]">
                <div className="text-[10px] text-[#557373]">{isRtl ? "مستوى الكود" : "Coding"}</div>
                <div className="text-xs font-bold text-[#f4f8f8] mt-0.5 capitalize">
                  {getCodingLabel(model.capabilities.coding_level)}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Navigation Tabs Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pt-2 border-t border-[#121c1c] scrollbar-none">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#091414] text-[#f4f8f8] font-bold border border-[#1b2f2f]"
                      : "text-[#658282] hover:text-[#c0d6d6] hover:bg-[#070e0e]"
                  }`}
                  style={{
                    borderBottomColor: isSelected ? accent : undefined,
                    borderBottomWidth: isSelected ? "2px" : undefined,
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: isSelected ? accent : undefined }}
                  />
                  <span>{isRtl ? tab.labelAr : tab.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dynamic Content Panel per Tab */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* 1. OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Left Column: Key Features & Ideal Tasks */}
              <div className="md:col-span-2 space-y-5">
                <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00d4aa]" />
                    <h3 className="text-sm font-bold text-[#f4f8f8]">
                      {isRtl ? "الميزات الأساسية والتخصص الهندسي" : "Core Architectural Features"}
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {model.features.map((feat, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-xl bg-[#090f0f] border border-[#121d1d]"
                      >
                        <CheckCircle2
                          className="w-4 h-4 shrink-0 mt-0.5"
                          style={{ color: accent }}
                        />
                        <span className="text-xs text-[#d0e0e0] leading-relaxed">
                          {isRtl ? feat.ar : feat.en}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Best For / Ideal Workflows */}
                <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#00d4aa]" />
                    <h3 className="text-sm font-bold text-[#f4f8f8]">
                      {isRtl ? "الحالات المثالية للاستخدام" : "Recommended Use Cases"}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(isRtl ? model.identity.idealForAr : model.identity.idealForEn).map(
                      (item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-[#080d0d] border border-[#111a1a] text-xs text-[#99b5b5] flex items-center gap-2"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: accent }}
                          />
                          <span>{item}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Technical Spec Sheet */}
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#00d4aa]" />
                    <h3 className="text-sm font-bold text-[#f4f8f8]">
                      {isRtl ? "بطاقة المواصفات الفنية" : "Technical Specs"}
                    </h3>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#658282]">{isRtl ? "المزود الأساسي:" : "Provider Engine:"}</span>
                      <span className="text-[#f4f8f8]">{model.provider}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#658282]">{isRtl ? "الإصدار الداخلي:" : "Internal Version:"}</span>
                      <span className="text-[#f4f8f8]">{model.version}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#658282]">{isRtl ? "أقصى توكنز مخرجات:" : "Max Output:"}</span>
                      <span className="text-[#f4f8f8] font-bold font-mono">
                        {model.limits.max_output_tokens.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#658282]">{isRtl ? "الرؤية البصرية:" : "Vision Modality:"}</span>
                      <span className="text-emerald-400 font-semibold">{isRtl ? "مدعوم 100%" : "Supported"}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#658282]">{isRtl ? "بث الردود التدريجي:" : "Streaming Output:"}</span>
                      <span className="text-emerald-400 font-semibold">{isRtl ? "نعم (SSE)" : "Active (SSE)"}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#658282]">{isRtl ? "ساندبوكس معزول:" : "Isolated Sandbox:"}</span>
                      <span
                        className={
                          model.supported_tools.some((t) => t.id === "sandbox" && t.available)
                            ? "text-[#00d4aa] font-bold"
                            : "text-[#557373]"
                        }
                      >
                        {model.supported_tools.some((t) => t.id === "sandbox" && t.available)
                          ? isRtl
                            ? "مفعل (E2B)"
                            : "Enabled (E2B)"
                          : isRtl
                          ? "غير متطلب"
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#121c1c]">
                    <Link
                      href={`/${locale}/chat?model=${model.model_id}`}
                      className="w-full py-2.5 rounded-xl bg-[#091313] hover:bg-[#0c1a1a] text-[#00d4aa] border border-[#00d4aa]/30 flex items-center justify-center gap-2 text-xs font-bold transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isRtl ? "فتح جلسة عمل فورية" : "Start Session"}</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. CAPABILITIES TAB */}
        {activeTab === "capabilities" && (
          <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#f4f8f8]">
                {isRtl ? "مصفوفة القدرات الهندسية (Capabilities Matrix)" : "Capabilities Matrix"}
              </h3>
              <p className="text-xs text-[#688585]">
                {isRtl
                  ? "جميع القدرات مسجلة وموثقة ومربوطة بمحرك النظام المركزي."
                  : "Authenticated runtime capabilities matching backend execution environment."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#060a0a] border border-[#111a1a] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "سعة السياق الكلية" : "Total Context"}</div>
                <div className="text-lg font-bold text-[#f4f8f8]">{model.capabilities.context_window_label}</div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "قادر على استيعاب مستودعات برمجية كاملة وكتب مرجعية في سياق واحد." : "Capable of holding full codebases and long documents in active memory."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060a0a] border border-[#111a1a] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "مستوى الاستدلال" : "Reasoning Level"}</div>
                <div className="text-base font-bold text-[#f4f8f8] capitalize">{getReasoningLabel(model.capabilities.reasoning_level)}</div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "معالجة منطقية متعددة المراحل لحل المشكلات المعقدة." : "Multi-step chain-of-thought verification."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060a0a] border border-[#111a1a] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "مستوى هندسة البرمجيات" : "Coding Engineering"}</div>
                <div className="text-base font-bold text-[#f4f8f8] capitalize">{getCodingLabel(model.capabilities.coding_level)}</div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "توليد شيفرات كاملة وفحص أخطاء الترجمة والتنفيذ." : "Syntactic precision, dependency resolution and execution."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060a0a] border border-[#111a1a] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "الرؤية وفحص الصور" : "Vision & OCR"}</div>
                <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isRtl ? "مدعوم بالكامل" : "Active"}</span>
                </div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? model.capabilities.vision_notes_ar : model.capabilities.vision_notes_en}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060a0a] border border-[#111a1a] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "البحث المباشر في الويب" : "Web Grounding"}</div>
                <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{model.capabilities.web ? (isRtl ? "مفعل" : "Active") : (isRtl ? "غير مفعل" : "Off")}</span>
                </div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "الاستعلام المباشر وتوثيق المراجع عبر الإنترنت." : "Live web search & citation verification."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060a0a] border border-[#111a1a] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "المخرجات المهيكلة" : "Structured Output"}</div>
                <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>JSON Schema Guaranteed</span>
                </div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "ضمان تطابق المخرجات مع المخططات البرمجية." : "Guaranteed schema adherence for automated pipelines."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. PERFORMANCE TAB */}
        {activeTab === "performance" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#f4f8f8]">
                  {isRtl ? "مؤشرات الأداء الحقيقية والقياس عن بعد (Telemetry)" : "Real Performance Telemetry"}
                </h3>
                <p className="text-xs text-[#688585]">
                  {isRtl
                    ? "بيانات حقيقية من استدعاءات الـ API الفعلية وسجلات الخادم."
                    : "Real data aggregated directly from backend inference logs."}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#060a0a] border border-[#121c1c] p-1 rounded-xl">
                {["today", "7d", "30d", "90d"].map((rng) => (
                  <button
                    key={rng}
                    onClick={() => setPerfRange(rng)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      perfRange === rng
                        ? "bg-[#00d4aa] text-[#031111] font-bold"
                        : "text-[#658282] hover:text-[#e8f2f2]"
                    }`}
                  >
                    {rng.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {perfLoading ? (
              <div className="p-12 rounded-2xl bg-[#060a0a] border border-[#121c1c] text-center text-xs text-[#608080] flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 text-[#00d4aa] animate-spin" />
                <span>{isRtl ? "جارِ جلب سجلات الأداء من الخادم..." : "Fetching live telemetry..."}</span>
              </div>
            ) : performanceData ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4.5 rounded-2xl bg-[#060a0a] border border-[#121c1c] space-y-1">
                  <div className="text-[11px] font-mono text-[#557373]">{isRtl ? "معدل النجاح" : "Success Rate"}</div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">
                    {performanceData.success_rate}%
                  </div>
                  <div className="text-[10px] text-[#557373]">{performanceData.total_requests.toLocaleString()} طلبات</div>
                </div>

                <div className="p-4.5 rounded-2xl bg-[#060a0a] border border-[#121c1c] space-y-1">
                  <div className="text-[11px] font-mono text-[#557373]">{isRtl ? "متوسط الاستجابة" : "Avg Latency"}</div>
                  <div className="text-2xl font-bold text-[#f4f8f8] font-mono">
                    {performanceData.latency_average_ms}ms
                  </div>
                  <div className="text-[10px] text-[#557373]">p50: {performanceData.latency_p50_ms}ms / p95: {performanceData.latency_p95_ms}ms</div>
                </div>

                <div className="p-4.5 rounded-2xl bg-[#060a0a] border border-[#121c1c] space-y-1">
                  <div className="text-[11px] font-mono text-[#557373]">{isRtl ? "معدل التدفق" : "Throughput"}</div>
                  <div className="text-2xl font-bold text-[#00d4aa] font-mono">
                    {performanceData.throughput_tokens_sec} T/s
                  </div>
                  <div className="text-[10px] text-[#557373]">{isRtl ? "توكن لكل ثانية" : "Tokens per second"}</div>
                </div>

                <div className="p-4.5 rounded-2xl bg-[#060a0a] border border-[#121c1c] space-y-1">
                  <div className="text-[11px] font-mono text-[#557373]">{isRtl ? "جاهزية النموذج" : "Availability"}</div>
                  <div className="text-2xl font-bold text-[#38bdf8] font-mono">
                    {performanceData.availability_uptime}%
                  </div>
                  <div className="text-[10px] text-[#557373]">{isRtl ? "حالة التشغيل: ممتاز" : "Status: Operational"}</div>
                </div>
              </div>
            ) : (
              <div className="p-10 rounded-2xl bg-[#060a0a] border border-[#121c1c] text-center text-xs text-[#608080]">
                {isRtl ? "لا توجد بيانات أداء كافية حتى الآن لهذه الفترة الزمنية." : "Insufficient performance logs for this time window."}
              </div>
            )}
          </div>
        )}

        {/* 4. USAGE TAB */}
        {activeTab === "usage" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#f4f8f8]">
                  {isRtl ? "إحصائيات استهلاكك الشخصي" : "Your Model Consumption"}
                </h3>
                <p className="text-xs text-[#688585]">
                  {isRtl
                    ? "يتم احتساب الاستهلاك الفعلي لحسابك بشكل آمن بناءً على جلسة تسجيل الدخول."
                    : "Authenticated user consumption metrics across interactive sessions."}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#060a0a] border border-[#121c1c] p-1 rounded-xl">
                {["today", "7d", "30d"].map((rng) => (
                  <button
                    key={rng}
                    onClick={() => setUsageRange(rng)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      usageRange === rng
                        ? "bg-[#00d4aa] text-[#031111] font-bold"
                        : "text-[#658282] hover:text-[#e8f2f2]"
                    }`}
                  >
                    {rng.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {usageLoading ? (
              <div className="p-12 rounded-2xl bg-[#060a0a] border border-[#121c1c] text-center text-xs text-[#608080] flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 text-[#00d4aa] animate-spin" />
                <span>{isRtl ? "جارِ احتساب التوكنز والطلبات..." : "Calculating usage..."}</span>
              </div>
            ) : usageData ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[#060a0a] border border-[#121c1c] space-y-2">
                  <div className="text-[11px] font-mono text-[#557373]">{isRtl ? "إجمالي التوكنز المستهلكة" : "Total Tokens"}</div>
                  <div className="text-2xl font-bold text-[#00d4aa] font-mono">
                    {usageData.total_tokens?.toLocaleString() || 0}
                  </div>
                  <div className="text-[10px] text-[#557373]">
                    {isRtl ? "المدخلات والمخرجات" : "Prompt + Completion"}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#060a0a] border border-[#121c1c] space-y-2">
                  <div className="text-[11px] font-mono text-[#557373]">{isRtl ? "عدد الطلبات المنفذة" : "Completed Requests"}</div>
                  <div className="text-2xl font-bold text-[#f4f8f8] font-mono">
                    {usageData.total_requests || 0}
                  </div>
                  <div className="text-[10px] text-[#557373]">
                    {isRtl ? "استدعاءات تفاعلية" : "Interactive calls"}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#060a0a] border border-[#121c1c] space-y-2">
                  <div className="text-[11px] font-mono text-[#557373]">{isRtl ? "مهام الساندبوكس والأدوات" : "Tool & Sandbox Tasks"}</div>
                  <div className="text-2xl font-bold text-[#38bdf8] font-mono">
                    {usageData.tool_calls_count || 0}
                  </div>
                  <div className="text-[10px] text-[#557373]">
                    {isRtl ? "تشغيل وتنفيذ أدوات" : "Executed tool calls"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 rounded-2xl bg-[#060a0a] border border-[#121c1c] text-center text-xs text-[#608080]">
                {isRtl ? "لم تقم بإجراء طلبات كافية بهذا النموذج بعد." : "No usage recorded for this model yet."}
              </div>
            )}
          </div>
        )}

        {/* 5. TOOLS TAB */}
        {activeTab === "tools" && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#f4f8f8]">
                {isRtl ? "الأدوات المتوافقة والمصرح بها (Supported Tool Integrations)" : "Supported Tool Integrations"}
              </h3>
              <p className="text-xs text-[#688585]">
                {isRtl
                  ? "الأدوات المتاحة فعلياً لهذا النموذج مع أذونات التشغيل ومستويات الأمان."
                  : "Verified tool execution capabilities with sandbox authorization."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {model.supported_tools.map((tool) => (
                <div
                  key={tool.id}
                  className="p-4.5 rounded-2xl bg-[#060a0a] border border-[#121c1c] hover:border-[#1b2b2b] transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#0c1414] border border-[#182626] flex items-center justify-center">
                          {getToolIcon(tool.id, { size: 18, accentColor: "#00d4aa" })}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#f4f8f8]">
                            {isRtl ? tool.nameAr : tool.nameEn}
                          </div>
                          <div className="text-[10px] font-mono text-[#557373]">{tool.id}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          tool.safetyLevel === "restricted"
                            ? "bg-red-500/15 text-red-400 border border-red-500/30"
                            : tool.safetyLevel === "elevated"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {tool.safetyLevel}
                      </span>
                    </div>

                    <p className="text-xs text-[#708e8e] leading-relaxed">
                      {isRtl ? tool.descriptionAr : tool.descriptionEn}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#111a1a] flex items-center justify-between">
                    <span className="text-[10px] text-[#4f6b6b] font-mono">
                      {tool.requiresSession ? (isRtl ? "يتطلب جلسة" : "Session required") : (isRtl ? "مستقل" : "Stateless")}
                    </span>

                    <button
                      onClick={() => setSelectedToolDrawer(tool)}
                      className="text-xs font-semibold text-[#00d4aa] hover:underline cursor-pointer"
                    >
                      {isRtl ? "فحص المخطط" : "View Schema"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#f4f8f8]">
                  {isRtl ? "سجل العمليات الآمن (Safe Activity Stream)" : "Safe Activity Stream"}
                </h3>
                <p className="text-xs text-[#688585]">
                  {isRtl
                    ? "ملخصات آمنة للطلبات المنفذة دون كشف بيانات حساسة أو Chain of Thought."
                    : "Safe, audited activity entries without revealing private tokens or secrets."}
                </p>
              </div>

              <button
                onClick={loadActivity}
                className="p-2 rounded-lg bg-[#0c1414] hover:bg-[#121e1e] text-[#658282] hover:text-[#00d4aa] border border-[#182626] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {activityLoading ? (
              <div className="p-8 text-center text-xs text-[#608080]">
                {isRtl ? "جارِ قراءة سجل العمليات..." : "Loading activity log..."}
              </div>
            ) : activityData && activityData.length > 0 ? (
              <div className="space-y-2 font-mono text-xs">
                {activityData.map((act: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#080d0d] border border-[#111a1a] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-[#f4f8f8]">{act.action}</span>
                      <span className="text-[#557373] text-[10px]">({act.tool || "inference"})</span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-[#557373]">
                      <span>{act.tokens} tokens</span>
                      <span>{act.duration_ms}ms</span>
                      <span>{act.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-[#080d0d] border border-[#111a1a] text-center text-xs text-[#608080]">
                {isRtl ? "لا توجد عمليات مسجلة حديثاً لهذا النموذج." : "No recent operations recorded."}
              </div>
            )}
          </div>
        )}

        {/* 7. LIMITS TAB */}
        {activeTab === "limits" && (
          <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#f4f8f8]">
                {isRtl ? "الحدود الفنية والتشغيلية (Operational Limits)" : "Operational Limits"}
              </h3>
              <p className="text-xs text-[#688585]">
                {isRtl
                  ? "الحدود المعتمدة من الـ Model Registry والمطبقة في الـ Runtime."
                  : "Enforced rate limits, token capacities, and concurrency barriers."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-5 rounded-2xl bg-[#080d0d] border border-[#131d1d] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "سياق الذاكرة" : "Context Token Limit"}</div>
                <div className="text-xl font-bold text-[#f4f8f8]">{model.capabilities.context_window_label}</div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "الحد الأقصى المسموح به من التوكنز في الاستدعاء الواحد." : "Hard token memory limit per inference call."}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#080d0d] border border-[#131d1d] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "أقصى مخرجات" : "Max Output Tokens"}</div>
                <div className="text-xl font-bold text-[#00d4aa]">
                  {model.limits.max_output_tokens.toLocaleString()} Tokens
                </div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "أقصى طول لنص الإجابة أو الشيفرة البرمجية المردودة." : "Maximum single generation output volume."}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#080d0d] border border-[#131d1d] space-y-2">
                <div className="text-[#557373] uppercase">{isRtl ? "معدل الطلبات RPM" : "Rate Limits"}</div>
                <div className="text-xl font-bold text-[#38bdf8]">{model.limits.rate_limits.rpm} RPM</div>
                <p className="text-[11px] text-[#708e8e] font-sans">
                  {isRtl ? "حماية تلقائية من إغراق الطلبات مع التبديل التلقائي الذكي." : "Smart router automatically fails over on 429 rate limit."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 8. CONFIGURATION TAB */}
        {activeTab === "configuration" && (
          <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#f4f8f8]">
                {isRtl ? "تخصيص معلمات النموذج (Inference Parameters)" : "Inference Parameters"}
              </h3>
              <p className="text-xs text-[#688585]">
                {isRtl
                  ? "ضبط المعلمات المسموح بها لحسابك الشخصي دون كشف أية مفاتيح أو أسرار خاصة بالمزود."
                  : "Adjust safe generation hyper-parameters for your authenticated profile."}
              </p>
            </div>

            <form onSubmit={handleSaveConfiguration} className="space-y-5 max-w-xl text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <label className="text-[#90b0b0] font-bold">{isRtl ? "درجة الحرارة (Temperature):" : "Temperature:"}</label>
                  <span className="text-[#00d4aa] font-bold">{tempValue}</span>
                </div>
                <input
                  type="range"
                  min={model.configuration_schema?.min_temperature || 0}
                  max={model.configuration_schema?.max_temperature || 1}
                  step="0.05"
                  value={tempValue}
                  onChange={(e) => setTempValue(parseFloat(e.target.value))}
                  className="w-full accent-[#00d4aa]"
                />
                <div className="flex justify-between text-[10px] text-[#557373] font-mono">
                  <span>0.0 ({isRtl ? "دقيق ومنطقي" : "Strict & Precise"})</span>
                  <span>1.0 ({isRtl ? "إبداعي ومتنوع" : "Creative & Broad"})</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <label className="text-[#90b0b0] font-bold">{isRtl ? "أقصى طول للمخرجات:" : "Max Output Tokens:"}</label>
                  <span className="text-[#00d4aa] font-bold">{tempMaxTokens.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max={model.limits.max_output_tokens}
                  step="1024"
                  value={tempMaxTokens}
                  onChange={(e) => setTempMaxTokens(parseInt(e.target.value))}
                  className="w-full accent-[#00d4aa]"
                />
              </div>

              <div className="pt-4 border-t border-[#111a1a] flex items-center justify-between">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#00d4aa] hover:bg-[#00e6b8] text-[#031111] font-bold transition-colors cursor-pointer"
                >
                  {configSaving ? (isRtl ? "جارِ الحفظ..." : "Saving...") : (isRtl ? "حفظ التخصيص" : "Save Parameters")}
                </button>

                {configSuccessMsg && (
                  <span className="text-emerald-400 text-xs flex items-center gap-1 font-sans">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{configSuccessMsg}</span>
                  </span>
                )}
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Tool Drawer Modal */}
      <AnimatePresence>
        {selectedToolDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-[#080d0d] border border-[#1a2c2c] p-6 space-y-5 shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedToolDrawer(null)}
                className="absolute top-4 end-4 p-1.5 rounded-lg text-[#658282] hover:text-[#f4f8f8] bg-[#0c1414] hover:bg-[#121e1e]"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0c1414] border border-[#182626] flex items-center justify-center">
                  {getToolIcon(selectedToolDrawer.id, { size: 22, accentColor: "#00d4aa" })}
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#f4f8f8]">
                    {isRtl ? selectedToolDrawer.nameAr : selectedToolDrawer.nameEn}
                  </h4>
                  <span className="text-[10px] font-mono text-[#557373]">{selectedToolDrawer.id}</span>
                </div>
              </div>

              <p className="text-xs text-[#88a5a5] leading-relaxed">
                {isRtl ? selectedToolDrawer.descriptionAr : selectedToolDrawer.descriptionEn}
              </p>

              <div className="rounded-xl bg-[#050808] border border-[#111a1a] p-4 font-mono text-xs space-y-2">
                <div className="text-[#557373] uppercase text-[10px]">{isRtl ? "مخطط الأداة:" : "Tool Schema Info:"}</div>
                <div className="text-[#00d4aa]">
                  {JSON.stringify({
                    tool_id: selectedToolDrawer.id,
                    safety_level: selectedToolDrawer.safetyLevel,
                    session_required: selectedToolDrawer.requiresSession,
                    status: selectedToolDrawer.available ? "operational" : "disabled",
                  }, null, 2)}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedToolDrawer(null)}
                  className="px-4 py-2 rounded-lg bg-[#0c1414] hover:bg-[#121e1e] text-xs font-semibold text-[#f4f8f8] border border-[#182626]"
                >
                  {isRtl ? "إغلاق" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Floating Bottom Bar with Back to Models & Actions */}
      <nav
        aria-label="Mobile Model Navigation"
        className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-[#070d0d]/95 backdrop-blur-2xl border border-[#142323] rounded-2xl px-2 py-1.5 flex items-center justify-around shadow-2xl shadow-black/80"
      >
        <Link
          href={`/${locale}`}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[#88b0b0] hover:text-[#00d4aa] transition-colors"
        >
          <Home className="w-4 h-4" />
          <span className="text-[10px]">{isRtl ? "الرئيسية" : "Home"}</span>
        </Link>

        <Link
          href={`/${locale}/models`}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[#00d4aa] font-bold"
        >
          {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span className="text-[10px]">{isRtl ? "النماذج" : "Models"}</span>
        </Link>

        <Link
          href={`/${locale}/models/compare`}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[#88b0b0] hover:text-[#00d4aa] transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-[10px]">{isRtl ? "المقارنة" : "Compare"}</span>
        </Link>

        <Link
          href={`/${locale}/chat?model=${model.model_id}`}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[#00d4aa] font-bold"
        >
          <Zap className="w-4 h-4 text-[#00d4aa]" />
          <span className="text-[10px]">{isRtl ? "تشغيل" : "Launch"}</span>
        </Link>
      </nav>
    </div>
  );
};
