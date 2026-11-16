"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Zap,
  Brain,
  Globe,
  Lock,
  ArrowLeft,
  ArrowRight,
  Rocket,
  CheckCircle2,
  Activity,
  Layers,
} from "lucide-react";
import { SoufToolsLogo, ModelLogo } from "@/components/ui/Logos";
import { WaveBackground } from "@/components/ui/WaveBackground";
import { RotatingSphere3D } from "@/components/ui/RotatingSphere3D";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

export function AboutClientPage({ locale }: { locale: string }) {
  const isRtl = isRtlLocale(locale);
  const [activeModelId, setActiveModelId] = useState<string>("spark");

  const modelsData = [
    {
      id: "spark",
      nameAr: "SoufAI Spark",
      nameEn: "SoufAI Spark",
      taglineAr: "السرعة الفائقة والردود الخاطفة",
      taglineEn: "Lightning Speed & Instant Answers",
      badgeAr: "الأسرع",
      badgeEn: "Fastest",
      color: "from-[#00d4aa] to-[#00ff88]",
      borderColor: "border-[#00d4aa]",
      glowColor: "shadow-[#00d4aa]/20",
      accentHex: "#00d4aa",
      speed: "50ms",
      descAr: "نموذج خاطف وسريع جداً، مخصص لتلخيص المستندات الكبيرة والإجابة الفورية عن الاستفسارات اليومية دون أي تأخير.",
      descEn: "Ultra fast model optimized for quick summaries, instant queries, and light-weight everyday interactions.",
      specsAr: ["زمن استجابة < 50ms", "معالجة فورية للمحوث", "استهلاك خفيف للموارد"],
      specsEn: ["< 50ms latency", "Instant search synthesis", "Ultra light memory footprint"],
    },
    {
      id: "core",
      nameAr: "SoufAI Core",
      nameEn: "SoufAI Core",
      taglineAr: "النموذج المتوازن للاستخدام اليومي",
      taglineEn: "Balanced Daily Workhorse",
      badgeAr: "المتوازن",
      badgeEn: "Balanced",
      color: "from-[#0ea5e9] to-[#38bdf8]",
      borderColor: "border-[#0ea5e9]",
      glowColor: "shadow-[#0ea5e9]/20",
      accentHex: "#0ea5e9",
      speed: "100ms",
      descAr: "العمود الفقري لمنصة SoufTools. يمزج بين السرعة الفائقة وجودة التفكير لصياغة الخطابات، التفكير التحليلي، وكتابة المقالات.",
      descEn: "The core engine of SoufTools combining speed with structured reasoning for writing, analysis and problem solving.",
      specsAr: ["توازن مثال بين السرعة والعمق", "صياغة لغوية ممتازة", "فهم السياق المتقدم"],
      specsEn: ["Optimal speed/quality balance", "Flawless Arabic composition", "Advanced contextual reasoning"],
    },
    {
      id: "pro",
      nameAr: "SoufAI Pro",
      nameEn: "SoufAI Pro",
      taglineAr: "التفكير المنطقي والتحليل المتقدم",
      taglineEn: "Deep Reasoning & Research",
      badgeAr: "الأقوى",
      badgeEn: "Pro",
      color: "from-[#a855f7] to-[#c084fc]",
      borderColor: "border-[#a855f7]",
      glowColor: "shadow-[#a855f7]/20",
      accentHex: "#a855f7",
      speed: "300ms",
      descAr: "صُمم للمهام شديدة التعقيد والتفكير المنطقي خطوة بخطوة. مثالي للباحثين والطلاب والمحللين الأكاديميين والتقنيين.",
      descEn: "Built for multi-step reasoning, research analysis, complex logic, and comprehensive academic writing.",
      specsAr: ["تفكير منطقي خطوة بخطوة", "أبحاث وتحليلات معقدة", "استخلاص نتائج دقيقة"],
      specsEn: ["Step-by-step deep logic", "Complex research papers", "High accuracy outputs"],
    },
    {
      id: "coder",
      nameAr: "SoufAI Coder",
      nameEn: "SoufAI Coder",
      taglineAr: "هندسة الكود وبناء البرمجيات",
      taglineEn: "Code Generation & Architecture",
      badgeAr: "الكود",
      badgeEn: "Coder",
      color: "from-[#10b981] to-[#34d399]",
      borderColor: "border-[#10b981]",
      glowColor: "shadow-[#10b981]/20",
      accentHex: "#10b981",
      speed: "100ms",
      descAr: "المحرك المتخصص بالبرمجة. يفهم أكثر من 30 لغة برمجية، يساعدك في كتابة السكربتات، فحص الأخطاء، وبناء التطبيقات الكاملة.",
      descEn: "Specialized software engine supporting 30+ programming languages for writing, debugging, and system architecture.",
      specsAr: ["دعم +30 لغة برمجية", "اكتشاف الثغرات وتصحيحها", "توليد كود نظيف وقابل للتوسع"],
      specsEn: ["30+ programming languages", "Automated bug detection", "Clean production code"],
    },
    {
      id: "ultra",
      nameAr: "SoufAI Ultra",
      nameEn: "SoufAI Ultra",
      taglineAr: "أقوى أداء وأعلى دقة وحل أعقد المشكلات",
      taglineEn: "Ultimate Flagship Intelligence",
      badgeAr: "الأفضل",
      badgeEn: "Ultra",
      color: "from-[#f59e0b] to-[#fbbf24]",
      borderColor: "border-[#f59e0b]",
      glowColor: "shadow-[#f59e0b]/20",
      accentHex: "#f59e0b",
      speed: "150ms",
      descAr: "قمة الهندسة البرمجية في SoufTools. يمثل الذكاء الفائق لحل أكثر المسائل صعوبة والتفكير الاستراتيجي عالي المستوى.",
      descEn: "The pinnacle of SoufTools technology. Delivering maximum precision for strategic problem solving.",
      specsAr: ["أعلى دقة ذكاء متاحة", "معالجة المعضلات المعقدة", "تفكير استراتيجي متقدم"],
      specsEn: ["Maximum precision available", "Complex problem solving", "Strategic level reasoning"],
    },
  ];

  const activeModel = modelsData.find((m) => m.id === activeModelId) || modelsData[0];

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] relative overflow-hidden flex flex-col justify-between">
      {/* Universal Navigation Header with Return/Back Button */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "عن المنصة ورؤية SoufTools" : "About & Architecture"}
        subtitle={isRtl ? "منظومة ذكاء اصطناعي سيادية للمستقبل" : "Sovereign AI ecosystem & technology"}
        icon={<Sparkles className="w-4 h-4" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="about"
        actions={<LanguageSwitcher locale={locale} />}
      />

      {/* SECTION 1: HERO */}
      <section className="relative py-12 sm:py-20 px-4 sm:px-6 text-center z-10 my-auto">
        <WaveBackground />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-[#111a1a] border border-[#00d4aa]/40 text-[#00d4aa] text-[10px] sm:text-xs font-semibold mb-4 sm:mb-6 shadow-md shadow-[#00d4aa]/10">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{isRtl ? "تعرف على القصة والتكنولوجيا" : "Discover Our Vision & Technology"}</span>
          </div>

          <h1 className="text-3xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#e8f5f5] leading-tight mb-4 sm:mb-6 font-sans">
            {isRtl ? "نحن SoufTools" : "We Are SoufTools"}
          </h1>

          <p className="text-base sm:text-2xl text-gradient-teal font-bold max-w-2xl mx-auto leading-relaxed">
            {isRtl ? "منصة ذكاء اصطناعي من الجيل القادم" : "Next-Generation AI Platform"}
          </p>
        </motion.div>
      </section>

      {/* SECTION 2: OUR STORY */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="space-y-6 text-right"
          >
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00d4aa] uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>{isRtl ? "قصتنا" : "Our Story"}</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#e8f5f5] leading-snug">
              {isRtl ? (
                <>
                  وُلدت <span className="text-[#00d4aa]">SoufTools</span> من رؤية بسيطة: <br />
                  جعل الذكاء الاصطناعي في متناول الجميع، <br />
                  بسرعة لا تُضاهى وذكاء لا حدود له.
                </>
              ) : (
                <>
                  SoufTools was born from a clear vision: <br />
                  Empowering everyone with seamless AI, <br />
                  unmatched speed, and limitless intelligence.
                </>
              )}
            </h2>

            <p className="text-sm text-[#4a7070] leading-relaxed">
              {isRtl
                ? "في عالم يتسارع فيه الابتكار، صممنا SoufTools لتكون المنصة الأكثر موثوقية وسرعة باللغة العربية والعالمية. نبني بنية تحتية هندسية مرنة تضمن عدم انقطاع الخدمة والتنقل السلس بين أقوى النماذج المتخصصة."
                : "In a fast-evolving world, we engineered SoufTools to be the most reliable and blazing-fast AI platform with authentic Arabic first-class support."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <RotatingSphere3D />
          </motion.div>
        </div>
      </section>

      {/* SECTION 3: NUMBERS / STATS */}
      <section className="py-16 px-6 max-w-6xl mx-auto w-full relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#e8f5f5]">
            {isRtl ? "أرقام تتحدث عن تميزنا" : "Numbers That Define Us"}
          </h2>
          <p className="text-xs sm:text-sm text-[#4a7070] mt-2">
            {isRtl ? "مؤشرات الأداء العالي والاعتمادية المطلقة" : "High performance indicators & absolute reliability"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 rounded-2xl border border-[#00d4aa]/30 text-center group hover:border-[#00d4aa] transition-all shadow-lg shadow-[#00d4aa]/5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#111a1a] border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa] mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <div className="text-4xl font-extrabold text-[#00d4aa] font-mono mb-2">5</div>
            <div className="text-xs font-bold text-[#e8f5f5]">
              {isRtl ? "نماذج متخصصة" : "Specialized Models"}
            </div>
            <div className="text-[11px] text-[#4a7070] mt-1">
              {isRtl ? "مصممة لكل نوع من المهام" : "Tailored for every workload"}
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-[#0ea5e9]/30 text-center group hover:border-[#0ea5e9] transition-all shadow-lg shadow-[#0ea5e9]/5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#111a1a] border border-[#0ea5e9]/30 flex items-center justify-center text-[#0ea5e9] mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <div className="text-4xl font-extrabold text-[#0ea5e9] font-mono mb-2">99.9%</div>
            <div className="text-xs font-bold text-[#e8f5f5]">
              {isRtl ? "وقت تشغيل واستقرار" : "Guaranteed Uptime"}
            </div>
            <div className="text-[11px] text-[#4a7070] mt-1">
              {isRtl ? "بنية استجابة تلقائية خاطفة" : "Continuous fallback engine"}
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-[#00ff88]/30 text-center group hover:border-[#00ff88] transition-all shadow-lg shadow-[#00ff88]/5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#111a1a] border border-[#00ff88]/30 flex items-center justify-center text-[#00ff88] mb-4 group-hover:scale-110 transition-transform">
              <Globe className="w-6 h-6" />
            </div>
            <div className="text-4xl font-extrabold text-[#00ff88] font-mono mb-2">100%</div>
            <div className="text-xs font-bold text-[#e8f5f5]">
              {isRtl ? "دعم كامل للغة العربية" : "Arabic First Design"}
            </div>
            <div className="text-[11px] text-[#4a7070] mt-1">
              {isRtl ? "فهم عميق للبلاغة والمفاهيم" : "Deep understanding of rhetoric"}
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-[#a855f7]/30 text-center group hover:border-[#a855f7] transition-all shadow-lg shadow-[#a855f7]/5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#111a1a] border border-[#a855f7]/30 flex items-center justify-center text-[#a855f7] mb-4 group-hover:scale-110 transition-transform">
              <Lock className="w-6 h-6" />
            </div>
            <div className="text-4xl font-extrabold text-[#a855f7] font-mono mb-2">0</div>
            <div className="text-xs font-bold text-[#e8f5f5]">
              {isRtl ? "بيانات مُباعة أو مقتطعة" : "Zero Data Sold"}
            </div>
            <div className="text-[11px] text-[#4a7070] mt-1">
              {isRtl ? "خصوصية تامة وحماية مطلقة" : "Full session privacy encryption"}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: OUR MODELS TIMELINE */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00d4aa] uppercase tracking-wider mb-2">
            <Rocket className="w-4 h-4" />
            <span>{isRtl ? "نماذجنا" : "Our Models Timeline"}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#e8f5f5]">
            {isRtl ? "منظومة النماذج الخمسة المتخصصة" : "The 5 Specialized Model Ecosystem"}
          </h2>
          <p className="text-xs sm:text-sm text-[#4a7070] mt-2">
            {isRtl ? "انقر على أي نموذج في الخط الزمني لمعاينة التفاصيل البرمجية" : "Click any model along the timeline to inspect details"}
          </p>
        </div>

        <div className="relative mb-8 sm:mb-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 relative z-10">
            {modelsData.map((m) => {
              const isSelected = m.id === activeModelId;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModelId(m.id)}
                  className={`p-2.5 sm:p-4 rounded-2xl transition-all border text-center flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer ${
                    isSelected
                      ? `bg-[#111a1a] ${m.borderColor} shadow-xl ${m.glowColor} scale-105`
                      : "bg-[#0d1414]/80 border-[#1e2e2e] hover:border-[#4a7070] text-[#4a7070]"
                  }`}
                >
                  <ModelLogo modelId={m.id} size={28} />
                  <span className={`text-[11px] sm:text-xs font-bold ${isSelected ? "text-[#e8f5f5]" : "text-[#88b0b0]"}`}>
                    {isRtl ? m.nameAr : m.nameEn}
                  </span>
                  <span
                    className="text-[9px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold border"
                    style={{
                      color: m.accentHex,
                      borderColor: `${m.accentHex}40`,
                      backgroundColor: `${m.accentHex}15`,
                    }}
                  >
                    {isRtl ? m.badgeAr : m.badgeEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeModel.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className={`glass-card p-4 sm:p-8 rounded-3xl border ${activeModel.borderColor} bg-[#0e1717] shadow-2xl relative overflow-hidden`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-[#1e2e2e]">
              <div className="flex items-center gap-3 sm:gap-4">
                <ModelLogo modelId={activeModel.id} size={42} />
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-base sm:text-xl font-bold text-[#e8f5f5]">
                      {isRtl ? activeModel.nameAr : activeModel.nameEn}
                    </h3>
                    <span
                      className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold border"
                      style={{
                        color: activeModel.accentHex,
                        borderColor: `${activeModel.accentHex}40`,
                        backgroundColor: `${activeModel.accentHex}20`,
                      }}
                    >
                      {isRtl ? activeModel.badgeAr : activeModel.badgeEn}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold" style={{ color: activeModel.accentHex }}>
                    {isRtl ? activeModel.taglineAr : activeModel.taglineEn}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1e2e2e]">
                <div className="text-right">
                  <div className="text-[10px] text-[#4a7070]">{isRtl ? "متوسط السرعة" : "Avg Speed"}</div>
                  <div className="text-xs sm:text-sm font-mono font-bold text-[#00ff88]">{activeModel.speed}</div>
                </div>

                <Link
                  href={`/${locale}/chat?model=${activeModel.id}`}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-[11px] sm:text-xs bg-[#00d4aa] text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/30 hover:scale-105 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <span>{isRtl ? "تجربة النموذج" : "Test Model"}</span>
                  {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </Link>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#88b0b0] leading-relaxed mb-4 sm:mb-6">
              {isRtl ? activeModel.descAr : activeModel.descEn}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(isRtl ? activeModel.specsAr : activeModel.specsEn).map((spec, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-[#e8f5f5] bg-[#111a1a] p-2.5 sm:p-3 rounded-xl border border-[#1e2e2e]"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00ff88]" />
                  <span>{spec}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* SECTION 5: OUR VISION */}
      <section className="py-20 px-6 max-w-5xl mx-auto w-full text-center relative z-10">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00d4aa] uppercase tracking-wider mb-2">
            <Brain className="w-4 h-4" />
            <span>{isRtl ? "رؤيتنا" : "Our Vision"}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#e8f5f5]">
            {isRtl ? "نؤمن بأن الذكاء الاصطناعي يجب أن يكون:" : "We Believe AI Should Be:"}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-8 rounded-2xl border border-[#00d4aa]/30 bg-[#111a1a] shadow-xl hover:scale-105 transition-transform">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-xl font-extrabold text-[#00d4aa]">{isRtl ? "سريعاً" : "Fast"}</h3>
            <p className="text-xs text-[#4a7070] mt-2">{isRtl ? "استجابات فورية بدون انتظار" : "Zero friction instant answers"}</p>
          </div>

          <div className="glass-card p-8 rounded-2xl border border-[#0ea5e9]/30 bg-[#111a1a] shadow-xl hover:scale-105 transition-transform">
            <div className="text-4xl mb-3">🧠</div>
            <h3 className="text-xl font-extrabold text-[#0ea5e9]">{isRtl ? "ذكياً" : "Smart"}</h3>
            <p className="text-xs text-[#4a7070] mt-2">{isRtl ? "تفكير عميق ودقة فائقة" : "Deep logic and extreme accuracy"}</p>
          </div>

          <div className="glass-card p-8 rounded-2xl border border-[#00ff88]/30 bg-[#111a1a] shadow-xl hover:scale-105 transition-transform">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="text-xl font-extrabold text-[#00ff88]">{isRtl ? "خاصاً" : "Private"}</h3>
            <p className="text-xs text-[#4a7070] mt-2">{isRtl ? "سرية تامة لجميع البيانات" : "Total data privacy & security"}</p>
          </div>

          <div className="glass-card p-8 rounded-2xl border border-[#a855f7]/30 bg-[#111a1a] shadow-xl hover:scale-105 transition-transform">
            <div className="text-4xl mb-3">🌐</div>
            <h3 className="text-xl font-extrabold text-[#a855f7]">{isRtl ? "للجميع" : "For Everyone"}</h3>
            <p className="text-xs text-[#4a7070] mt-2">{isRtl ? "سهل الوصول بدون تعقيد" : "Accessible to all universally"}</p>
          </div>
        </div>
      </section>

      {/* SECTION 6: CTA */}
      <section className="py-20 px-6 max-w-4xl mx-auto w-full text-center relative z-10 my-auto">
        <div className="glass-card p-12 rounded-3xl border border-[#00d4aa]/50 bg-gradient-to-b from-[#111a1a] to-[#0a0f0f] shadow-2xl shadow-[#00d4aa]/15 relative overflow-hidden">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#e8f5f5] mb-4">
            {isRtl ? "جاهز للتجربة؟" : "Ready to Experience SoufTools?"}
          </h2>

          <p className="text-sm sm:text-base text-[#88b0b0] max-w-lg mx-auto mb-8 leading-relaxed">
            {isRtl
              ? "انضم الآن وابدأ استخدام أحدث نماذج الذكاء الاصطناعي مجاناً وبسرعة غير مسبوقة."
              : "Start chatting now with next-generation AI models for free with ultra speed."}
          </p>

          <Link
            href={`/${locale}/chat`}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#00d4aa] to-[#00ff88] text-[#0a0f0f] font-extrabold text-base shadow-xl shadow-[#00d4aa]/30 hover:scale-105 transition-all"
          >
            <span>{isRtl ? "ابدأ مجاناً" : "Start Free Now"}</span>
            {isRtl ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e2e2e] py-6 text-center text-xs text-[#4a7070] relative z-10">
        <p>© 2026 SoufTools Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
