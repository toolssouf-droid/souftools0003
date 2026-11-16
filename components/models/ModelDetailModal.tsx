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
} from "@/components/icons/SoufIcons";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  CheckCircle2,
  Zap,
  Terminal,
  Activity,
  Cpu,
  Code2,
  Brain,
  ShieldCheck,
  RefreshCw,
  BarChart2,
  Settings,
  Layers,
  X,
  Clock,
  Maximize2,
} from "lucide-react";

interface ModelDetailModalProps {
  locale: string;
  isRtl: boolean;
  model: SoufModelRegistryEntry | null;
  onClose: () => void;
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

export const ModelDetailModal: React.FC<ModelDetailModalProps> = ({
  locale,
  isRtl,
  model,
  onClose,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedToolDrawer, setSelectedToolDrawer] = useState<ModelToolCapability | null>(null);

  // Telemetry states
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfRange, setPerfRange] = useState<string>("7d");

  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageRange, setUsageRange] = useState<string>("7d");

  const [activityData, setActivityData] = useState<any>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  const [tempValue, setTempValue] = useState<number>(0.7);
  const [tempMaxTokens, setTempMaxTokens] = useState<number>(8192);

  useEffect(() => {
    if (model) {
      setActiveTab("overview");
      setTempValue(model.configuration_schema?.default_temperature || 0.7);
      setTempMaxTokens(model.limits.max_output_tokens || 8192);
    }
  }, [model]);

  useEffect(() => {
    if (!model) return;
    if (activeTab === "performance") {
      setPerfLoading(true);
      fetch(`/api/v1/models/${model.model_id}/performance?range=${perfRange}`)
        .then((res) => (res.ok ? res.json().catch(() => null) : null))
        .then((data) => {
          if (data && data.success) setPerformanceData(data.performance);
        })
        .finally(() => setPerfLoading(false));
    } else if (activeTab === "usage") {
      setUsageLoading(true);
      fetch(`/api/v1/models/${model.model_id}/usage?range=${usageRange}`)
        .then((res) => (res.ok ? res.json().catch(() => null) : null))
        .then((data) => {
          if (data && data.success) setUsageData(data.usage);
        })
        .finally(() => setUsageLoading(false));
    } else if (activeTab === "activity") {
      setActivityLoading(true);
      fetch(`/api/v1/models/${model.model_id}/activity`)
        .then((res) => (res.ok ? res.json().catch(() => null) : null))
        .then((data) => {
          if (data && data.success) setActivityData(data.activity);
        })
        .finally(() => setActivityLoading(false));
    }
  }, [activeTab, model, perfRange, usageRange]);

  if (!model) return null;

  const accent = model.identity.accentColor;

  const tabItems: { id: TabType; labelAr: string; labelEn: string; icon: any }[] = [
    { id: "overview", labelAr: "نظرة عامة", labelEn: "Overview", icon: Layers },
    { id: "capabilities", labelAr: "القدرات", labelEn: "Capabilities", icon: Cpu },
    { id: "performance", labelAr: "الأداء الحقيقي", labelEn: "Performance", icon: BarChart2 },
    { id: "usage", labelAr: "الاستهلاك", labelEn: "Usage", icon: Activity },
    { id: "tools", labelAr: "الأدوات", labelEn: "Tools", icon: Terminal },
    { id: "activity", labelAr: "النشاط", labelEn: "Activity", icon: Clock },
    { id: "limits", labelAr: "الحدود", labelEn: "Limits", icon: ShieldCheck },
    { id: "configuration", labelAr: "الإعدادات", labelEn: "Settings", icon: Settings },
  ];

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

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/models/${model.model_id}/configuration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temperature: tempValue,
          max_output_tokens: tempMaxTokens,
        }),
      });
      if (res.ok) {
        setConfigSuccessMsg(isRtl ? "تم حفظ الإعدادات" : "Saved successfully");
        setTimeout(() => setConfigSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.warn("Config save error:", err);
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#000000]/85 backdrop-blur-md overflow-y-auto font-sans"
      dir={isRtl ? "rtl" : "ltr"}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-[#060a0a] border border-[#142222] shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-[#e8f2f2] relative my-auto"
        style={{
          boxShadow: `0 0 50px ${accent}15`,
        }}
      >
        {/* Top Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#121c1c] bg-[#050808] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border shrink-0"
              style={{
                backgroundColor: `${accent}18`,
                borderColor: `${accent}40`,
              }}
            >
              {getModelIcon(model.model_id, {
                size: 24,
                accentColor: accent,
                glow: true,
              })}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-[#f4f8f8]">
                  {model.display_name}
                </h3>
                <span
                  className="text-[10px] sm:text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border"
                  style={{
                    color: accent,
                    backgroundColor: `${accent}15`,
                    borderColor: `${accent}35`,
                  }}
                >
                  {isRtl ? model.identity.badgeAr : model.identity.badgeEn}
                </span>
              </div>
              <p className="text-xs text-[#708e8e] truncate max-w-md">
                {isRtl ? model.identity.taglineAr : model.identity.taglineEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/${locale}/models/${model.model_id}`}
              title={isRtl ? "فتح في صفحة كاملة مستقلة" : "Open in full page"}
              className="p-2 rounded-lg bg-[#0c1414] hover:bg-[#142020] text-[#708e8e] hover:text-[#00d4aa] border border-[#142222] transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </Link>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#0c1414] hover:bg-[#142020] text-[#708e8e] hover:text-[#f4f8f8] border border-[#142222] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Tabs Bar */}
        <div className="px-3 sm:px-5 py-2 border-b border-[#121c1c] bg-[#070b0b] flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0c1818] text-[#f4f8f8] font-bold border border-[#1d2e2e]"
                    : "text-[#658282] hover:text-[#c0d6d6] hover:bg-[#090f0f]"
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

        {/* Scrollable Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] text-xs text-[#90abab] leading-relaxed">
                {isRtl ? model.identity.descriptionAr : model.identity.descriptionEn}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-3">
                  <div className="text-xs font-bold text-[#f4f8f8] flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#00d4aa]" />
                    <span>{isRtl ? "الميزات والخصائص" : "Core Features"}</span>
                  </div>
                  <div className="space-y-2 text-xs text-[#90abab]">
                    {model.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2
                          className="w-3.5 h-3.5 shrink-0 mt-0.5"
                          style={{ color: accent }}
                        />
                        <span>{isRtl ? f.ar : f.en}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-3">
                  <div className="text-xs font-bold text-[#f4f8f8] flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-[#00d4aa]" />
                    <span>{isRtl ? "الاستخدامات الموصى بها" : "Recommended Workflows"}</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#90abab]">
                    {(isRtl ? model.identity.idealForAr : model.identity.idealForEn).map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: accent }}
                        />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CAPABILITIES */}
          {activeTab === "capabilities" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1.5">
                <div className="text-[#557373] text-[11px]">{isRtl ? "نافذة السياق" : "Context Window"}</div>
                <div className="text-base font-bold text-[#f4f8f8]">{model.capabilities.context_window_label}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1.5">
                <div className="text-[#557373] text-[11px]">{isRtl ? "مستوى التفكير" : "Reasoning"}</div>
                <div className="text-base font-bold text-[#f4f8f8] capitalize">{getReasoningLabel(model.capabilities.reasoning_level)}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1.5">
                <div className="text-[#557373] text-[11px]">{isRtl ? "مستوى البرمجة" : "Coding"}</div>
                <div className="text-base font-bold text-[#f4f8f8] capitalize">{getCodingLabel(model.capabilities.coding_level)}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1.5">
                <div className="text-[#557373] text-[11px]">{isRtl ? "الرؤية وفحص الصور" : "Vision"}</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isRtl ? "مدعوم" : "Active"}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1.5">
                <div className="text-[#557373] text-[11px]">{isRtl ? "البحث في الويب" : "Web Grounding"}</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{model.capabilities.web ? (isRtl ? "مفعل" : "Live Search") : (isRtl ? "غير مفعل" : "Off")}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1.5">
                <div className="text-[#557373] text-[11px]">{isRtl ? "ساندبوكس معزول" : "Code Sandbox"}</div>
                <div className="text-sm font-bold text-[#00d4aa]">
                  {model.supported_tools.some((t) => t.id === "sandbox" && t.available)
                    ? "E2B Enabled"
                    : isRtl ? "غير مفعل" : "Disabled"}
                </div>
              </div>
            </div>
          )}

          {/* PERFORMANCE */}
          {activeTab === "performance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#708e8e]">{isRtl ? "قياسات الأداء الحقيقية:" : "Telemetry stats:"}</span>
                <div className="flex items-center gap-1 bg-[#080d0d] border border-[#121c1c] p-1 rounded-lg">
                  {["today", "7d", "30d"].map((rng) => (
                    <button
                      key={rng}
                      onClick={() => setPerfRange(rng)}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-mono ${
                        perfRange === rng ? "bg-[#00d4aa] text-[#031111] font-bold" : "text-[#557373]"
                      }`}
                    >
                      {rng.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {perfLoading ? (
                <div className="p-8 text-center text-xs text-[#608080]">
                  <RefreshCw className="w-4 h-4 text-[#00d4aa] animate-spin mx-auto mb-2" />
                  <span>{isRtl ? "جارِ قراءة القياسات..." : "Loading telemetry..."}</span>
                </div>
              ) : performanceData ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3.5 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                    <div className="text-[10px] text-[#557373]">{isRtl ? "نسبة النجاح" : "Success Rate"}</div>
                    <div className="text-lg font-bold text-emerald-400">{performanceData.success_rate}%</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                    <div className="text-[10px] text-[#557373]">{isRtl ? "متوسط الاستجابة" : "Avg Latency"}</div>
                    <div className="text-lg font-bold text-[#f4f8f8]">{performanceData.latency_average_ms}ms</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                    <div className="text-[10px] text-[#557373]">{isRtl ? "سرعة التوكنز" : "Throughput"}</div>
                    <div className="text-lg font-bold text-[#00d4aa]">{performanceData.throughput_tokens_sec} T/s</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                    <div className="text-[10px] text-[#557373]">{isRtl ? "التوافر والجاهزية" : "Uptime"}</div>
                    <div className="text-lg font-bold text-[#38bdf8]">{performanceData.availability_uptime}%</div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* USAGE */}
          {activeTab === "usage" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#708e8e]">{isRtl ? "استهلاكك الشخصي:" : "Your usage:"}</span>
                <div className="flex items-center gap-1 bg-[#080d0d] border border-[#121c1c] p-1 rounded-lg">
                  {["today", "7d", "30d"].map((rng) => (
                    <button
                      key={rng}
                      onClick={() => setUsageRange(rng)}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-mono ${
                        usageRange === rng ? "bg-[#00d4aa] text-[#031111] font-bold" : "text-[#557373]"
                      }`}
                    >
                      {rng.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {usageLoading ? (
                <div className="p-8 text-center text-xs text-[#608080]">
                  <RefreshCw className="w-4 h-4 text-[#00d4aa] animate-spin mx-auto mb-2" />
                  <span>{isRtl ? "جارِ الحساب..." : "Calculating..."}</span>
                </div>
              ) : usageData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                    <div className="text-[10px] text-[#557373]">{isRtl ? "التوكنز المستهلكة" : "Tokens"}</div>
                    <div className="text-lg font-bold text-[#00d4aa]">{usageData.total_tokens?.toLocaleString() || 0}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                    <div className="text-[10px] text-[#557373]">{isRtl ? "الطلبات" : "Requests"}</div>
                    <div className="text-lg font-bold text-[#f4f8f8]">{usageData.total_requests || 0}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                    <div className="text-[10px] text-[#557373]">{isRtl ? "استدعاءات الأدوات" : "Tool Calls"}</div>
                    <div className="text-lg font-bold text-[#38bdf8]">{usageData.tool_calls_count || 0}</div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TOOLS */}
          {activeTab === "tools" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {model.supported_tools.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#0c1414] border border-[#182626] flex items-center justify-center">
                        {getToolIcon(t.id, { size: 16, accentColor: "#00d4aa" })}
                      </div>
                      <span className="font-bold text-[#f4f8f8]">{isRtl ? t.nameAr : t.nameEn}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#557373]">{t.safetyLevel}</span>
                  </div>
                  <p className="text-[11px] text-[#708e8e]">{isRtl ? t.descriptionAr : t.descriptionEn}</p>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVITY */}
          {activeTab === "activity" && (
            <div className="space-y-2 text-xs font-mono">
              {activityLoading ? (
                <div className="p-8 text-center text-xs text-[#608080]">{isRtl ? "جارِ جلب السجل..." : "Loading..."}</div>
              ) : activityData && activityData.length > 0 ? (
                activityData.map((act: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-[#080d0d] border border-[#111a1a] flex items-center justify-between">
                    <span className="text-[#f4f8f8]">{act.action}</span>
                    <span className="text-[#557373] text-[10px]">{act.duration_ms}ms</span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-[#608080]">{isRtl ? "لا توجد عمليات حديثة" : "No recent operations"}</div>
              )}
            </div>
          )}

          {/* LIMITS */}
          {activeTab === "limits" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                <div className="text-[10px] text-[#557373]">{isRtl ? "الذاكرة القصوى" : "Max Context"}</div>
                <div className="text-base font-bold text-[#f4f8f8]">{model.capabilities.context_window_label}</div>
              </div>
              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                <div className="text-[10px] text-[#557373]">{isRtl ? "أقصى مخرجات" : "Max Output"}</div>
                <div className="text-base font-bold text-[#00d4aa]">{model.limits.max_output_tokens.toLocaleString()} Tokens</div>
              </div>
              <div className="p-4 rounded-xl bg-[#080d0d] border border-[#131d1d] space-y-1">
                <div className="text-[10px] text-[#557373]">{isRtl ? "معدل الطلبات" : "RPM"}</div>
                <div className="text-base font-bold text-[#38bdf8]">{model.limits.rate_limits.rpm} RPM</div>
              </div>
            </div>
          )}

          {/* CONFIGURATION */}
          {activeTab === "configuration" && (
            <form onSubmit={handleSaveConfiguration} className="space-y-4 max-w-lg text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono">
                  <span className="text-[#88a5a5]">{isRtl ? "درجة الحرارة (Temperature):" : "Temperature:"}</span>
                  <span className="text-[#00d4aa] font-bold">{tempValue}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={tempValue}
                  onChange={(e) => setTempValue(parseFloat(e.target.value))}
                  className="w-full accent-[#00d4aa]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-mono">
                  <span className="text-[#88a5a5]">{isRtl ? "أقصى مخرجات:" : "Max Output Tokens:"}</span>
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

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="px-4 py-2 rounded-xl bg-[#00d4aa] text-[#031111] font-bold text-xs cursor-pointer"
                >
                  {configSaving ? (isRtl ? "حفظ..." : "Saving...") : (isRtl ? "حفظ الإعدادات" : "Save Settings")}
                </button>
                {configSuccessMsg && (
                  <span className="text-emerald-400 text-xs">{configSuccessMsg}</span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#121c1c] bg-[#050808] flex items-center justify-between gap-3 shrink-0">
          <Link
            href={`/${locale}/models/${model.model_id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#80a0a0] hover:text-[#f4f8f8]"
          >
            <span>{isRtl ? "صفحة التفاصيل الكاملة" : "Full standalone page"}</span>
            {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#0c1414] hover:bg-[#142020] text-xs font-semibold text-[#f4f8f8] border border-[#182626] cursor-pointer"
            >
              {isRtl ? "إغلاق" : "Close"}
            </button>

            <Link
              href={`/${locale}/chat?model=${model.model_id}`}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: accent,
                color: "#031111",
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isRtl ? "بدء محادثة بهذا النموذج" : "Launch in Chat"}</span>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
