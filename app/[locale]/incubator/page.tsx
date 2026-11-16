import React from "react";
import { constructMetadata } from "@/lib/seo";
import { isRtlLocale } from "@/lib/i18n";
import { IncubatorClientPage } from "@/components/incubator/IncubatorClientPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "صندوق الابتكار الإقليمي — SoufTools Incubator"
      : "Regional Innovation Incubator — SoufTools",
    description: isRtl
      ? "حاضنة المشاريع والتقنيات الذكية الناشئة لدعم رواد الأعمال والمطورين بالموارد التكنولوجية والخبرات."
      : "Regional project incubator empowering startups and tech ventures in Meknes and Morocco.",
    path: "/incubator",
    locale,
  });
}

export default async function IncubatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <IncubatorClientPage locale={locale} />;
}
