"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  SoufAIIcon,
  SoufSparkIcon,
  SoufCoreIcon,
  SoufProIcon,
  SoufCoderIcon,
  SoufUltraIcon,
  getModelIcon,
} from "@/components/icons/SoufIcons";
import { SoufModelRegistryEntry, getAllModels } from "@/lib/models/modelRegistry";
import { ModelDetailModal } from "@/components/models/ModelDetailModal";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Zap,
  Search,
  Terminal,
  Activity,
  Cpu,
  ChevronRight,
  ExternalLink,
  Code2,
  Brain,
  CheckCircle2,
  BarChart2,
  ShieldCheck,
} from "lucide-react";

interface ModelCenterHomeProps {
  locale: string;
  isRtl: boolean;
  initialModels?: SoufModelRegistryEntry[];
}

export const ModelCenterHome: React.FC<ModelCenterHomeProps> = ({
  locale,
  isRtl,
  initialModels = [],
}) => {
  const router = useRouter();
  const fallbackModels = useMemo(() => getAllModels(), []);
  const [models, setModels] = useState<SoufModelRegistryEntry[]>(
    initialModels.length > 0 ? initialModels : fallbackModels
  );
  const [selectedHoverModel, setSelectedHoverModel] = useState<string>("coder");
  const [activeModalModel, setActiveModalModel] = useState<SoufModelRegistryEntry | null>(null);

  // Smart Task Intent Dispatcher State
  const [taskPrompt, setTaskPrompt] = useState("");
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendationResult, setRecommendationResult] = useState<any>(null);

  useEffect(() => {
    fetch("/api/v1/models")
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (data && data.success && Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
        }
      })
      .catch((err) => console.warn("Models fetch notice:", err));
  }, []);

  const handleModelClick = (e: React.MouseEvent, model: SoufModelRegistryEntry) => {
    e.preventDefault();
    setActiveModalModel(model);
  };

  const handleRecommend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!taskPrompt.trim() || isRecommending) return;

    setIsRecommending(true);
    try {
      const res = await fetch("/api/v1/models/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskPrompt }),
      });
      if (!res.ok) throw new Error("Recommendation endpoint error");
      const data = await res.json().catch(() => null);
      if (data && data.success && data.recommended) {
        setRecommendationResult(data);
      }
    } catch (err) {
      console.warn("Recommendation fallback notice:", err);
      // Fallback local heuristic
      const lower = taskPrompt.toLowerCase();
      let matchedId = "core";
      if (
        lower.includes("code") ||
        lower.includes("برمج") ||
        lower.includes("تطبيق") ||
        lower.includes("saas") ||
        lower.includes("html")
      ) {
        matchedId = "coder";
      } else if (
        lower.includes("بحث") ||
        lower.includes("تحليل") ||
        lower.includes("معقد") ||
        lower.includes("reasoning")
      ) {
        matchedId = "pro";
      } else if (lower.includes("سريع") || lower.includes("تلخيص") || lower.includes("spark")) {
        matchedId = "spark";
      } else if (
        lower.includes("وكيل") ||
        lower.includes("agent") ||
        lower.includes("ultra") ||
        lower.includes("مستقل")
      ) {
        matchedId = "ultra";
      }
      const targetModel = models.find((m) => m.model_id === matchedId) || models[0];
      setRecommendationResult({
        success: true,
        recommended: {
          model_id: targetModel.model_id,
          display_name: targetModel.display_name,
          accentColor: targetModel.identity.accentColor,
          reasonsAr: targetModel.identity.idealForAr,
          reasonsEn: targetModel.identity.idealForEn,
        },
      });
    } finally {
      setIsRecommending(false);
    }
  };

  const sampleTasks = [
    {
      labelAr: "تطبيق ويب مع ساندبوكس",
      prompt: "ابنِ تطبيق SaaS متكامل مع ساندبوكس لتشغيل واختبار الكود",
      targetId: "coder",
    },
    {
      labelAr: "تحليل استدلالي معمق",
      prompt: "أريد تحليلاً علمياً دقيقاً يقارن بين مصادر متعددة",
      targetId: "pro",
    },
    {
      labelAr: "وكيل ذكي مستقل",
      prompt: "أريد وكيلاً ينفذ مهام متعددة الخطوات تلقائياً",
      targetId: "ultra",
    },
    {
      labelAr: "محادثة فائقة السرعة",
      prompt: "أريد إجابات سريعة وتلخيص فوري للمقالات",
      targetId: "spark",
    },
  ];

  return (
    <div
      className="w-full min-h-screen bg-[#0a0c10] text-[#f1f5f9] font-sans selection:bg-[#00d4aa]/25 selection:text-[#00d4aa] pb-24"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top Navigation & Status Bar */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "مركز نماذج الذكاء الاصطناعي" : "SoufAI Model Center"}
        subtitle={isRtl ? "استكشف، قارن، ووجه مهامك للنموذج الأنسب" : "Model hub & smart intent dispatcher"}
        icon={<Cpu className="w-4 h-4 text-[#00d4aa]" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="models"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/models/compare`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#00d4aa] bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 border border-[#00d4aa]/30 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isRtl ? "مصفوفة المقارنة" : "Compare Matrix"}</span>
            </Link>
          </div>
        }
      />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-8">
        {/* CENTERPIECE: ORBIT ARCHITECTURAL VISUAL WITH ACTIVE RINGS */}
        <div className="relative flex flex-col items-center justify-center pt-2 pb-6 text-center overflow-hidden">
          {/* Subtle Ambient Glow Behind Rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#00d4aa]/10 blur-3xl pointer-events-none" />

          {/* Orbit Dynamic Canvas Visual */}
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center mb-5">
            {/* Outer Ring 3 */}
            <div className="absolute inset-0 rounded-full border border-[#1f2633] animate-[spin_60s_linear_infinite]" />
            {/* Outer Ring 2 with Cyan Glow Accent */}
            <div className="absolute inset-4 rounded-full border border-[#00d4aa]/20 border-dashed animate-[spin_35s_linear_infinite_reverse]" />
            {/* Outer Ring 1 */}
            <div className="absolute inset-10 rounded-full border border-[#1f2633] animate-[spin_20s_linear_infinite]" />

            {/* Orbiting Satellite Dots representing models */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#eab308] shadow-[0_0_12px_#eab308]" />
            <div className="absolute bottom-4 right-10 w-3 h-3 rounded-full bg-[#00d4aa] shadow-[0_0_12px_#00d4aa]" />
            <div className="absolute top-16 left-6 w-3.5 h-3.5 rounded-full bg-[#a855f7] shadow-[0_0_15px_#a855f7]" />
            <div className="absolute bottom-12 left-10 w-3 h-3 rounded-full bg-[#38bdf8] shadow-[0_0_12px_#38bdf8]" />
            <div className="absolute top-20 right-4 w-3.5 h-3.5 rounded-full bg-[#f43f5e] shadow-[0_0_15px_#f43f5e]" />

            {/* Center Core Engine Badge */}
            <div className="relative z-10 w-20 h-20 rounded-2xl bg-[#12161f] border border-[#00d4aa]/40 shadow-[0_0_30px_rgba(0,212,170,0.25)] flex flex-col items-center justify-center gap-1">
              <SoufAIIcon size={32} glow accentColor="#00d4aa" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#00d4aa]">
                SoufAI
              </span>
            </div>
          </div>

          {/* Uptime and Health Pill (Matches user screenshot 99.9% Uptime) */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#12161f] border border-[#00d4aa]/30 text-xs font-mono text-[#00d4aa] shadow-[0_0_20px_rgba(0,212,170,0.12)] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-bold">99.9% Uptime</span>
            <span className="text-[#64748b]">•</span>
            <span className="text-[#94a3b8]">{isRtl ? "كافة النماذج تعمل بكفاءة" : "All 5 Engines Operational"}</span>
          </div>

          {/* Main Direct Title */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold tracking-wider text-[#00d4aa] uppercase font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRtl ? "اختر النموذج المناسب لمهامك" : "SELECT THE RIGHT MODEL FOR YOU"}</span>
            </div>
            <p className="text-xs text-[#94a3b8] max-w-md mx-auto">
              {isRtl
                ? "انقر على أي نموذج لفتح واجهته المتخصصة بالكامل مع مواصفاته والقدرات وإحصائياته الحقيقية."
                : "Click any model below to open its dedicated technical workspace and real-time telemetry."}
            </p>
          </div>
        </div>

        {/* 5 FLAGSHIP MODEL CARDS (Direct Click to open Dedicated Modal & Route) */}
        <div className="space-y-3.5">
          {models.map((m) => {
            const accent = m.identity.accentColor;
            const isHovered = selectedHoverModel === m.model_id;

            return (
              <div
                key={m.model_id}
                onClick={(e) => handleModelClick(e, m)}
                onMouseEnter={() => setSelectedHoverModel(m.model_id)}
                className={`group block relative p-4 sm:p-4.5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                  m.model_id === "coder" || m.model_id === "pro"
                    ? "bg-[#12161f]/95 border-[#1f2633] hover:border-[#00d4aa]/60 hover:shadow-[0_0_30px_rgba(0,212,170,0.12)]"
                    : "bg-[#12161f]/85 border-[#1f2633] hover:border-[#2a3547] hover:bg-[#161b26]"
                }`}
                style={{
                  boxShadow: isHovered ? `0 0 25px ${accent}18` : undefined,
                }}
              >
                {/* Active model outer glow border on hover */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border"
                  style={{ borderColor: `${accent}60` }}
                />

                <div className="relative z-10 flex items-center justify-between gap-3">
                  {/* Left Side: Custom Brand Icon & Names */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border shrink-0 transition-transform duration-200 group-hover:scale-105"
                      style={{
                        backgroundColor: `${accent}15`,
                        borderColor: `${accent}40`,
                      }}
                    >
                      {getModelIcon(m.model_id, {
                        size: 24,
                        accentColor: accent,
                        glow: true,
                      })}
                    </div>

                    <div className="min-w-0 space-y-0.5 text-start">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-bold text-[#f4f8f8] group-hover:text-white transition-colors truncate">
                          {m.display_name}
                        </span>
                        <span className="text-[10px] font-mono text-[#506e6e] hidden sm:inline">
                          {m.version}
                        </span>
                      </div>
                      <p className="text-xs text-[#7a9595] group-hover:text-[#a0bebe] transition-colors truncate">
                        {isRtl ? m.identity.taglineAr : m.identity.taglineEn}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Identity Badge & Action Indicator */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className="text-[11px] sm:text-xs font-mono font-semibold px-3 py-1 rounded-full border transition-all"
                      style={{
                        color: accent,
                        backgroundColor: `${accent}12`,
                        borderColor: `${accent}35`,
                      }}
                    >
                      {isRtl ? m.identity.badgeAr : m.identity.badgeEn}
                    </span>

                    <div className="w-7 h-7 rounded-lg bg-[#0a1212] border border-[#142222] flex items-center justify-center text-[#557373] group-hover:text-[#00d4aa] group-hover:border-[#00d4aa]/40 transition-colors">
                      {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* QUICK COMPARISON SECTION */}
        <div className="pt-2">
          <Link
            href={`/${locale}/models/compare`}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#070d0d] hover:bg-[#0a1212] border border-[#142020] hover:border-[#00d4aa]/40 flex items-center justify-between text-start transition-all group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0c1616] border border-[#182626] flex items-center justify-center text-[#00d4aa]">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-[#f4f8f8] group-hover:text-[#00d4aa] transition-colors flex items-center gap-2">
                  <span className="text-[#00d4aa] font-mono">∿</span>
                  <span>{isRtl ? "المقارنة السريعة بين النماذج" : "QUICK COMPARISON"}</span>
                </div>
                <div className="text-[11px] text-[#658282]">
                  {isRtl ? "جدول فني يقارن السرعة، التفكير، والبرمجة جنباً إلى جنب" : "Side-by-side technical matrix of all 5 engines"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-mono text-[#00d4aa]">
              <span className="hidden sm:inline">{isRtl ? "فتح المقارنة" : "Open Matrix"}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </div>
          </Link>
        </div>

        {/* SMART TASK INTENT ROUTER (Engineered Task Dispatcher) */}
        <div className="rounded-2xl bg-[#060a0a] border border-[#131f1f] p-5 sm:p-6 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#00d4aa]" />
              <h3 className="text-xs sm:text-sm font-bold text-[#f4f8f8]">
                {isRtl ? "الموجه الذكي للمهام (Task Intent Router)" : "Smart Task Intent Router"}
              </h3>
            </div>
            <p className="text-[11px] text-[#688585]">
              {isRtl
                ? "اكتب وصف مهمتك، وسيرشح النظام النموذج الأنسب مع الأسباب الهندسية."
                : "Describe your prompt or task, and SoufAI will route to the optimal model with factual justification."}
            </p>
          </div>

          <form onSubmit={handleRecommend} className="space-y-2.5">
            <div className="flex items-center gap-2 bg-[#040707] border border-[#142020] focus-within:border-[#00d4aa]/60 rounded-xl p-1.5 transition-all">
              <Search className="w-4 h-4 text-[#456363] ms-2.5 shrink-0" />
              <input
                type="text"
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                placeholder={
                  isRtl
                    ? "مثال: 'ابنِ تطبيق SaaS مع ساندبوكس' أو 'تحليل منطقي عميق'..."
                    : "e.g. 'Build full-stack app' or 'Deep reasoning synthesis'..."
                }
                className="w-full bg-transparent text-xs text-[#f4f8f8] placeholder-[#435e5e] px-2 py-1.5 outline-none font-sans"
              />

              <button
                type="submit"
                disabled={isRecommending || !taskPrompt.trim()}
                className="px-4 py-2 rounded-lg bg-[#00d4aa] hover:bg-[#00e6b8] disabled:opacity-40 text-[#031111] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                {isRecommending ? (
                  <div className="w-3 h-3 border-2 border-[#031111] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isRtl ? "توجيه" : "Route"}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {sampleTasks.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTaskPrompt(t.prompt);
                  }}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-[#090f0f] hover:bg-[#0e1616] text-[#708e8e] hover:text-[#00d4aa] border border-[#131e1e] transition-colors cursor-pointer"
                >
                  {t.labelAr}
                </button>
              ))}
            </div>
          </form>

          {/* Recommendation Result */}
          <AnimatePresence>
            {recommendationResult && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-xl bg-[#081010] border border-[#00d4aa]/30 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center border"
                      style={{
                        backgroundColor: `${recommendationResult.recommended.accentColor}15`,
                        borderColor: `${recommendationResult.recommended.accentColor}40`,
                      }}
                    >
                      {getModelIcon(recommendationResult.recommended.model_id, {
                        size: 18,
                        accentColor: recommendationResult.recommended.accentColor,
                      })}
                    </div>
                    <div>
                      <div className="text-[10px] text-[#608080] font-mono">
                        {isRtl ? "النموذج الموصى به لهذه المهمة:" : "Recommended Model:"}
                      </div>
                      <div className="text-xs font-bold text-[#f4f8f8]">
                        {recommendationResult.recommended.display_name}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const matched = models.find((m) => m.model_id === recommendationResult.recommended.model_id);
                      if (matched) setActiveModalModel(matched);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00d4aa] text-[#031111] hover:bg-[#00e6b8] transition-all cursor-pointer"
                  >
                    <span>{isRtl ? "فتح واجهة النموذج" : "Open Model"}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Model Detail Modal (Opens directly on clicking any model card) */}
      <AnimatePresence>
        {activeModalModel && (
          <ModelDetailModal
            locale={locale}
            isRtl={isRtl}
            model={activeModalModel}
            onClose={() => setActiveModalModel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
