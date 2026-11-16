import React from "react";
import { constructMetadata } from "@/lib/seo";
import { isRtlLocale } from "@/lib/i18n";
import { AudioClientPage } from "@/components/audio/AudioClientPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "تحويل الكلام إلى نص بدقة — SoufTools Speech-to-Text"
      : "Speech-to-Text Precision — SoufTools",
    description: isRtl
      ? "تحويل التسجيلات والملفات الصوتية إلى نصوص مقروءة عالية الدقة مع تمييز اللهجات وتحليل النبرات."
      : "High-precision neural audio transcription and voice analytics engine.",
    path: "/audio",
    locale,
  });
}

export default async function AudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AudioClientPage locale={locale} />;
}
