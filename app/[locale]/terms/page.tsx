import React from "react";
import { constructMetadata } from "@/lib/seo";
import { TermsClientPage } from "@/components/terms/TermsClientPage";
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
      ? "شروط الاستخدام وأحكام الخدمة — SoufTools Terms of Service"
      : "Terms of Service & Usage Governance — SoufTools",
    description: isRtl
      ? "اتفاقية وشروط الاستخدام العادل لنماذج SoufAI والوكيل الذكي Nodaba مع الحقوق التجارية الكاملة للمخرجات."
      : "Legal terms of service, fair use policy, and intellectual property terms governing SoufTools platform usage.",
    path: "/terms",
    locale,
    keywords: ["شروط الخدمة SoufTools", "الاستخدام العادل", "حقوق الملكية للمخرجات"],
  });
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TermsClientPage locale={locale} />;
}
