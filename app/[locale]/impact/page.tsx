import React from "react";
import { constructMetadata } from "@/lib/seo";
import { isRtlLocale } from "@/lib/i18n";
import { ImpactClientPage } from "@/components/impact/ImpactClientPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "سحابة الأثر المجتمعي والذكاء الجماعي — SoufTools Impact"
      : "Societal Impact Cloud — SoufTools",
    description: isRtl
      ? "مؤشرات الأثر المجتمعي والذكاء الجماعي لقياس التحول الرقمي وتأثير الذكاء الاصطناعي في التعليم والصحة والزراعة."
      : "Societal impact metrics, SDG alignments, and collective intelligence indicators.",
    path: "/impact",
    locale,
  });
}

export default async function ImpactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ImpactClientPage locale={locale} />;
}
