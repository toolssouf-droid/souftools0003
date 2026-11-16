import React from "react";
import Link from "next/link";
import { constructMetadata, TOOLS_DIRECTORY, getWebSiteSchema, getBreadcrumbSchema } from "@/lib/seo";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { WaveBackground } from "@/components/ui/WaveBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";
import {
  MessageSquare,
  Sparkles,
  Wand2,
  Globe,
  Code2,
  ArrowLeft,
  ArrowRight,
  Search,
  CheckCircle2,
  Layers,
  Zap,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "دليل أدوات الذكاء الاصطناعي — SoufTools AI Catalog"
      : "AI Tools Catalog & Directory — SoufTools",
    description: isRtl
      ? "استكشف مجموعة أدوات SoufTools المتقدمة: الدردشة الذكية متعددة النماذج، توليد الصور، تعديل الصور، البحث الحي في الويب، والوكيل البرمجي."
      : "Explore SoufTools advanced AI ecosystem: multi-model AI chat, text-to-image generator, inpainting photo editor, real-time web search, and sandboxed AI coding.",
    path: "/tools",
    locale,
    keywords: [
      "دليل أدوات الذكاء الاصطناعي",
      "أدوات الذكاء الاصطناعي العربية",
      "SoufTools catalog",
      "ai tools directory",
      "arabic ai suite",
    ],
  });
}

const iconMap: Record<string, React.ElementType> = {
  MessageSquare,
  Sparkles,
  Wand2,
  Globe,
  Code2,
};

export default async function ToolsCatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  const jsonLdWebsite = getWebSiteSchema(locale);
  const jsonLdBreadcrumbs = getBreadcrumbSchema(
    [
      { name: isRtl ? "الرئيسية" : "Home", item: "/" },
      { name: isRtl ? "أدوات الذكاء الاصطناعي" : "AI Tools", item: "/tools" },
    ],
    locale
  );

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30 selection:text-[#00d4aa] relative overflow-x-hidden">
      {/* Structured Data Script Tags */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumbs) }}
      />

      {/* Universal Navigation Header with explicit Back Button */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "دليل أدوات الذكاء الاصطناعي" : "AI Tools Directory"}
        subtitle={isRtl ? "منظومة أدوات SoufTools المتقدمة" : "SoufTools AI Suite"}
        icon={<Layers className="w-4 h-4" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="tools"
        actions={<LanguageSwitcher locale={locale} />}
      />

      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 text-center z-10">
        <WaveBackground />

        <div className="max-w-4xl mx-auto relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111a1a] border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-semibold shadow-md">
            <Layers className="w-4 h-4 text-[#00ff88]" />
            <span>{isRtl ? "دليل الأدوات والتقنيات الفائقة" : "SoufTools Comprehensive AI Suite"}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#e8f5f5] leading-tight">
            {isRtl
              ? "منظومة أدوات الذكاء الاصطناعي المباشرة"
              : "Advanced Production AI Tools Catalog"}
          </h1>

          <p className="text-sm sm:text-base text-[#88b0b0] max-w-2xl mx-auto leading-relaxed">
            {isRtl
              ? "مجموعة متكاملة من الحلول الذكية المصممة للمطورين، المصممين، والباحثين مع دعم كامل للغة العربية والسرعة الفائقة."
              : "A unified suite of specialized AI engines engineered for developers, creators, researchers, and technical workflows."}
          </p>
        </div>
      </section>

      {/* Main Tools Catalog Grid */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-20 relative z-10 flex-1 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS_DIRECTORY.map((tool) => {
            const IconComp = iconMap[tool.icon] || Zap;
            const name = isRtl ? tool.nameAr : tool.nameEn;
            const desc = isRtl ? tool.descriptionAr : tool.descriptionEn;

            return (
              <div
                key={tool.slug}
                className="glass-card p-6 rounded-3xl border border-[#1e2e2e] hover:border-[#00d4aa]/60 transition-all flex flex-col justify-between group space-y-5 shadow-xl hover:shadow-[#00d4aa]/10"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <IconComp className="w-6 h-6" />
                    </div>

                    <span className="text-[10px] font-mono text-[#4a7070] bg-[#111a1a] px-2.5 py-1 rounded-full border border-[#1e2e2e]">
                      {tool.category}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#e8f5f5] group-hover:text-[#00d4aa] transition-colors">
                      {name}
                    </h2>
                    <p className="text-xs text-[#88b0b0] mt-2 leading-relaxed line-clamp-3">
                      {desc}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1e2e2e]/60 flex items-center justify-between gap-2">
                  <Link
                    href={`/${locale}/tools/${tool.slug}`}
                    className="text-xs font-bold text-[#00d4aa] hover:underline flex items-center gap-1"
                  >
                    <span>{isRtl ? "تفاصيل الأداة والشرح" : "Explore Tool Guide"}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>

                  <Link
                    href={`/${locale}/chat`}
                    className="px-3 py-1.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa] text-xs text-[#e8f5f5] font-semibold transition-all"
                  >
                    {isRtl ? "تشغيل الآن" : "Launch"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Value Proposition Section */}
        <section className="glass-card p-8 rounded-3xl border border-[#1e2e2e] space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#e8f5f5]">
              {isRtl ? "لماذا تختار منصة SoufTools؟" : "Why Choose SoufTools AI Suite?"}
            </h2>
            <p className="text-xs text-[#88b0b0]">
              {isRtl ? "بنية تحتية متطورة توفر أقصى موثوقية وسرعة في مكان واحد" : "Enterprise-ready infrastructure built for privacy, performance, and accuracy"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#00d4aa]/15 text-[#00d4aa] flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-[#e8f5f5]">{isRtl ? "دعم عربي فائائق" : "Native Bilingual Support"}</h3>
              <p className="text-[11px] text-[#88b0b0] leading-relaxed">
                {isRtl ? "فهم متعمق للغة العربية وتراكيبها اللغوية مع الحفاظ على الاتجاه RTL والتنسيق النظيف." : "Flawless Arabic and English natural language comprehension and formatting."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#0ea5e9]/15 text-[#0ea5e9] flex items-center justify-center font-bold">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-[#e8f5f5]">{isRtl ? "سرعة واستجابة لحظية" : "Sub-second Response Speed"}</h3>
              <p className="text-[11px] text-[#88b0b0] leading-relaxed">
                {isRtl ? "معالجة فورية للاستفسارات بفضل معالج التبديل الذكي بين خوادم النماذج الفائقة." : "Ultra-low latency powered by intelligent provider failover and streaming response routes."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#00ff88]/15 text-[#00ff88] flex items-center justify-center font-bold">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-[#e8f5f5]">{isRtl ? "بيئات معالجة معزولة" : "Secure Sandboxed Execution"}</h3>
              <p className="text-[11px] text-[#88b0b0] leading-relaxed">
                {isRtl ? "تشغيل وتحليل الأكواد والملفات بأمان كامل داخل بيئات سحابية محمية ومستقلة." : "Isolated cloud containers for live code execution, preview rendering, and data extraction."}
              </p>
            </div>
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
            <Link href={`/${locale}/tools`} className="text-[#00d4aa] font-bold">
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
