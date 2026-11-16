// app/[locale]/models/page.tsx
import { Metadata } from "next";
import { ModelCenterHome } from "@/components/models/ModelCenterHome";
import { getAllModels } from "@/lib/models/modelRegistry";
import { SettingsRepository } from "@/lib/db";

export const metadata: Metadata = {
  title: "مركز نماذج الذكاء الاصطناعي | SoufAI Model Center",
  description: "استكشف نماذج SoufAI المتخصصة: Spark فائق السرعة، Core المتوازن، Pro للتفكير العميق، Coder لهندسة البرمجيات، و Ultra لأقصى درجات الذكاء المستقل.",
  openGraph: {
    title: "SoufAI Model Center - مركز النماذج",
    description: "اكتشف، قارن، ووجّه مهامك لأفضل نموذج ذكاء اصطناعي من SoufTools.",
  },
};

export default async function ModelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = locale === "ar" || locale === "ur";
  
  const allModels = getAllModels();
  let models = allModels;

  try {
    const config = await SettingsRepository.getSetting<any>("admin_system_config");
    if (config?.activeModelTiers && Array.isArray(config.activeModelTiers) && config.activeModelTiers.length > 0) {
      models = allModels.filter((m: any) => 
        config.activeModelTiers.includes(m.id) || config.activeModelTiers.includes(m.tier)
      );
    }
  } catch (err) {
    // Graceful fallback to all registered models
  }

  return <ModelCenterHome locale={locale} isRtl={isRtl} initialModels={models} />;
}
