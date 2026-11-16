import type { Metadata } from "next";
import "../globals.css";
import { AnimatedLayout } from "@/components/ui/AnimatedLayout";
import { constructMetadata } from "@/lib/seo";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { isRtlLocale } from "@/lib/i18n";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function loadMessageDictionary(locale: string): Record<string, any> {
  try {
    const filePath = path.join(process.cwd(), "messages", `${locale}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (content && content.trim()) {
        try {
          return JSON.parse(content);
        } catch {}
      }
    }
    const fallbackPath = path.join(process.cwd(), "messages", "en.json");
    if (fs.existsSync(fallbackPath)) {
      const content = fs.readFileSync(fallbackPath, "utf-8");
      if (content && content.trim()) {
        try {
          return JSON.parse(content);
        } catch {}
      }
    }
  } catch (err) {
    console.error(`Failed to load dictionary for locale ${locale}:`, err);
  }
  return {};
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return constructMetadata({
    title: "SoufTools — Global Multilingual Intelligent AI Platform",
    description: "Next-generation AI platform featuring multi-model AI chat, text-to-image generator, photo inpainting editor, grounded web search, and sandboxed AI coding agent.",
    path: "/",
    locale: locale,
    image: "/og-image.png",
  });
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale);
  const dictionary = loadMessageDictionary(locale);

  return (
    <I18nProvider initialLocale={locale} initialDictionary={dictionary}>
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] selection:bg-[#00d4aa]/30 selection:text-[#00d4aa]">
        <AnimatedLayout>{children}</AnimatedLayout>
      </div>
    </I18nProvider>
  );
}
