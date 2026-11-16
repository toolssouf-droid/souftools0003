import { Metadata } from "next";
import { LaunchWorkspace } from "@/components/launch/LaunchWorkspace";
import { isRtlLocale } from "@/lib/i18n";

interface LaunchPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LaunchPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);

  return {
    title: isRtl ? "مساحة الإطلاق الذكية — SoufTools" : "Smart Launch Experience — SoufTools",
    description: isRtl
      ? "المساحة المتقدمة لإطلاق الذكاء الاصطناعي، المهام، البرمجة، والبحث المباشر عبر SoufTools"
      : "Personalized AI launchpad with adaptive workflows, live research, autonomous agent and coding tools.",
  };
}

export default async function LaunchPage({ params }: LaunchPageProps) {
  const { locale } = await params;
  return <LaunchWorkspace locale={locale} />;
}
