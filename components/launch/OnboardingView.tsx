"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  Code,
  Bot,
  Palette,
  FileText,
  BarChart3,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Sliders,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { SoufBehaviorEngine } from "@/lib/behavior/behaviorEngine";
import { PreferredEntryMode } from "@/lib/behavior/types";
import { isRtlLocale } from "@/lib/i18n";

interface OnboardingViewProps {
  locale: string;
  onComplete: () => void;
  userEmail?: string | null;
}

interface IntentOption {
  key: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: React.ElementType;
  accent: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    key: "webSearch",
    titleAr: "البحث والاستقصاء الحي",
    titleEn: "Live Web Research & Investigation",
    descAr: "استخراج المعلومات والملخصات مع التوثيق المباشر للمصادر",
    descEn: "Grounded live web search, citations, and multi-source synthesis",
    icon: Search,
    accent: "#00d4aa",
  },
  {
    key: "coding",
    titleAr: "البرمجة وبناء التطبيقات",
    titleEn: "Coding & Full-Stack Apps",
    descAr: "كتابة الأكواد، إنشاء واجهات React، والمعاينة الحية الفورية",
    descEn: "Write components, debug architectures, and preview sandboxed code",
    icon: Code,
    accent: "#00ff88",
  },
  {
    key: "agentMode",
    titleAr: "وكلاء المهام الذاتية",
    titleEn: "Autonomous Task Agents",
    descAr: "تنفيذ مهام معقدة متعددة الخطوات والتفكير الاستراتيجي",
    descEn: "Multi-step reasoning, goal decomposition, and auto-execution",
    icon: Bot,
    accent: "#38bdf8",
  },
  {
    key: "imageGeneration",
    titleAr: "استوديو الصور والرؤية",
    titleEn: "Image Studio & Vision AI",
    descAr: "توليد صور واقعية فائقة الدقة، والتعديل البصري الذكي",
    descEn: "Ultra-res image synthesis, prompt design, and visual inpainting",
    icon: Palette,
    accent: "#f43f5e",
  },
  {
    key: "files",
    titleAr: "تحليل المستندات والملفات",
    titleEn: "Document & PDF Intelligence",
    descAr: "استخراج الجداول والنقاط الرئيسية والتحليل المعمق للتقارير",
    descEn: "Extract highlights, synthesize PDFs, and inspect structured reports",
    icon: FileText,
    accent: "#eab308",
  },
  {
    key: "dataAnalytics",
    titleAr: "تحليل وهندسة البيانات",
    titleEn: "Data Analytics & Calculations",
    descAr: "معالجة ملفات CSV، تحليل المعادلات الرياضية، واستخلاص الرؤى",
    descEn: "Parse tabular metrics, calculate complex queries, and visualize trends",
    icon: BarChart3,
    accent: "#a855f7",
  },
];

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  locale,
  onComplete,
  userEmail,
}) => {
  const isRtl = isRtlLocale(locale);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["webSearch", "coding"]);
  const [preferredEntry, setPreferredEntry] = useState<PreferredEntryMode>("launch");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleKey = (key: string) => {
    if (selectedKeys.includes(key)) {
      if (selectedKeys.length > 1) {
        setSelectedKeys(selectedKeys.filter((k) => k !== key));
      }
    } else {
      setSelectedKeys([...selectedKeys, key]);
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    await SoufBehaviorEngine.completeOnboarding(selectedKeys, preferredEntry);
    setIsSubmitting(false);
    onComplete();
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-8"
      >
        {/* Header Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-xs font-semibold text-[#00d4aa]">
            <Sparkles className="w-4 h-4" />
            <span>
              {isRtl ? "تخصيص مساحة العمل الذكية" : "Personalize Your AI Workspace"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#e8f5f5] tracking-tight">
            {isRtl
              ? userEmail
                ? `مرحبًا بك يا ${userEmail.split("@")[0]}! ما الذي ترغب في إنجازه عبر SoufTools؟`
                : "مرحبًا بك في SoufTools! ما الذي ترغب في إنجازه؟"
              : userEmail
              ? `Welcome ${userEmail.split("@")[0]}! What do you plan to build with SoufTools?`
              : "Welcome to SoufTools! What do you plan to achieve?"}
          </h1>

          <p className="text-sm text-[#8aa5a5] max-w-xl mx-auto leading-relaxed">
            {isRtl
              ? "حدد مجالات اهتمامك الرئيسية لتخصيص واجهة الإطلاق، وترتيب أدواتك الذكية، وتقديم مقترحات استباقية تناسب أسلوب عملك."
              : "Select your primary workflows. SoufAI will personalize your launchpad, sort core tools, and craft tailored suggestions."}
          </p>
        </div>

        {/* Intent Cards Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTENT_OPTIONS.map((item) => {
            const isSelected = selectedKeys.includes(item.key);
            const Icon = item.icon;

            return (
              <motion.button
                key={item.key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleKey(item.key)}
                className={`relative p-5 rounded-2xl border text-right transition-all flex flex-col justify-between text-start group cursor-pointer ${
                  isSelected
                    ? "bg-[#111a1a] border-[#00d4aa] shadow-[0_0_20px_rgba(0,212,170,0.15)] ring-1 ring-[#00d4aa]/50"
                    : "bg-[#0c1212]/80 border-[#1e2e2e] hover:border-[#2e4040] hover:bg-[#111a1a]/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: isSelected ? `${item.accent}20` : "#162020",
                        color: item.accent,
                        border: `1px solid ${isSelected ? item.accent : "#243232"}`,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-[#00d4aa] text-[#0a0f0f]"
                          : "border border-[#2e4040] text-transparent group-hover:border-[#4a6565]"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-[#e8f5f5] mb-1.5">
                    {isRtl ? item.titleAr : item.titleEn}
                  </h3>
                  <p className="text-xs text-[#7a9595] leading-relaxed">
                    {isRtl ? item.descAr : item.descEn}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1e2e2e] flex items-center justify-between text-[11px] text-[#4a7070]">
                  <span>{isSelected ? (isRtl ? "مُحدد" : "Selected") : (isRtl ? "انقر للإضافة" : "Click to add")}</span>
                  {isSelected && (
                    <span className="text-[#00d4aa] font-semibold">✓ {isRtl ? "مخصص" : "Active"}</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Start Preference & Privacy Notice */}
        <div className="p-5 rounded-2xl bg-[#0f1717] border border-[#1e2e2e] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88] flex-shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#e8f5f5] block">
                {isRtl ? "شاشة البداية المفضلة لديك" : "Your Preferred Start View"}
              </span>
              <span className="text-[11px] text-[#6a8585]">
                {isRtl
                  ? "يمكنك تغيير هذا الخيار لاحقاً في أي وقت من زر الإعدادات"
                  : "You can switch this anytime from personalization settings"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#080d0d] p-1 rounded-xl border border-[#1e2e2e] w-full sm:w-auto justify-center">
            <button
              onClick={() => setPreferredEntry("launch")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                preferredEntry === "launch"
                  ? "bg-[#00d4aa] text-[#0a0f0f] shadow"
                  : "text-[#6a8585] hover:text-[#e8f5f5]"
              }`}
            >
              🚀 {isRtl ? "شاشة الإطلاق الذكية" : "Launchpad"}
            </button>
            <button
              onClick={() => setPreferredEntry("chat")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                preferredEntry === "chat"
                  ? "bg-[#00d4aa] text-[#0a0f0f] shadow"
                  : "text-[#6a8585] hover:text-[#e8f5f5]"
              }`}
            >
              💬 {isRtl ? "المحادثة المباشرة" : "Direct Chat"}
            </button>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex items-center justify-center pt-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleFinish}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#00d4aa] to-[#00ff88] text-[#0a0f0f] font-extrabold text-sm flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(0,212,170,0.3)] hover:shadow-[0_0_35px_rgba(0,212,170,0.5)] transition-all cursor-pointer"
          >
            <span>{isRtl ? "متابعة إلى مساحة الإطلاق الذكية" : "Launch Personalized Workspace"}</span>
            {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
