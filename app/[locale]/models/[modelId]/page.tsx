import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModelById } from "@/lib/models/modelRegistry";
import { ModelDetailPage } from "@/components/models/ModelDetailPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; modelId: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const modelId = resolvedParams.modelId;
  const model = getModelById(modelId);

  if (!model) {
    return { title: "النموذج غير موجود | SoufTools" };
  }

  return {
    title: `${model.display_name} - ${model.identity.badgeAr} | SoufAI Model Center`,
    description: model.identity.descriptionAr,
    openGraph: {
      title: `${model.display_name} (${model.version})`,
      description: model.identity.taglineAr,
    },
  };
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ locale: string; modelId: string }>;
}) {
  const resolvedParams = await params;
  const { locale, modelId } = resolvedParams;
  const model = getModelById(modelId);

  if (!model) {
    notFound();
  }

  const isRtl = locale === "ar" || locale === "ur";

  return <ModelDetailPage locale={locale} isRtl={isRtl} model={model} initialTab="overview" />;
}
