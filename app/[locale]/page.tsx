import React from "react";
import { constructMetadata, getWebSiteSchema, getOrganizationSchema } from "@/lib/seo";
import { HomePageClient } from "@/components/ui/HomePageClient";
import { isRtlLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "SoufTools — منصة وأدوات الذكاء الاصطناعي العالمية"
      : "SoufTools — AI Tools & Intelligent AI Platform",
    description: isRtl
      ? "منظومة متكاملة لنماذج الذكاء الاصطناعي الفائقة مع شات عربي، توليد ومعالجة الصور، البحث الحي في الويب، والوكيل البرمجي الذكي مع معاينة مباشرة."
      : "All-in-one production AI platform featuring multi-model AI chat, text-to-image generator, photo inpainting editor, grounded web search, and sandboxed AI coding agent.",
    path: "/",
    locale,
    keywords: [
      "SoufTools",
      "أدوات الذكاء الاصطناعي",
      "شات عربي ذكي",
      "SoufAI",
      "توليد صور بالذكاء الاصطناعي",
      "برمجة بالذكاء الاصطناعي",
      "AI platform",
    ],
  });
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const jsonLdWebsite = getWebSiteSchema(locale);
  const jsonLdOrg = getOrganizationSchema();

  return (
    <>
      <script
        id="schema-org-website"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
      />
      <script
        id="schema-org-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }}
      />
      <HomePageClient locale={locale} />
    </>
  );
}
