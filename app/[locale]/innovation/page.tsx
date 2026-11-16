import React from "react";
import { constructMetadata } from "@/lib/seo";
import { isRtlLocale } from "@/lib/i18n";
import { InnovationClientPage } from "@/components/innovation/InnovationClientPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return constructMetadata({
    title: isRtl
      ? "خريطة تدفق الذكاء والابتكار الإقليمي — SoufTools Innovation"
      : "Regional Intelligence Flow Map — SoufTools",
    description: isRtl
      ? "خريطة تفاعلية لربط العقول التقنية وحاضنات الابتكار عبر جهة فاس-مكناس وسائر أقاليم المملكة."
      : "Interactive regional intelligence map and technology cluster telemetry for Fez-Meknes.",
    path: "/innovation",
    locale,
  });
}

export default async function InnovationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <InnovationClientPage locale={locale} />;
}
