import React from "react";
import { constructMetadata } from "@/lib/seo";
import { isRtlLocale } from "@/lib/i18n";
import { ImagesClientPage } from "@/components/images/ImagesClientPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "توليد الصور والفيديو — SoufTools Vision Studio"
      : "Image & Video Generation — SoufTools",
    description: isRtl
      ? "استوديو توليد الصور والتصميم الرقمي فائق الدقة بالذكاء الاصطناعي مع تحكم متكامل في الإضاءة والأنماط."
      : "High-fidelity neural visual generation and creative studio engine.",
    path: "/images",
    locale,
  });
}

export default async function ImagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ImagesClientPage locale={locale} />;
}
