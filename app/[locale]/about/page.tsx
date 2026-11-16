import React from "react";
import { constructMetadata } from "@/lib/seo";
import { AboutClientPage } from "@/components/about/AboutClientPage";
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
      ? "عن المنصة ورؤيتنا — SoufTools About & Vision"
      : "About SoufTools — Next-Gen AI Vision & Technology",
    description: isRtl
      ? "تعرف على قصة SoufTools، النماذج الخمسة المتخصصة (SoufAI Spark, Core, Pro, Coder, Ultra)، والبنية التحتية البرمجية المرنة."
      : "Discover the technology behind SoufTools, our specialized model ecosystem (SoufAI Spark, Core, Pro, Coder, Ultra), and our commitment to Arabic AI excellence.",
    path: "/about",
    locale,
    keywords: ["عن SoufTools", "نماذج SoufAI", "رؤية الذكاء الاصطناعي", "SoufTools vision"],
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AboutClientPage locale={locale} />;
}
