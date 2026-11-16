// app/[locale]/models/compare/page.tsx
import { Metadata } from "next";
import { ModelComparePage } from "@/components/models/ModelComparePage";
import { getAllModels } from "@/lib/models/modelRegistry";

export const metadata: Metadata = {
  title: "مقارنة نماذج SoufAI الشاملة | Model Comparison",
  description: "مقارنة دقيقة ومباشرة بين نماذج SoufAI من حيث السرعة، التفكير المنطقي، البرمجة، نافذة السياق، والأدوات المدعومة بدون أرقام وهمية.",
};

export default async function CompareRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = locale === "ar" || locale === "ur";
  const models = getAllModels();

  return <ModelComparePage locale={locale} isRtl={isRtl} initialModels={models} />;
}
