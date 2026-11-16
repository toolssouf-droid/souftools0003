import React from "react";
import { constructMetadata } from "@/lib/seo";
import { PrivacyClientPage } from "@/components/privacy/PrivacyClientPage";
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
      ? "سياسة الخصوصية وحماية البيانات — SoufTools Privacy Policy"
      : "Privacy Policy & Data Protection — SoufTools",
    description: isRtl
      ? "التزام كامل بحماية خصوصية بياناتك واستفساراتك البرمجية مع التشفير التام وتوافق مع لوائح GDPR و CCPA."
      : "Our strict commitment to end-to-end encryption, zero data selling, and full user control over AI memory and chat logs.",
    path: "/privacy",
    locale,
    keywords: ["سياسة الخصوصية SoufTools", "أمان البيانات", "حماية المحادثات", "GDPR CCPA SoufTools"],
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PrivacyClientPage locale={locale} />;
}
