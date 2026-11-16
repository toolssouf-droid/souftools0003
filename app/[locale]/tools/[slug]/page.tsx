import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  constructMetadata,
  TOOLS_DIRECTORY,
  getToolSchema,
  getBreadcrumbSchema,
  getFAQSchema,
} from "@/lib/seo";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { WaveBackground } from "@/components/ui/WaveBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { SUPPORTED_LOCALES, isRtlLocale } from "@/lib/i18n";
import {
  MessageSquare,
  Sparkles,
  Wand2,
  Globe,
  Code2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Zap,
  Target,
  Key,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isRtl = isRtlLocale(locale);
  const tool = TOOLS_DIRECTORY.find((t) => t.slug === slug);

  if (!tool) return {};

  return constructMetadata({
    title: isRtl ? tool.titleAr : tool.titleEn,
    description: isRtl ? tool.descriptionAr : tool.descriptionEn,
    path: `/tools/${tool.slug}`,
    locale,
    keywords: isRtl ? tool.keywordsAr : tool.keywordsEn,
  });
}

const iconMap: Record<string, React.ElementType> = {
  MessageSquare,
  Sparkles,
  Wand2,
  Globe,
  Code2,
};

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isRtl = isRtlLocale(locale);
  const tool = TOOLS_DIRECTORY.find((t) => t.slug === slug);

  if (!tool) {
    notFound();
  }

  const IconComp = iconMap[tool.icon] || Zap;
  const toolName = isRtl ? tool.nameAr : tool.nameEn;
  const toolDesc = isRtl ? tool.descriptionAr : tool.descriptionEn;
  const faqs = isRtl ? tool.faqsAr : tool.faqsEn;
  const keywords = isRtl ? tool.keywordsAr : tool.keywordsEn;

  // Structured Data
  const jsonLdTool = getToolSchema(tool, locale);
  const jsonLdBreadcrumbs = getBreadcrumbSchema(
    [
      { name: isRtl ? "الرئيسية" : "Home", item: "/" },
      { name: isRtl ? "الأدوات" : "Tools", item: "/tools" },
      { name: toolName, item: `/tools/${tool.slug}` },
    ],
    locale
  );
  const jsonLdFaq = getFAQSchema(faqs);

  // Related Tools (excluding current)
  const relatedTools = TOOLS_DIRECTORY.filter((t) => t.slug !== tool.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30 selection:text-[#00d4aa] relative overflow-x-hidden">
      {/* Structured Data Script Tags */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdTool) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumbs) }}
      />
      {jsonLdFaq && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
      )}

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between relative z-20 gap-3 border-b border-[#1e2e2e]/60">
        <Link href={`/${locale}`} className="flex items-center gap-3 shrink-0">
          <SoufToolsLogo size={34} showText={true} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <LanguageSwitcher locale={locale} />

          <Link
            href={`/${locale}/chat`}
            className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] font-bold text-xs shadow-lg shadow-[#00d4aa]/20 hover:scale-105 transition-all flex items-center gap-1.5"
          >
            <span>{isRtl ? "تشغيل الأداة" : "Launch Tool"}</span>
            {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Link>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative py-10 sm:py-14 px-4 sm:px-6 z-10">
        <WaveBackground />

        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-xs text-[#88b0b0]">
            <Link href={`/${locale}`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الرئيسية" : "Home"}
            </Link>
            <span>/</span>
            <Link href={`/${locale}/tools`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "دليل الأدوات" : "Tools"}
            </Link>
            <span>/</span>
            <span className="text-[#00d4aa] font-semibold">{toolName}</span>
          </nav>

          {/* Title Header Block */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00d4aa] flex items-center justify-center shrink-0">
              <IconComp className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#111a1a] text-[#00d4aa] px-2.5 py-0.5 rounded-full border border-[#00d4aa]/30">
                  {tool.category}
                </span>
                <span className="text-[10px] text-[#4a7070] font-mono">
                  Intent: {tool.primaryIntent}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-[#e8f5f5]">
                {toolName}
              </h1>
            </div>
          </div>

          <p className="text-sm sm:text-base text-[#88b0b0] leading-relaxed">
            {toolDesc}
          </p>

          {/* Search Intent & Keywords metadata tags */}
          <div className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-[#00d4aa] font-bold shrink-0">
              <Target className="w-4 h-4" />
              <span>{isRtl ? "سياق الأداة:" : "Tool Intent:"}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#88b0b0]">
              {keywords.map((kw, i) => (
                <span key={i} className="bg-[#0a0f0f] px-2.5 py-1 rounded-lg border border-[#1e2e2e]">
                  #{kw}
                </span>
              ))}
            </div>
          </div>

          {/* High Impact Interactive CTA Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-[#111a1a] via-[#0d1c1c] to-[#111a1a] border border-[#00d4aa]/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-right">
              <h2 className="text-sm sm:text-base font-bold text-[#e8f5f5]">
                {isRtl ? "جاهز للبدء واستخدام هذه الأداة الآن؟" : "Ready to use this AI tool right now?"}
              </h2>
              <p className="text-xs text-[#88b0b0]">
                {isRtl ? "بدون رسوم معقدة أو خطوات إعداد طويلة — الوصول مباشر ولحظي." : "Instant zero-setup access directly inside the SoufTools workspace."}
              </p>
            </div>

            <Link
              href={`/${locale}/chat`}
              className="px-6 py-3 rounded-2xl bg-[#00d4aa] text-[#0a0f0f] font-extrabold text-xs shadow-lg shadow-[#00d4aa]/25 hover:scale-105 transition-all flex items-center gap-2 shrink-0"
            >
              <span>{isRtl ? "ابدأ التجربة مجاناً" : "Try Free Now"}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Link>
          </div>
        </div>
      </section>

      {/* Main Helpful Content Body */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 pb-20 relative z-10 flex-1 space-y-10">
        {/* Section 1: Overview & What it is */}
        <section className="glass-card p-6 sm:p-8 rounded-3xl border border-[#1e2e2e] space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-[#e8f5f5] flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00d4aa]" />
            <span>{isRtl ? `ما هي أداة ${toolName}؟` : `What is ${toolName}?`}</span>
          </h2>

          <p className="text-xs sm:text-sm text-[#88b0b0] leading-relaxed">
            {isRtl
              ? `صُممت أداة ${toolName} لتكون الخيار الأمثل لمعالجة المهام البرمجية والتحليلية والتوليدية بمرونة عالية. تعتمد الأداة على محركات SoufAI المتطورة لتقديم مخرجات عالية الدقة وسريعة الاستجابة بدعم كامل للغة العربية.`
              : `${toolName} is a production-tier AI application designed to streamline workflows, complex problem-solving, and creative output with exceptional precision and sub-second generation speeds.`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-1">
              <span className="text-[10px] text-[#00d4aa] font-bold uppercase">{isRtl ? "الفئة والهدف الرئيسي" : "Category & Intent"}</span>
              <p className="text-xs font-semibold text-[#e8f5f5]">{tool.category} — {tool.primaryIntent}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-1">
              <span className="text-[10px] text-[#0ea5e9] font-bold uppercase">{isRtl ? "الاستخدام الثانوي" : "Secondary Scope"}</span>
              <p className="text-xs font-semibold text-[#e8f5f5]">{tool.secondaryIntent}</p>
            </div>
          </div>
        </section>

        {/* Section 2: How to Use */}
        <section className="glass-card p-6 sm:p-8 rounded-3xl border border-[#1e2e2e] space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-[#e8f5f5] flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
            <span>{isRtl ? "كيفية الاستخدام بـ 3 خطوات بسيطة" : "How to Use in 3 Simple Steps"}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-2 relative">
              <span className="text-2xl font-black text-[#00d4aa]/30">01</span>
              <h3 className="font-bold text-[#e8f5f5]">{isRtl ? "1. افتح مساحة العمل" : "1. Launch Workspace"}</h3>
              <p className="text-[11px] text-[#88b0b0]">
                {isRtl ? "انقر على زر البدء للانتقال مباشرة إلى واجهة التفاعل." : "Click launch to enter the live interactive session."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-2 relative">
              <span className="text-2xl font-black text-[#00d4aa]/30">02</span>
              <h3 className="font-bold text-[#e8f5f5]">{isRtl ? "2. أدخل طلبك أو ملفك" : "2. Input Prompt or File"}</h3>
              <p className="text-[11px] text-[#88b0b0]">
                {isRtl ? "اكتب استفسارك أو ارفع الصورة/الكود المطلوب معالجته." : "Type your query or attach relevant code or images."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-2 relative">
              <span className="text-2xl font-black text-[#00d4aa]/30">03</span>
              <h3 className="font-bold text-[#e8f5f5]">{isRtl ? "3. استلم النتيجة وتفاعل معها" : "3. Receive & Refine Result"}</h3>
              <p className="text-[11px] text-[#88b0b0]">
                {isRtl ? "حمل المخرجات، عاين الأكواد حياً، أو استمع للقراءة الصوتية." : "Download generated assets, run code live, or listen via TTS."}
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Frequently Asked Questions (FAQ) */}
        {faqs && faqs.length > 0 && (
          <section className="glass-card p-6 sm:p-8 rounded-3xl border border-[#1e2e2e] space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-[#e8f5f5] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <span>{isRtl ? "الأسئلة الشائعة" : "Frequently Asked Questions"}</span>
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold text-[#00d4aa]">
                    {faq.q}
                  </h3>
                  <p className="text-xs text-[#88b0b0] leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 4: Related Tools Network (Internal Linking) */}
        <section className="space-y-4 pt-6 border-t border-[#1e2e2e]">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-[#e8f5f5]">
              {isRtl ? "أدوات ذات صلة قد تهمك" : "Related AI Tools"}
            </h2>

            <Link href={`/${locale}/tools`} className="text-xs text-[#00d4aa] hover:underline">
              {isRtl ? "عرض جميع الأدوات" : "View All Tools"}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedTools.map((rel) => {
              const RelIcon = iconMap[rel.icon] || Zap;
              const relName = isRtl ? rel.nameAr : rel.nameEn;

              return (
                <Link
                  key={rel.slug}
                  href={`/${locale}/tools/${rel.slug}`}
                  className="p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa] transition-all group space-y-2 block cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#00d4aa]/15 text-[#00d4aa] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <RelIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-[#e8f5f5] group-hover:text-[#00d4aa] transition-colors">
                    {relName}
                  </h3>
                  <p className="text-[10px] text-[#4a7070] line-clamp-2">
                    {isRtl ? rel.descriptionAr : rel.descriptionEn}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#1e2e2e] py-6 px-4 sm:px-6 bg-[#0a0f0f] text-xs text-[#4a7070] relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <p className="text-xs font-semibold">
            SoufTools Platform. All rights reserved 2026 ©
          </p>

          <div className="flex items-center gap-4 text-xs font-medium">
            <Link href={`/${locale}/tools`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الأدوات" : "Tools Directory"}
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
