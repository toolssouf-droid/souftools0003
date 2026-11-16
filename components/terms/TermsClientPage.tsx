"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Scale,
  Cpu,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Printer,
  ChevronDown,
  Search,
  Zap,
  Clock,
  UserCheck,
  Ban,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { WaveBackground } from "@/components/ui/WaveBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

export function TermsClientPage({ locale }: { locale: string }) {
  const isRtl = isRtlLocale(locale);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const lastUpdatedDate = isRtl ? "24 أغسطس 2026" : "August 24, 2026";

  const clauses = [
    {
      id: "acceptance",
      icon: UserCheck,
      titleAr: "1. القبول والترخيص باستخدام المنصة",
      titleEn: "1. Acceptance & Usage License",
      descAr:
        "بوصولك واستخدامك لمنصة SoufTools ونماذج الذكاء الاصطناعي وأدوات الوكيل الذكي الملحقة بها، فإنك توافق التزامياً وبشكل كامل على كافة الشروط والأحكام الواردة في هذه الاتفاقية.",
      descEn:
        "By accessing and utilizing SoufTools, its SoufAI models, and autonomous agent systems, you unconditionally accept and agree to be bound by these Terms of Service.",
      pointsAr: [
        "يقتصر استخدام المنصة على الأغراض المشروعة والتطويرية والتعليمية وفق القوانين الدولية.",
        "تمنحك المنصة ترخيصاً شخصياً غير حصري وغير قابل للانتقال لاستخدام الأدوات والنماذج المتاحة.",
        "يجب أن تكون بعمر 13 عاماً على الأقل لاستخدام هذه الخدمة.",
      ],
      pointsEn: [
        "Platform usage is restricted to lawful, professional, and educational purposes complying with global laws.",
        "SoufTools grants you a personal, non-exclusive, non-transferable revocable license to access our services.",
        "You must be at least 13 years of age to establish an account.",
      ],
    },
    {
      id: "acceptable-use",
      icon: Ban,
      titleAr: "2. سياسة الاستخدام العادل والمحظورات",
      titleEn: "2. Acceptable Use & Prohibited Conduct",
      descAr:
        "لتأمين بيئة عمل مستقرة وآمنة لجميع المستخدمين، يُحظر تماماً استخدام المنصة للقيام بأي من الأنشطة المحظورة:",
      descEn:
        "To ensure a secure, resilient, and high-performance ecosystem for all users, prohibited activities include:",
      pointsAr: [
        "محاولة الهندسة العكسية، اختراق الخوادم، أو استغلال ثغرات في خوارزميات التوجيه الذكي ومفاتيح المزودين.",
        "استخدام النماذج لتوليد برمجيات خبيثة أو محتوى يحرض على الكراهية أو الأحتيال.",
        "تنفيذ استدعاءات تلقائية ضخمة (DDOS/Botnet) تتجاوز قيود المعدل العادل.",
      ],
      pointsEn: [
        "Attempting to reverse engineer, breach servers, or exploit fallback routing algorithms or provider keys.",
        "Deploying model prompts to craft malware, automated cyber threats, or fraudulent campaigns.",
        "Executing malicious botnet loops or automated traffic bursts violating system rate limits.",
      ],
    },
    {
      id: "ai-content",
      icon: Cpu,
      titleAr: "3. الملكية الفكرية ومخرجات الذكاء الاصطناعي",
      titleEn: "3. Intellectual Property & AI Generated Content",
      descAr:
        "حقوق الملكية للمدخلات والمخرجات المصاغة بواسطة نماذج SoufAI:",
      descEn:
        "Ownership and usage rights governing prompts and AI-synthesized artifacts:",
      pointsAr: [
        "تظل أنت المالك المباشر لجميع الأكواد والمستندات والرسائل التي تقوم بإدخالها في المنصة.",
        "تمنحك SoufTools حقوقاً كاملة وتجارية لاستخدام وتعديل ونشر الأكواد والتصاميم والنصوص التي توفرها النماذج لك.",
      ],
      pointsEn: [
        "You retain all copyright, proprietary rights, and title to your source code and prompts submitted.",
        "SoufTools assigns you full commercial rights to deploy, modify, and monetize AI-generated code.",
      ],
    },
    {
      id: "availability",
      icon: Zap,
      titleAr: "4. توفر الخدمة ونظام التبديل التلقائي (Fallback Routing)",
      titleEn: "4. Service Uptime & Intelligent Fallback Routing",
      descAr:
        "نحرص في SoufTools على تحقيق أعلى معدل توفر من خلال تقنية التوجيه الذكي بين النماذج عند تعطل أي مزود خارجي.",
      descEn:
        "SoufTools leverages proprietary smart routing algorithms across 40+ AI models to maximize availability.",
      pointsAr: [
        "يتم إعادة توجيه الاستعلامات آلياً لنموذج مكافئ عند حدوث ضغط أو انقطاع في خوادم المزود الأساسي.",
        "تتحفظ المنصة بالحق في تحديث وتغيير قائمة النماذج والمزودين المدعومين لتحسين الأداء الكلي.",
      ],
      pointsEn: [
        "Prompts automatically re-route to an equivalent fallback model tier during provider rate-limits or outages.",
        "SoufTools reserves the right to modify or adjust model allocations to maintain optimal response latencies.",
      ],
    },
  ];

  const filteredClauses = searchQuery.trim()
    ? clauses.filter(
        (c) =>
          (isRtl ? c.titleAr : c.titleEn).toLowerCase().includes(searchQuery.toLowerCase()) ||
          (isRtl ? c.descAr : c.descEn).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clauses;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30 selection:text-[#00d4aa] relative overflow-x-hidden">
      {/* Universal Navigation Header with Return/Back Button */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "شروط الخدمة والاستخدام العادل" : "Terms of Service & Usage Rules"}
        subtitle={isRtl ? "المعايير القانونية والتراخيص وحقوق الملكية الفكرية" : "Fair usage policies, licensing, and user rights"}
        icon={<Scale className="w-4 h-4 text-[#0ea5e9]" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/50 text-[#88b0b0] hover:text-[#00d4aa] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title={isRtl ? "طباعة الاتفاقية" : "Print Document"}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? "طباعة" : "Print"}</span>
            </button>
            <LanguageSwitcher locale={locale} />
          </div>
        }
      />

      {/* Hero Banner */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 text-center z-10">
        <WaveBackground />

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto relative z-10 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111a1a] border border-[#0ea5e9]/40 text-[#0ea5e9] text-xs font-semibold shadow-md">
            <Scale className="w-4 h-4 text-[#0ea5e9]" />
            <span>{isRtl ? "اتفاقية الخدمة والاستخدام العادل" : "Legal Terms & Fair Usage Agreement"}</span>
          </div>

          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#e8f5f5] leading-tight">
            {isRtl ? "شروط وإرشادات الاستخدام" : "Terms of Service & Rules"}
          </h1>

          <p className="text-sm sm:text-base text-[#88b0b0] max-w-2xl mx-auto leading-relaxed">
            {isRtl
              ? "تحدد هذه الوثيقة الحقوق والالتزامات وقواعد الاستخدام العادل لنماذج الذكاء الاصطناعي وأدوات الوكيل في منصة SoufTools."
              : "Defines rights, obligations, acceptable conduct, and output governance across all SoufTools services."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-[#4a7070]">
            <span className="flex items-center gap-1 bg-[#111a1a] px-3 py-1 rounded-full border border-[#1e2e2e]">
              <Clock className="w-3 h-3 text-[#00d4aa]" />
              {isRtl ? `تاريخ السريان: ${lastUpdatedDate}` : `Effective Date: ${lastUpdatedDate}`}
            </span>
            <span className="flex items-center gap-1 bg-[#111a1a] px-3 py-1 rounded-full border border-[#1e2e2e]">
              <Cpu className="w-3 h-3 text-[#0ea5e9]" />
              {isRtl ? "استخدام تجاري كامل للمخرجات" : "Full Commercial Output Rights"}
            </span>
          </div>
        </motion.div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-20 relative z-10 flex-1">
        {/* Search Bar */}
        <div className="relative mb-8 max-w-2xl mx-auto">
          <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-[#4a7070]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isRtl
                ? "ابحث في شروط الاستخدام (مثال: الملكية الفكرية، الضمان، الاستخدام العادل)..."
                : "Search terms (e.g., intellectual property, warranty, acceptable use)..."
            }
            className="w-full bg-[#111a1a] text-xs sm:text-sm text-[#e8f5f5] placeholder-[#4a7070] pr-10 pl-4 py-3 rounded-2xl border border-[#1e2e2e] focus:border-[#0ea5e9] outline-none transition-all shadow-md"
          />
        </div>

        {/* Clauses Grid */}
        <div className="space-y-6">
          {filteredClauses.map((item, index) => {
            const Icon = item.icon;
            const isExpanded = expandedSection === item.id;

            return (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-card p-5 sm:p-7 rounded-3xl border border-[#1e2e2e] hover:border-[#0ea5e9]/30 transition-all space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[#1e2e2e]/70 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] text-[#0ea5e9] flex items-center justify-center shrink-0 shadow-md">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-[#e8f5f5]">
                        {isRtl ? item.titleAr : item.titleEn}
                      </h2>
                      <span className="text-[10px] text-[#4a7070] font-mono">
                        Section #{index + 1}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : item.id)}
                    className="p-1.5 rounded-lg bg-[#111a1a] text-[#4a7070] hover:text-[#0ea5e9] transition-colors cursor-pointer"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-[#0ea5e9]" : ""
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-[#88b0b0] leading-relaxed">
                  {isRtl ? item.descAr : item.descEn}
                </p>

                {item.pointsAr && (
                  <ul className="space-y-2.5 pt-2">
                    {(isRtl ? item.pointsAr : item.pointsEn)?.map((pt, ptIdx) => (
                      <li
                        key={ptIdx}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-[#c8dede] leading-relaxed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#0ea5e9] shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.article>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#1e2e2e] py-6 px-4 sm:px-6 bg-[#0a0f0f] text-xs text-[#4a7070] relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <p className="text-xs font-semibold">
            SoufTools Platform. All rights reserved 2026 ©
          </p>

          <div className="flex items-center gap-4 text-xs font-medium">
            <Link href={`/${locale}/privacy`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الخصوصية" : "Privacy"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/terms`} className="text-[#0ea5e9] font-bold">
              {isRtl ? "الشروط" : "Terms"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/about`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "عن المنصة" : "About"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
