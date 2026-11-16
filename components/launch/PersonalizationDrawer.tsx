"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Shield,
  Sliders,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  Cpu,
  Sparkles,
  Lock,
  Globe,
  Zap,
} from "lucide-react";
import { SoufBehaviorEngine } from "@/lib/behavior/behaviorEngine";
import { UserBehaviorProfile, BehaviorPrivacyMode, PreferredEntryMode } from "@/lib/behavior/types";
import { isRtlLocale } from "@/lib/i18n";

interface PersonalizationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  onResetOnboarding?: () => void;
}

export const PersonalizationDrawer: React.FC<PersonalizationDrawerProps> = ({
  isOpen,
  onClose,
  locale,
  onResetOnboarding,
}) => {
  const isRtl = isRtlLocale(locale);
  const [profile, setProfile] = useState<UserBehaviorProfile>(SoufBehaviorEngine.getProfile());
  const [isSaving, setIsSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteCloud, setConfirmDeleteCloud] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = SoufBehaviorEngine.subscribe((updated) => {
      setProfile(updated);
    });
    return () => unsub();
  }, []);

  const handlePrivacyChange = async (mode: BehaviorPrivacyMode) => {
    setIsSaving(true);
    await SoufBehaviorEngine.setPrivacyMode(mode);
    setIsSaving(false);
    showNotice(
      isRtl
        ? `تم تعيين وضع الخصوصية إلى: ${mode === "personalized" ? "مخصص بالكامل" : mode === "basic" ? "أساسي" : "معطل"}`
        : `Privacy mode set to: ${mode}`
    );
  };

  const handlePreferredEntryChange = async (entry: PreferredEntryMode) => {
    setIsSaving(true);
    await SoufBehaviorEngine.setPreferredEntry(entry);
    setIsSaving(false);
    showNotice(
      isRtl
        ? `تم ضبط وجهة البداية إلى: ${entry === "launch" ? "شاشة الإطلاق الذكية" : "المحادثة المباشرة"}`
        : `Default start screen set to: ${entry === "launch" ? "Smart Launch Screen" : "Direct Chat"}`
    );
  };

  const handleClearLocalData = async () => {
    setIsSaving(true);
    await SoufBehaviorEngine.clearLocalData();
    setConfirmClear(false);
    setIsSaving(false);
    showNotice(isRtl ? "تم مسح البيانات المحلية بنجاح" : "Local behavior data wiped");
  };

  const handleDeleteCloudData = async () => {
    setIsSaving(true);
    await SoufBehaviorEngine.deleteCloudProfile();
    setConfirmDeleteCloud(false);
    setIsSaving(false);
    showNotice(isRtl ? "تم حذف الملف السلوكي من السحابة ومحلياً" : "Cloud behavior profile permanently deleted");
  };

  const handleTriggerResetOnboarding = async () => {
    setIsSaving(true);
    await SoufBehaviorEngine.resetOnboarding();
    setIsSaving(false);
    if (onResetOnboarding) onResetOnboarding();
    onClose();
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-2xl bg-[#0e1616] border border-[#1e2e2e] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#1e2e2e] flex items-center justify-between bg-[#111a1a]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa]">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
                  {isRtl ? "إعدادات وتفضيلات مساحة العمل" : "Workspace & Interface Preferences"}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 font-mono">
                    Enhanced
                  </span>
                </h3>
                <p className="text-xs text-[#6a9090]">
                  {isRtl
                    ? "تخصيص الخيارات ونمط الواجهة وتسهيل الوصول وفق رغبتك التامة"
                    : "Customize interface preferences, start screen, and layout choices"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#6a9090] hover:text-[#e8f5f5] hover:bg-[#1e2e2e] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Notice Banner */}
          {notice && (
            <div className="bg-[#00d4aa]/15 border-b border-[#00d4aa]/30 px-6 py-2.5 text-xs text-[#00d4aa] font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#e8f5f5]/90">
            {/* 1. Mode Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6a9090] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#00d4aa]" />
                {isRtl ? "نمط العرض والاقتراحات الذكية" : "Workspace Optimization Mode"}
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Personalized */}
                <button
                  onClick={() => handlePrivacyChange("personalized")}
                  className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    profile.privacyMode === "personalized"
                      ? "bg-[#00d4aa]/10 border-[#00d4aa] text-[#e8f5f5] shadow-[0_0_15px_rgba(0,212,170,0.15)]"
                      : "bg-[#111a1a] border-[#1e2e2e] text-[#6a9090] hover:border-[#2a3e3e]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-[#e8f5f5]">
                      {isRtl ? "مُحسن تلقائياً" : "Smart Optimized"}
                    </span>
                    <Sparkles className="w-4 h-4 text-[#00d4aa]" />
                  </div>
                  <p className="text-[11px] text-[#6a9090] leading-relaxed">
                    {isRtl
                      ? "ترتيب الاختصارات وتسهيل الوصول للأدوات الشائعة تلقائياً."
                      : "Auto-prioritize workflows and fast access to top tools."}
                  </p>
                </button>

                {/* Basic */}
                <button
                  onClick={() => handlePrivacyChange("basic")}
                  className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    profile.privacyMode === "basic"
                      ? "bg-[#00d4aa]/10 border-[#00d4aa] text-[#e8f5f5]"
                      : "bg-[#111a1a] border-[#1e2e2e] text-[#6a9090] hover:border-[#2a3e3e]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-[#e8f5f5]">
                      {isRtl ? "قياسي" : "Standard"}
                    </span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-[#6a9090] leading-relaxed">
                    {isRtl
                      ? "عرض الواجهة التوافقية العامة والتفضيلات الأساسية."
                      : "Standard view layout with basic preferences."}
                  </p>
                </button>

                {/* Off */}
                <button
                  onClick={() => handlePrivacyChange("off")}
                  className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    profile.privacyMode === "off"
                      ? "bg-red-500/10 border-red-500 text-[#e8f5f5]"
                      : "bg-[#111a1a] border-[#1e2e2e] text-[#6a9090] hover:border-[#2a3e3e]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-[#e8f5f5]">
                      {isRtl ? "بسيط" : "Minimal"}
                    </span>
                    <Lock className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-[11px] text-[#6a9090] leading-relaxed">
                    {isRtl
                      ? "عرض مبسط حيادي بدون اقتراحات تلقائية."
                      : "Clean neutral view without automated shortcuts."}
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Default Start Destination */}
            <div className="p-4 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6a9090] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#00d4aa]" />
                  {isRtl ? "شاشة البداية الافتراضية بعد تسجيل الدخول" : "Default Screen After Login"}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePreferredEntryChange("launch")}
                  className={`p-3 rounded-lg border text-xs font-medium transition-all text-center ${
                    profile.preferredEntry === "launch"
                      ? "bg-[#00d4aa]/15 border-[#00d4aa] text-[#00d4aa] font-bold"
                      : "bg-[#0a0f0f] border-[#1e2e2e] text-[#6a9090] hover:text-[#e8f5f5]"
                  }`}
                >
                  🚀 {isRtl ? "شاشة الإطلاق الذكية (موصى بها)" : "Smart Launch Screen (Recommended)"}
                </button>

                <button
                  onClick={() => handlePreferredEntryChange("chat")}
                  className={`p-3 rounded-lg border text-xs font-medium transition-all text-center ${
                    profile.preferredEntry === "chat"
                      ? "bg-[#00d4aa]/15 border-[#00d4aa] text-[#00d4aa] font-bold"
                      : "bg-[#0a0f0f] border-[#1e2e2e] text-[#6a9090] hover:text-[#e8f5f5]"
                  }`}
                >
                  💬 {isRtl ? "المحادثة المباشرة الفورية" : "Direct Instant Chat"}
                </button>
              </div>
            </div>

            {/* 3. Usage Preferences */}
            <div className="p-4 rounded-xl bg-[#111a1a] border border-[#1e2e2e] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6a9090] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#00ff88]" />
                  {isRtl ? "ملخص النشاط والاستخدام" : "Usage Activity Summary"}
                </span>
                <span className="text-[10px] text-[#4a7070] font-mono">
                  {profile.sessions} {isRtl ? "جلسات إجمالية" : "sessions"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-[#0a0f0f] border border-[#1e2e2e]">
                  <span className="block text-[#6a9090] text-[10px]">
                    {isRtl ? "بحث الويب" : "Web Search"}
                  </span>
                  <span className="text-sm font-bold text-[#e8f5f5]">
                    {profile.tools?.webSearch || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0a0f0f] border border-[#1e2e2e]">
                  <span className="block text-[#6a9090] text-[10px]">
                    {isRtl ? "البرمجة والتطبيقات" : "Coding Tasks"}
                  </span>
                  <span className="text-sm font-bold text-[#e8f5f5]">
                    {profile.tools?.coding || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0a0f0f] border border-[#1e2e2e]">
                  <span className="block text-[#6a9090] text-[10px]">
                    {isRtl ? "استوديو الصور" : "Image Studio"}
                  </span>
                  <span className="text-sm font-bold text-[#e8f5f5]">
                    {(profile.tools?.imageGeneration || 0) + (profile.tools?.imageEditing || 0)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0a0f0f] border border-[#1e2e2e]">
                  <span className="block text-[#6a9090] text-[10px]">
                    {isRtl ? "المهام المكتملة" : "Tasks Done"}
                  </span>
                  <span className="text-sm font-bold text-[#00ff88]">
                    {profile.completedTasks || 0}
                  </span>
                </div>
              </div>

              {profile.usagePatterns?.frequentTools?.length > 0 && (
                <div className="text-xs text-[#6a9090] flex items-center gap-2 pt-1">
                  <span>{isRtl ? "الأدوات الأكثر استخداماً لديك:" : "Most frequent tools:"}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {profile.usagePatterns.frequentTools.map((tool) => (
                      <span
                        key={tool}
                        className="px-2 py-0.5 rounded-md bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/25 text-[10px] font-mono"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Action Controls */}
            <div className="pt-2 border-t border-[#1e2e2e] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Reset Onboarding */}
                <button
                  onClick={handleTriggerResetOnboarding}
                  className="px-3.5 py-2 rounded-xl bg-[#111a1a] hover:bg-[#1e2e2e] text-[#e8f5f5] text-xs font-semibold flex items-center gap-2 border border-[#1e2e2e] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#00d4aa]" />
                  <span>{isRtl ? "إعادة تحديد الاهتمامات الرئيسية" : "Re-select Workflows"}</span>
                </button>

                {/* Clear Local Data */}
                {!confirmClear ? (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-2 border border-amber-500/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isRtl ? "مسح التخزين المؤقت" : "Clear Cache"}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-400 font-medium">
                      {isRtl ? "هل أنت متأكد؟" : "Confirm clear?"}
                    </span>
                    <button
                      onClick={handleClearLocalData}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold"
                    >
                      {isRtl ? "نعم، امسح" : "Yes, Clear"}
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1.5 text-xs text-[#6a9090] hover:text-white"
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
                    </button>
                  </div>
                )}
              </div>

              {/* Reset Default Preferences */}
              <div className="pt-2">
                {!confirmDeleteCloud ? (
                  <button
                    onClick={() => setConfirmDeleteCloud(true)}
                    className="text-[11px] text-red-400 hover:text-red-300 underline flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{isRtl ? "إعادة تعيين جميع السجلات والتفضيلات" : "Reset all saved preferences"}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
                    <span className="text-xs text-red-400">
                      {isRtl
                        ? "سيتم إعادة السجلات والتفضيلات إلى النمط الافتراضي الابتدائي."
                        : "All preferences will be reset to default factory settings."}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDeleteCloudData}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-bold"
                      >
                        {isRtl ? "تأكيد الإعادة" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteCloud(false)}
                        className="px-2 py-1 text-xs text-[#6a9090]"
                      >
                        {isRtl ? "إلغاء" : "Cancel"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-[#1e2e2e] bg-[#111a1a] flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#00d4aa] text-[#0a0f0f] text-xs font-bold hover:bg-[#00ff88] transition-colors"
            >
              {isRtl ? "تم وحفظ الإعدادات" : "Save & Close"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
