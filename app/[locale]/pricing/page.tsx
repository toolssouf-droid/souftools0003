import React from "react";
import { constructMetadata } from "@/lib/seo";
import { PricingClientPage } from "@/components/pricing/PricingClientPage";
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
      ? "خطط الأسعار والاشتراكات — SoufTools Pricing"
      : "Pricing Plans & Subscriptions — SoufTools",
    description: isRtl
      ? "خطط مرنة وبدون تكاليف خفية. استمتع بالخطة المجانية للأبد، أو ارتقِ إلى خطة Pro لفتح المعاينة المباشرة والوكيل الذكي Nodaba."
      : "Transparent and flexible pricing. Free forever explorer tier, plus Pro developer tiers for unthrottled access and AI sandbox tools.",
    path: "/pricing",
    locale,
    keywords: ["أسعار SoufTools", "خطة مجانية بالذكاء الاصطناعي", "اشتراك SoufAI", "SoufTools pricing"],
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PricingClientPage locale={locale} />;
}
