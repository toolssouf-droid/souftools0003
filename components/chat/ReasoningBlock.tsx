"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Scale,
  Gauge,
  Lightbulb,
} from "lucide-react";
import { isRtlLocale } from "@/lib/i18n";

interface ReasoningBlockProps {
  reasoningMode?: "deep_thinking" | "deep_analysis" | "fast_mode";
  reasoningSteps?: string[];
  reflectionSteps?: string[];
  hypotheses?: string[];
  confidenceScore?: number;
  locale: string;
}

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({
  reasoningMode,
  reasoningSteps = [],
  reflectionSteps = [],
  hypotheses = [],
  confidenceScore,
  locale,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isRtl = isRtlLocale(locale);

  if (!reasoningMode && (!reasoningSteps || reasoningSteps.length === 0)) {
    return null;
  }

  const getModeDetails = () => {
    switch (reasoningMode) {
      case "deep_thinking":
        return {
          title: isRtl ? "سلسلة التفكير الاستدلالي العميق (Tree of Thoughts & Reflexion)" : "Deep Reasoning Engine (Tree of Thoughts & Reflexion)",
          badge: isRtl ? "استدلال معرفي متقدم" : "Cognitive Reasoning",
          icon: Brain,
          color: "#00d4aa",
          bgGlow: "rgba(0, 212, 170, 0.08)",
          borderColor: "rgba(0, 212, 170, 0.25)",
        };
      case "deep_analysis":
        return {
          title: isRtl ? "مُحرك التحليل المقارن والاستكشاف المتوازي" : "Deep Analysis & Exploration Engine",
          badge: isRtl ? "تحليل عميق" : "Deep Analysis",
          icon: Activity,
          color: "#0ea5e9",
          bgGlow: "rgba(14, 165, 233, 0.08)",
          borderColor: "rgba(14, 165, 233, 0.25)",
        };
      case "fast_mode":
        return {
          title: isRtl ? "مُحرك الاستجابة السريعة المباشرة" : "Fast Direct Response Engine",
          badge: isRtl ? "الوضع السريع" : "Fast Mode",
          icon: Zap,
          color: "#a855f7",
          bgGlow: "rgba(168, 85, 247, 0.08)",
          borderColor: "rgba(168, 85, 247, 0.25)",
        };
      default:
        return {
          title: isRtl ? "سلسلة الاستدلال المنطقي متعدد المسارات" : "Multi-Path Logical Reasoning Chain",
          badge: isRtl ? "استدلال مستقل" : "Cognitive Loop",
          icon: Sparkles,
          color: "#00d4aa",
          bgGlow: "rgba(0, 212, 170, 0.08)",
          borderColor: "rgba(0, 212, 170, 0.25)",
        };
    }
  };

  const mode = getModeDetails();
  const IconComponent = mode.icon;
  const score = confidenceScore !== undefined ? confidenceScore : 98;

  return (
    <div className="w-full my-2.5 select-none" dir={isRtl ? "rtl" : "ltr"}>
      <div
        className="rounded-xl transition-all duration-200 border backdrop-blur-sm"
        style={{
          backgroundColor: mode.bgGlow,
          borderColor: mode.borderColor,
        }}
      >
        {/* Main Header Bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-right hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="p-1.5 rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,212,170,0.15)]"
              style={{ backgroundColor: `${mode.color}20`, color: mode.color }}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-right">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-[#e8f5f5]">
                  {mode.title}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1"
                  style={{
                    color: mode.color,
                    borderColor: `${mode.color}40`,
                    backgroundColor: `${mode.color}15`,
                  }}
                >
                  <GitBranch className="w-2.5 h-2.5" />
                  {mode.badge}
                </span>

                {score > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>{isRtl ? `ثقة الاستدلال: ${score}%` : `Confidence: ${score}%`}</span>
                  </span>
                )}
              </div>

              {reasoningSteps.length > 0 && (
                <span className="text-[11px] text-[#00d4aa] font-medium mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
                  {isRtl
                    ? `تم تنفيذ وتدقيق ${reasoningSteps.length} خطوات استدلال منطقي ونقد ذاتي`
                    : `${reasoningSteps.length} cognitive reasoning & reflection steps executed`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[#4a7070] shrink-0 text-xs font-semibold">
            <span>
              {isExpanded
                ? isRtl ? "إخفاء التفاصيل" : "Hide"
                : isRtl ? "عرض سلسلة التفكير" : "View Chain"}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Collapsible Steps Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-[#1e2e2e]/50 px-3.5 py-3.5 space-y-3"
            >
              {/* Cognitive Phase Flow Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 rounded-lg bg-[#0c1414]/70 border border-[#1e2e2e]/60 text-[11px]">
                <div className="flex items-center gap-1.5 text-[#00d4aa] font-semibold">
                  <span>🎯</span>
                  <span>{isRtl ? "1. تفكيك الهدف" : "1. Goal"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                  <span>💡</span>
                  <span>{isRtl ? "2. فرضيات ToT" : "2. Hypotheses"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <span>⚖️</span>
                  <span>{isRtl ? "3. نقد ذاتي" : "3. Reflexion"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span>💎</span>
                  <span>{isRtl ? "4. الصياغة التامة" : "4. Synthesis"}</span>
                </div>
              </div>

              {/* Hypotheses Exploration Cards (Tree of Thoughts) */}
              {hypotheses.length > 0 && (
                <div className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>{isRtl ? "مسارات الحل المستكشفة (Tree of Thoughts):" : "Explored Solution Branches (ToT):"}</span>
                  </div>
                  <div className="space-y-1.5">
                    {hypotheses.map((h, hIdx) => (
                      <div key={hIdx} className="text-xs text-sky-200/90 flex items-start gap-2 bg-sky-900/20 p-2 rounded border border-sky-500/15">
                        <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded shrink-0">
                          {isRtl ? `مسار ${hIdx + 1}` : `Path ${hIdx + 1}`}
                        </span>
                        <span className="flex-1">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Self-Reflection Log (Reflexion) */}
              {reflectionSteps.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Scale className="w-3.5 h-3.5" />
                    <span>{isRtl ? "تقييم الجودة والنقد الذاتي (Self-Reflection):" : "Self-Correction & Quality Critique:"}</span>
                  </div>
                  {reflectionSteps.map((r, rIdx) => (
                    <p key={rIdx} className="text-xs text-amber-200/90 leading-relaxed bg-amber-900/20 p-2 rounded border border-amber-500/15">
                      {r}
                    </p>
                  ))}
                </div>
              )}

              {/* Detailed Reasoning Steps List */}
              {reasoningSteps.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-[#80a8a8] flex items-center gap-1">
                    <Activity className="w-3 h-3 text-[#00d4aa]" />
                    <span>{isRtl ? "السجل التنفيذي للاستدلال والملاحظات:" : "Reasoning Trajectory Log:"}</span>
                  </div>
                  {reasoningSteps.map((step, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-start gap-2.5 text-xs text-[#c2e0e0] leading-relaxed bg-[#0c1414]/70 p-2.5 rounded-lg border border-[#1e2e2e]/50"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]"
                        style={{ backgroundColor: `${mode.color}20`, color: mode.color }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[#e8f5f5]">{step}</p>
                      </div>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00d4aa] shrink-0 mt-0.5 opacity-80" />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

