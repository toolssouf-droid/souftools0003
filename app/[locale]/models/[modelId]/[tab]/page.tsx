// app/[locale]/models/[modelId]/[tab]/page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModelById } from "@/lib/models/modelRegistry";
import { ModelDetailPage } from "@/components/models/ModelDetailPage";

const VALID_TABS = [
  "overview",
  "capabilities",
  "performance",
  "usage",
  "tools",
  "activity",
  "limits",
  "configuration",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; modelId: string; tab: string }>;
}): Promise<Metadata> {
  const { modelId, tab } = await params;
  const model = getModelById(modelId);

  if (!model) {
    return { title: "النموذج غير موجود | SoufTools" };
  }

  const tabLabels: Record<string, string> = {
    overview: "نظرة عامة",
    capabilities: "القدرات",
    performance: "الأداء الحقيقي",
    usage: "الاستخدام",
    tools: "الأدوات المدعومة",
    activity: "النشاط المباشر",
    limits: "الحدود والقيود",
    configuration: "الإعدادات",
  };

  const currentTabLabel = tabLabels[tab] || tab;

  return {
    title: `${currentTabLabel} - ${model.display_name} | SoufAI Model Center`,
    description: `${currentTabLabel} لنموذج ${model.display_name} (${model.version}) في منظومة SoufTools`,
  };
}

export default async function ModelTabSubRoute({
  params,
}: {
  params: Promise<{ locale: string; modelId: string; tab: string }>;
}) {
  const { locale, modelId, tab } = await params;
  const model = getModelById(modelId);

  if (!model) {
    notFound();
  }

  if (!VALID_TABS.includes(tab as any)) {
    notFound();
  }

  const isRtl = locale === "ar" || locale === "ur";

  return (
    <ModelDetailPage
      locale={locale}
      isRtl={isRtl}
      model={model}
      initialTab={tab as any}
    />
  );
}
