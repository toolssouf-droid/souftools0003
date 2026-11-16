"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Award,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { WaveBackground } from "@/components/ui/WaveBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import {
  SoufShieldIcon,
  SoufDiamondIcon,
  SoufCrownLuxuryIcon,
  SoufRocketLuxuryIcon,
} from "@/components/ui/BrandIcons";
import { isRtlLocale } from "@/lib/i18n";

export function PricingClientPage({ locale }: { locale: string }) {
  const isRtl = isRtlLocale(locale);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans = [
    {
      id: "free",
      nameAr: "الخطة المجانية",
      nameEn: "Free Explorer",
      badgeAr: "بدون بطاقة ائتمان",
      badgeEn: "No Credit Card Needed",
      priceMonthly: "$0",
      priceAnnual: "$0",
      descAr: "مثالية لتجربة قوة نماذج SoufAI والاستخدام الشخصي اليومي السريع.",
      descEn: "Ideal for experiencing SoufAI capabilities for personal daily tasks.",
      featuresAr: [
        "وصول لنموذج SoufAI Speed Flash",
        "50 محادثة يومياً",
        "ذاكرة ذكية محدودة (حفظ حتى 10 سياقات)",
        "أدوات البحث الأساسية في الويب",
        "تخزين سحابي مجاني للمحادثات",
      ],
      featuresEn: [
        "Access to SoufAI Speed Flash model",
        "50 chat turns per day",
        "Basic AI Memory (Up to 10 context items)",
        "Standard Web Search tool synthesis",
        "Free cloud chat history backup",
      ],
      isPopular: false,
      ctaTextAr: "جرب مجاناً الآن",
      ctaTextEn: "Start Free Now",
      ctaLink: `/${locale}/chat`,
    },
    {
      id: "pro",
      nameAr: "خطة المحترفين (Pro)",
      nameEn: "Pro Developer",
      badgeAr: "الأكثر شعبية",
      badgeEn: "Most Popular",
      priceMonthly: "$19",
      priceAnnual: "$15",
      descAr: "للمطورين والمهندسين الذين يحتاجون قوة صياغة الأكواد والوكيل الذكي Nodaba.",
      descEn: "For developers and power users needing code generation and autonomous agent tools.",
      featuresAr: [
        "وصول غير محدود لـ SoufAI Ultra v2.5 و Pro Reasoning",
        "تشغيل الأكواد والمعاينة المباشرة داخل Sandbox (E2B)",
        "الوكيل الذكي الشامل Nodaba للتحليل والتنفيذ التلقائي",
        "ذاكرة ذكية مفتوحة السعة مع تحكم دقيق",
        "أدوات البحث الحي واستخراج البيانات من الروابط (Jina/Firecrawl)",
        "قراءة الإجابات صوتياً بتصنيع كلام عالي النقاء",
      ],
      featuresEn: [
        "Unlimited access to SoufAI Ultra v2.5 & Pro Reasoning",
        "Live code execution and previews in E2B Sandboxes",
        "Full autonomous Nodaba Agent capabilities",
        "Unlimited AI Memory capacity & granular control",
        "Advanced Web Search & Web Scraper synthesis (Jina/Firecrawl)",
        "High-definition Text-to-Speech audio readout",
      ],
      isPopular: true,
      ctaTextAr: "اشترك في Pro",
      ctaTextEn: "Upgrade to Pro",
      ctaLink: `/${locale}/chat`,
    },
    {
      id: "ultra",
      nameAr: "خطة المؤسسات (Ultra)",
      nameEn: "Ultra Enterprise",
      badgeAr: "سرعة وأولوية فائقة",
      badgeEn: "Maximum Priority",
      priceMonthly: "$49",
      priceAnnual: "$39",
      descAr: "لفرق العمل والشركات التي تتطلب أعلى معدل معالجة وأولوية قصوى على الخوادم.",
      descEn: "For teams and organization workflows demanding dedicated throughput & top priority.",
      featuresAr: [
        "كل مميزات خطة Pro بدون استثناء",
        "أولوية معالجة قصوى وضمان عدم الانتظار أثناء ضغط السحاب",
        "مفاتيح API خاصة للربط مع تطبيقاتك الخارجية",
        "إدارة متقدمة للنماذج وموزع الضغط (Fallback Customization)",
        "دعم فني مخصص ومستمر 24/7",
      ],
      featuresEn: [
        "All Pro features included unconditionally",
        "Highest server priority with zero latency queueing",
        "Custom API keys for external app integrations",
        "Custom fallback routing & model prioritization",
        "24/7 Dedicated technical support desk",
      ],
      isPopular: false,
      ctaTextAr: "تواصل مع المبيعات",
      ctaTextEn: "Contact Enterprise Desk",
      ctaLink: "mailto:lrsoufyane2007@gmail.com",
    },
  ];

  const faqs = [
    {
      qAr: "هل يمكنني استخدام المنصة مجاناً بدون اشتراك؟",
      qEn: "Can I use SoufTools completely for free?",
      aAr: "نعم! الخطة المجانية متاحة للجميع وتتيح لك تجربة محركات SoufAI يومياً بدون أي رسوم أو بطاقات ائتمان.",
      aEn: "Yes! The Free plan provides daily access to SoufAI models with zero credit card commitment.",
    },
    {
      qAr: "كيف يعمل نظام التبديل الذكي (Fallback Routing)؟",
      qEn: "How does the Fallback Routing algorithm work?",
      aAr: "إذا حدث ضغط على أحد المزودين، تقوم خوارزمية المنصة بإعادة توجيه استعلامك آلياً وبلمح البصر لنموذج مكافئ لضمان استمرار الخدمة دون انقطاع.",
      aEn: "If any provider experiences degradation, our smart routing instantly redirects your query to an equivalent model tier.",
    },
    {
      qAr: "هل يمكنني إلغاء اشتراكي في أي وقت؟",
      qEn: "Can I cancel my subscription anytime?",
      aAr: "بالتأكيد. يمكنك إلغاء أو تغيير خطة اشتراكك في أي وقت مباشرة من إعدادات حسابك.",
      aEn: "Absolutely. You can modify or cancel your active plan at any time with one click from account settings.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30 selection:text-[#00d4aa] relative overflow-x-hidden">
      {/* Universal Navigation Header with Return/Back Button */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "خطط وباقات الاستخدام والاشتراك" : "Pricing & Subscription Plans"}
        subtitle={isRtl ? "مرونة كاملة تلبي احتياجات الأفراد والمؤسسات" : "Transparent tiers for developers & enterprises"}
        icon={<Award className="w-4 h-4" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="pricing"
        actions={<LanguageSwitcher locale={locale} />}
      />

      {/* Hero Header */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 text-center z-10">
        <WaveBackground />

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto relative z-10 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111a1a] border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-semibold shadow-md">
            <Award className="w-4 h-4 text-[#00ff88]" />
            <span>{isRtl ? "خطط مرنة تناسب جميع الاحتياجات" : "Flexible Plans Built For Scale"}</span>
          </div>

          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#e8f5f5] leading-tight">
            {isRtl ? "اختر الخطة المناسبة لقدراتك" : "Simple, Transparent Pricing"}
          </h1>

          <p className="text-sm sm:text-base text-[#88b0b0] max-w-2xl mx-auto leading-relaxed">
            {isRtl
              ? "استمتع بقوة نماذج SoufAI المتطورة، والوكيل الذكي Nodaba، والـ Sandboxes البرمجية بكل أريحية."
              : "Power your software development and AI research with state-of-the-art models and agent tools."}
          </p>

          {/* Monthly / Annual Billing Selector */}
          <div className="pt-4 flex items-center justify-center">
            <div className="p-1 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] inline-flex items-center gap-1">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md"
                    : "text-[#88b0b0] hover:text-[#e8f5f5]"
                }`}
              >
                {isRtl ? "دفع شهري" : "Monthly Billing"}
              </button>

              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md"
                    : "text-[#88b0b0] hover:text-[#e8f5f5]"
                }`}
              >
                <span>{isRtl ? "دفع سنوي" : "Annual Billing"}</span>
                <span className="text-[9px] bg-[#00ff88]/20 text-[#00ff88] px-1.5 py-0.5 rounded-md font-extrabold">
                  {isRtl ? "خصم 20%" : "20% OFF"}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Main Pricing Cards Grid */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-20 relative z-10 flex-1 space-y-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.2 }}
                className={`glass-card p-6 sm:p-8 rounded-3xl border flex flex-col justify-between relative transition-all shadow-xl ${
                  plan.isPopular
                    ? "bg-gradient-to-b from-[#111a1a] via-[#0d1717] to-[#111a1a] border-[#00d4aa] ring-2 ring-[#00d4aa]/30 shadow-[#00d4aa]/10"
                    : "bg-[#0a0f0f]/90 border-[#1e2e2e]"
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] text-[10px] font-extrabold tracking-wider uppercase shadow-lg">
                    {isRtl ? plan.badgeAr : plan.badgeEn}
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-[#e8f5f5]">
                        {isRtl ? plan.nameAr : plan.nameEn}
                      </h2>
                      {plan.id === "free" && <SoufShieldIcon size={24} glow />}
                      {plan.id === "pro" && <SoufDiamondIcon size={26} glow />}
                      {plan.id === "ultra" && <SoufCrownLuxuryIcon size={26} glow />}
                    </div>
                    <p className="text-xs text-[#88b0b0] mt-1 min-h-[36px]">
                      {isRtl ? plan.descAr : plan.descEn}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1 border-b border-[#1e2e2e]/80 pb-6">
                    <span className="text-4xl sm:text-5xl font-black text-[#e8f5f5] tracking-tight">
                      {price}
                    </span>
                    <span className="text-xs text-[#4a7070] font-semibold">
                      {price === "$0"
                        ? isRtl ? "/مجاناً للأبد" : "/forever free"
                        : billingCycle === "annual" ? (isRtl ? "/شهرياً (يدفع سنوياً)" : "/mo billed annually") : (isRtl ? "/شهرياً" : "/month")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-[#4a7070] uppercase tracking-wider">
                      {isRtl ? "المميزات المشمولة:" : "Included Features:"}
                    </p>
                    <ul className="space-y-2.5">
                      {(isRtl ? plan.featuresAr : plan.featuresEn).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-[#c8dede]">
                          <CheckCircle2 className="w-4 h-4 text-[#00d4aa] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8">
                  <Link
                    href={plan.ctaLink}
                    className={`w-full py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      plan.isPopular
                        ? "bg-[#00d4aa] text-[#0a0f0f] hover:bg-[#00d4aa]/90 shadow-lg shadow-[#00d4aa]/20"
                        : "bg-[#111a1a] border border-[#1e2e2e] text-[#e8f5f5] hover:border-[#00d4aa]/60"
                    }`}
                  >
                    <span>{isRtl ? plan.ctaTextAr : plan.ctaTextEn}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="space-y-6 pt-10 border-t border-[#1e2e2e]">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#e8f5f5]">
              {isRtl ? "الأسئلة الشائعة حول الاشتراكات" : "Frequently Asked Questions"}
            </h2>
            <p className="text-xs text-[#88b0b0]">
              {isRtl ? "إجابات مباشرة عن أبرز التساؤلات قبل البدء" : "Everything you need to know before upgrading"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {faqs.map((f, i) => (
              <div key={i} className="p-5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-2">
                <h3 className="text-xs font-bold text-[#00d4aa] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? f.qAr : f.qEn}</span>
                </h3>
                <p className="text-[11px] text-[#88b0b0] leading-relaxed">
                  {isRtl ? f.aAr : f.aEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#1e2e2e] py-6 px-4 sm:px-6 bg-[#0a0f0f] text-xs text-[#4a7070] relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <p className="text-xs font-semibold">
            SoufTools Platform. All rights reserved 2026 ©
          </p>

          <div className="flex items-center gap-4 text-xs font-medium">
            <Link href={`/${locale}/pricing`} className="text-[#00d4aa] font-bold">
              {isRtl ? "الأسعار" : "Pricing"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/privacy`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الخصوصية" : "Privacy"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/terms`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الشروط" : "Terms"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
