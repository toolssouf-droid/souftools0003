"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Sparkles,
  Rocket,
  ShieldCheck,
  Award,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Send,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

interface IncubatorClientPageProps {
  locale: string;
}

export function IncubatorClientPage({ locale }: IncubatorClientPageProps) {
  const isRtl = isRtlLocale(locale);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const tracks = [
    {
      title: isRtl ? "مسار الذكاء الاصطناعي الزراعي (AgriTech)" : "AgriTech AI Track",
      desc: isRtl ? "تحسين المحاصيل، الاستشعار عن بعد، وإدارة المياه الذكية." : "Precision farming and hydrological analytics.",
      grant: "15,000$",
      slots: "4 مقاعد متبقية",
    },
    {
      title: isRtl ? "مسار الرعاية الصحية والطب التنبؤي (HealthTech)" : "HealthTech AI Track",
      desc: isRtl ? "أنظمة التشخيص المبكر والربط بين المراكز الصحية القروية." : "Early diagnostic workflows and rural telemetry.",
      grant: "20,000$",
      slots: "2 مقاعد متبقية",
    },
    {
      title: isRtl ? "مسار التقنيات التعليمية والثقافية (EdTech)" : "EdTech & Heritage AI Track",
      desc: isRtl ? "المناهج التفاعلية والتوثيق الرقمي التراثي." : "Adaptive learning and cultural conservation.",
      grant: "12,000$",
      slots: "3 مقاعد متبقية",
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectDesc.trim()) return;
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30">
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "صندوق الابتكار الإقليمي ودعم المشاريع" : "Regional Innovation Incubator"}
        subtitle={isRtl ? "تمويل، أرصدة سحابية، وإرشاد هندسي لرواد الأعمال" : "Funding, compute credits & architectural mentorship"}
        icon={<Building2 className="w-4 h-4 text-amber-400" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="incubator"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "حاضنة مكناس للتكنولوجيا (Meknes Tech Node)" : "Meknes Tech Incubator"}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#e8f5f5]">
            {isRtl ? "صندوق الابتكار الإقليمي ودعم المشاريع" : "Regional Innovation Incubator"}
          </h1>
          <p className="text-xs sm:text-sm text-[#88b0b0]">
            {isRtl
              ? "نقدم الدعم التقني، السحابي، والتوجيه للمشاريع التكنولوجية التي تصنع فارقاً حقيقياً."
              : "Funding, cloud compute credits, and architectural mentoring for regional innovators."}
          </p>
        </div>

        {/* TRACKS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tracks.map((t, idx) => (
            <div
              key={idx}
              className="glass-card p-5 rounded-3xl border border-[#1e2e2e] hover:border-amber-400/40 bg-[#0d1414] transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400">{t.grant}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30">
                    {t.slots}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#e8f5f5]">{t.title}</h3>
                <p className="text-xs text-[#88b0b0] leading-relaxed">{t.desc}</p>
              </div>

              <div className="pt-2 border-t border-[#1e2e2e] text-[11px] font-semibold text-[#00d4aa]">
                ✓ {isRtl ? "شامل رصيد API وتوجيه استشاري" : "Includes API credits & mentorship"}
              </div>
            </div>
          ))}
        </div>

        {/* APPLICATION FORM */}
        <div className="glass-card rounded-3xl border border-[#1e2e2e] bg-[#0d1414] shadow-2xl p-6 sm:p-8 space-y-5">
          <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
            <Rocket className="w-5 h-5 text-amber-400" />
            <span>{isRtl ? "تقديم طلب احتضان مشروع جديد" : "Apply for Incubator Cohort"}</span>
          </h3>

          {isSubmitted ? (
            <div className="p-6 rounded-2xl bg-[#00ff88]/10 border border-[#00ff88]/30 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#00ff88] mx-auto" />
              <h4 className="text-sm font-bold text-[#e8f5f5]">
                {isRtl ? "تم استلام طلبك بنجاح!" : "Application Received!"}
              </h4>
              <p className="text-xs text-[#88b0b0]">
                {isRtl
                  ? "سيتواصل معك فريق التقييم التكنولوجي لمراجعة بنيان المشروع والبدء في الدعم."
                  : "Our architectural review board will review your submission and contact you."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#88b0b0] block mb-1.5">
                  {isRtl ? "اسم المشروع أو الفكرة" : "Project Title"}
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={isRtl ? "مثال: نظام الكشف المبكر عن آفات الزيتون..." : "e.g. Smart Agri Sensor..."}
                  className="w-full bg-[#111a1a] border border-[#1e2e2e] focus:border-amber-400 rounded-2xl p-3.5 text-xs text-[#e8f5f5] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#88b0b0] block mb-1.5">
                  {isRtl ? "شرح تفصيلي للأثر والحل التكنولوجي" : "Technical Proposal & Impact"}
                </label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder={isRtl ? "اشرح التقنية المستخدمة والمشكلة التي تحلها..." : "Describe the architecture and regional impact..."}
                  className="w-full bg-[#111a1a] border border-[#1e2e2e] focus:border-amber-400 rounded-2xl p-3.5 text-xs text-[#e8f5f5] outline-none resize-none"
                  rows={4}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-[#0a0f0f] font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-400/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{isRtl ? "إرسال ملف المشروع للمراجعة" : "Submit Proposal"}</span>
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="border-t border-[#1e2e2e] bg-[#080d0d] py-6 px-4 text-center text-xs text-[#4a7070]">
        SoufTools Platform © 2026. All rights reserved.
      </footer>
    </div>
  );
}
