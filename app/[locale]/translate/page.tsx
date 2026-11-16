import React from "react";
import { constructMetadata } from "@/lib/seo";
import { isRtlLocale } from "@/lib/i18n";
import { TranslateClientPage } from "@/components/translate/TranslateClientPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "الترجمة الفورية الدقيقة — SoufTools Translate"
      : "Precise Instant Translation — SoufTools",
    description: isRtl
      ? "محرك ترجمة عصبية ذكي يدعم أكثر من 90 لغة بدقة سياقية فائقة وفهم عميق للثقافة والمصطلحات التخصصية."
      : "Contextual neural translation engine with deep multi-language semantic understanding.",
    path: "/translate",
    locale,
  });
}

export default async function TranslatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TranslateClientPage locale={locale} />;
}
