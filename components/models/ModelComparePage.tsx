"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  SoufSparkIcon,
  SoufCoreIcon,
  SoufProIcon,
  SoufCoderIcon,
  SoufUltraIcon,
  getModelIcon,
} from "@/components/icons/SoufIcons";
import { SoufModelRegistryEntry, getAllModels } from "@/lib/models/modelRegistry";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import {
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Zap,
  Terminal,
  Brain,
  ShieldCheck,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

interface ModelComparePageProps {
  locale: string;
  isRtl: boolean;
  initialModels?: SoufModelRegistryEntry[];
}

export const ModelComparePage: React.FC<ModelComparePageProps> = ({
  locale,
  isRtl,
  initialModels = [],
}) => {
  const fallbackModels = getAllModels();
  const [models, setModels] = useState<SoufModelRegistryEntry[]>(
    initialModels.length > 0 ? initialModels : fallbackModels
  );
  const [selectedModels, setSelectedModels] = useState<string[]>(
    models.map((m) => m.model_id)
  );

  useEffect(() => {
    fetch("/api/v1/models")
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (data && data.success && Array.isArray(data.models)) {
          setModels(data.models);
        }
      })
      .catch(() => {});
  }, []);

  const toggleModel = (id: string) => {
    if (selectedModels.includes(id)) {
      if (selectedModels.length > 2) {
        setSelectedModels(selectedModels.filter((m) => m !== id));
      }
    } else {
      setSelectedModels([...selectedModels, id]);
    }
  };

  const modelsToDisplay = models.filter((m) => selectedModels.includes(m.model_id));

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
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "المقارنة الفنية الشاملة بين النماذج" : "Comprehensive Technical Model Matrix"}
        subtitle={isRtl ? "مقارنة دقيقة لقدرات وسرعات وسياق النماذج ومجالات الاستخدام" : "Deep benchmark matrix and model capabilities"}
        icon={<SlidersHorizontal className="w-4 h-4 text-[#00d4aa]" />}
        backHref={`/${locale}/models`}
        backLabel={isRtl ? "مركز النماذج" : "Model Center"}
        activeKey="models"
        actions={
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-[11px] font-mono text-[#506e6e] hidden lg:inline">
              {isRtl ? "النماذج:" : "Models:"}
            </span>
            {models.map((m) => {
              const active = selectedModels.includes(m.model_id);
              return (
                <button
                  key={m.model_id}
                  onClick={() => toggleModel(m.model_id)}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono transition-all cursor-pointer border whitespace-nowrap ${
                    active
                      ? "bg-[#00d4aa]/15 text-[#00d4aa] border-[#00d4aa]/40 font-bold"
                      : "bg-[#080e0e] text-[#557070] border-[#121c1c] hover:text-[#88a5a5]"
                  }`}
                >
                  {m.display_name.replace("SoufAI ", "")}
                </button>
              );
            })}
          </div>
        }
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Intro */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00d4aa] font-mono uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "المقارنة الهندسية الصريحة" : "Direct Architectural Benchmark"}</span>
          </div>
          <p className="text-xs text-[#708e8e]">
            {isRtl
              ? "مقارنة دقيقة مبنية على سجل النماذج المركزي (Central Registry) وبدون تقييمات عشوائية أو بيانات صورية."
              : "Side-by-side technical evaluation mapped directly to runtime capabilities, limits, and sandbox authorization."}
          </p>
        </div>

        {/* Matrix Table */}
        <div className="rounded-2xl border border-[#121c1c] bg-[#060a0a] overflow-x-auto shadow-2xl">
          <table className="w-full text-xs text-start border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-[#121c1c] bg-[#070e0e]">
                <th className="py-4 px-5 text-start text-[#506e6e] font-mono uppercase text-[11px] w-48">
                  {isRtl ? "المعيار / الخاصية" : "Specification"}
                </th>
                {modelsToDisplay.map((m) => (
                  <th key={m.model_id} className="py-4 px-5 text-start">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0"
                        style={{
                          backgroundColor: `${m.identity.accentColor}15`,
                          borderColor: `${m.identity.accentColor}40`,
                        }}
                      >
                        {getModelIcon(m.model_id, {
                          size: 16,
                          accentColor: m.identity.accentColor,
                        })}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-[#f4f8f8] text-xs">
                          {m.display_name}
                        </div>
                        <div
                          className="text-[10px] font-mono font-semibold"
                          style={{ color: m.identity.accentColor }}
                        >
                          {isRtl ? m.identity.badgeAr : m.identity.badgeEn}
                        </div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#0e1616]">
              {/* Target / Primary Purpose */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "التخصص والهدف الأساسي" : "Specialization"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-3.5 px-5 text-[#b0cccc] leading-relaxed">
                    {isRtl ? m.identity.taglineAr : m.identity.taglineEn}
                  </td>
                ))}
              </tr>

              {/* Context Window */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "سياق الذاكرة والنافذة" : "Context Window"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-3.5 px-5 font-bold text-[#f4f8f8] font-mono">
                    {m.capabilities.context_window_label}
                  </td>
                ))}
              </tr>

              {/* Reasoning Level */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "مستوى الاستدلال المنطقي" : "Reasoning Level"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-3.5 px-5">
                    <span
                      className="px-2.5 py-1 rounded text-[11px] font-mono font-bold inline-block"
                      style={{
                        color: m.identity.accentColor,
                        backgroundColor: `${m.identity.accentColor}15`,
                        border: `1px solid ${m.identity.accentColor}30`,
                      }}
                    >
                      {getReasoningLabel(m.capabilities.reasoning_level)}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Coding Level */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "هندسة البرمجيات والكود" : "Software Engineering"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-3.5 px-5">
                    <span className="text-[#d8e6e6] font-medium text-xs">
                      {getCodingLabel(m.capabilities.coding_level)}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Max Output Tokens */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "أقصى مخرجات للرد (Max Output)" : "Max Output Tokens"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-3.5 px-5 text-[#00d4aa] font-bold font-mono">
                    {m.limits.max_output_tokens.toLocaleString()} Tokens
                  </td>
                ))}
              </tr>

              {/* Vision Modality */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "فحص وتحليل الصور (Vision)" : "Vision Modality"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-3.5 px-5">
                    {m.capabilities.vision ? (
                      <div className="flex items-center gap-1.5 text-[#00d4aa]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-[11px] text-[#90adad]">
                          {isRtl ? m.capabilities.vision_notes_ar : m.capabilities.vision_notes_en}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[#506e6e]">
                        <XCircle className="w-4 h-4" />
                        <span className="text-[11px]">{isRtl ? "نصي فقط" : "Text Only"}</span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              {/* Code Sandbox E2B */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "ساندبوكس تشغيل الكود (Sandbox)" : "Code Sandbox"}
                </td>
                {modelsToDisplay.map((m) => {
                  const hasSandbox = m.supported_tools.some((t) => t.id === "sandbox" && t.available);
                  return (
                    <td key={m.model_id} className="py-3.5 px-5">
                      {hasSandbox ? (
                        <div className="flex items-center gap-1.5 text-[#00d4aa] font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isRtl ? "بيئة E2B معزولة" : "E2B Isolated"}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[#506e6e]">
                          <XCircle className="w-4 h-4" />
                          <span>{isRtl ? "غير مفعل" : "Disabled"}</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Web Grounding */}
              <tr className="hover:bg-[#0a1010]">
                <td className="py-3.5 px-5 text-[#658282] font-semibold">
                  {isRtl ? "البحث المباشر في الويب (Search)" : "Web Search"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-3.5 px-5">
                    {m.capabilities.web ? (
                      <div className="flex items-center gap-1.5 text-[#00d4aa]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isRtl ? "بحث حي" : "Live Search"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[#506e6e]">
                        <XCircle className="w-4 h-4" />
                        <span>{isRtl ? "غير مفعل" : "Disabled"}</span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              {/* Direct Route Action */}
              <tr className="bg-[#050808]">
                <td className="py-4 px-5 text-[#506e6e] font-mono text-[11px]">
                  {isRtl ? "الانتقال للواجهة المخصصة" : "Direct Route"}
                </td>
                {modelsToDisplay.map((m) => (
                  <td key={m.model_id} className="py-4 px-5">
                    <Link
                      href={`/${locale}/models/${m.model_id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer"
                      style={{
                        color: m.identity.accentColor,
                        backgroundColor: `${m.identity.accentColor}12`,
                        borderColor: `${m.identity.accentColor}35`,
                      }}
                    >
                      <span>{isRtl ? "فتح صفحة النموذج" : "Open Page"}</span>
                      {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};
