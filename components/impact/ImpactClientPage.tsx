"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  Sparkles,
  TrendingUp,
  HeartHandshake,
  Award,
  Globe2,
  TreePine,
  GraduationCap,
  Stethoscope,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

interface ImpactClientPageProps {
  locale: string;
}

export function ImpactClientPage({ locale }: ImpactClientPageProps) {
  const isRtl = isRtlLocale(locale);

  const pillars = [
    {
      icon: TreePine,
      title: isRtl ? "الأثر البيئي والزراعي" : "Ecological & Agri Impact",
      stat: "+34%",
      label: isRtl ? "كفاءة استخدام مياه الري" : "Irrigation Efficiency",
      desc: isRtl ? "توفير الموارد المائية عبر الاستشعار الذكي للتربة في مزارع سايس." : "Smart moisture telemetry across regional farms.",
      color: "text-emerald-400",
      bg: "border-emerald-400/30 bg-emerald-500/10",
    },
    {
      icon: Stethoscope,
      title: isRtl ? "الأثر الصحي والطبي" : "Healthcare AI Impact",
      stat: "12,400+",
      label: isRtl ? "استشارة تشخيصية مدعومة" : "AI-Assisted Triage Cases",
      desc: isRtl ? "تسريع فرز الحالات الحرجة في المراكز الصحية القروية." : "Accelerated screening in rural and regional clinics.",
      color: "text-rose-400",
      bg: "border-rose-400/30 bg-rose-500/10",
    },
    {
      icon: GraduationCap,
      title: isRtl ? "الأثر التعليمي والمعرفي" : "Educational Equity Impact",
      stat: "48,000+",
      label: isRtl ? "ساعة تدريبية تفاعلية" : "Interactive STEM Hours",
      desc: isRtl ? "تمكين الطلاب من فهم البرمجة والعلوم عبر المساعد الذكي." : "Empowering students in code and STEM across schools.",
      color: "text-sky-400",
      bg: "border-sky-400/30 bg-sky-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30">
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "سحابة الأثر المجتمعي ومؤشرات التحول" : "Societal Impact Cloud & Metrics"}
        subtitle={isRtl ? "قياس الأثر الإيجابي لتطبيقات الذكاء الاصطناعي" : "Measurable impact across education, health & sustainability"}
        icon={<HeartHandshake className="w-4 h-4 text-emerald-400" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="impact"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "الاستدامة والتأثير الحقيقي" : "Sustainability & Real-World Impact"}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#e8f5f5]">
            {isRtl ? "سحابة الأثر المجتمعي ومؤشرات التحول" : "Societal Impact Cloud & Metrics"}
          </h1>
          <p className="text-xs sm:text-sm text-[#88b0b0]">
            {isRtl
              ? "قياس دقيق للأثر الإيجابي الذي تحدثه تقنيات الذكاء الاصطناعي في المجتمع المحلي والإقليمي."
              : "Measurable positive impact delivered through AI across agriculture, health, and education."}
          </p>
        </div>

        {/* 3 IMPACT PILLARS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pillars.map((p, idx) => {
            const IconComp = p.icon;
            return (
              <div
                key={idx}
                className={`glass-card p-6 rounded-3xl border ${p.bg} transition-all flex flex-col justify-between gap-5`}
              >
                <div className="space-y-3">
                  <div className={`w-12 h-12 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-center ${p.color}`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-[#e8f5f5]">{p.title}</h3>
                  <div className={`text-3xl font-black font-mono ${p.color}`}>{p.stat}</div>
                  <div className="text-xs font-bold text-[#88b0b0]">{p.label}</div>
                  <p className="text-xs text-[#4a7070] leading-relaxed pt-1">{p.desc}</p>
                </div>

                <div className="text-[11px] font-semibold text-[#00d4aa] pt-2 border-t border-[#1e2e2e]/60">
                  ✓ {isRtl ? "مؤشر معتمد ومدقق" : "Verified Impact Metric"}
                </div>
              </div>
            );
          })}
        </div>

        {/* ACTION / JOIN SECTION */}
        <div className="glass-card rounded-3xl border border-[#00d4aa]/30 bg-[#0d1414] shadow-2xl p-6 sm:p-8 text-center space-y-4">
          <h3 className="text-lg font-black text-[#e8f5f5]">
            {isRtl ? "هل لديك مشروع يصنع أثراً مجتمعياً؟" : "Driving a high-impact initiative?"}
          </h3>
          <p className="text-xs text-[#88b0b0] max-w-lg mx-auto">
            {isRtl
              ? "انضم إلى حاضنة الابتكار الإقليمي واستفد من البنية السحابية ونماذج الذكاء الاصطناعي مجاناً."
              : "Join our regional incubator node for cloud computing resources and architectural support."}
          </p>
          <div className="pt-2">
            <Link
              href={`/${locale}/incubator`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] font-extrabold text-xs shadow-xl shadow-[#00d4aa]/30 transition-all hover:scale-105"
            >
              <span>{isRtl ? "تقديم مشروع للحاضنة" : "Apply to Incubator"}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1e2e2e] bg-[#080d0d] py-6 px-4 text-center text-xs text-[#4a7070]">
        SoufTools Platform © 2026. All rights reserved.
      </footer>
    </div>
  );
}
