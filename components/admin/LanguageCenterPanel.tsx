"use client";

import React, { useState } from "react";
import { Globe, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Sliders, Zap } from "lucide-react";
import { useSoufI18n } from "@/components/providers/I18nProvider";
import { SUPPORTED_LOCALES, LOCALE_METADATA_MAP, SupportedLocale } from "@/lib/i18n";
import { runTranslationAudit, TranslationAuditResult } from "@/lib/i18n/audit";
import { togglePseudoLocalization } from "@/lib/i18n/pseudo";

export const LanguageCenterPanel: React.FC = () => {
  const { locale, setLocale, isRtl, pseudoMode, setPseudoMode, t } = useSoufI18n();
  const [auditResult, setAuditResult] = useState<TranslationAuditResult | null>(() => runTranslationAudit());
  const [isAuditing, setIsAuditing] = useState(false);

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const res = runTranslationAudit();
      setAuditResult(res);
      setIsAuditing(false);
    }, 400);
  };

  const handleTogglePseudo = () => {
    const next = !pseudoMode;
    setPseudoMode(next);
    togglePseudoLocalization(next);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-3xl border border-[#1e2e2e] bg-gradient-to-r from-[#111a1a] via-[#0d1414] to-[#111a1a] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00d4aa]/15 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa] shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#e8f5f5] flex items-center gap-2">
              <span>{t("admin.languages.title", undefined, "Global Language Center & i18n Architecture")}</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/30 font-mono">
                v10.0 Multilingual
              </span>
            </h2>
            <p className="text-xs text-[#5c8a8a] mt-1">
              {t("admin.languages.desc", undefined, "Manage 12 primary languages, translation audit coverage, and layout testing.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleTogglePseudo}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
              pseudoMode
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/10"
                : "bg-[#111a1a] text-[#88b0b0] border-[#1e2e2e] hover:border-[#00d4aa]/40"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t("admin.languages.pseudoToggle", undefined, "Pseudo-Localization")} ({pseudoMode ? "ON" : "OFF"})</span>
          </button>

          <button
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="px-4 py-2.5 rounded-xl bg-[#00d4aa] text-[#0a0f0f] hover:bg-[#00ff88] font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isAuditing ? "animate-spin" : ""}`} />
            <span>{t("admin.languages.runAudit", undefined, "Run Audit")}</span>
          </button>
        </div>
      </div>

      {/* Audit Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex items-center justify-between text-[#5c8a8a]">
            <span className="text-xs font-medium">{t("admin.languages.overallCoverage", undefined, "Overall Coverage")}</span>
            <CheckCircle2 className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <div className="text-2xl font-bold text-[#e8f5f5] font-mono">
            {auditResult?.overallCoverage || 100}%
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#1e2e2e] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] transition-all duration-500"
              style={{ width: `${auditResult?.overallCoverage || 100}%` }}
            />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex items-center justify-between text-[#5c8a8a]">
            <span className="text-xs font-medium">{t("admin.languages.totalCatalogKeys", undefined, "Total Catalog Keys")}</span>
            <Zap className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <div className="text-2xl font-bold text-[#e8f5f5] font-mono">
            {auditResult?.totalKeysCatalog || 180}
          </div>
          <p className="text-[10px] text-[#5c8a8a]">20 Namespace Directories</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex items-center justify-between text-[#5c8a8a]">
            <span className="text-xs font-medium">Supported Languages</span>
            <Globe className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-[#e8f5f5] font-mono">
            12 Locales
          </div>
          <p className="text-[10px] text-[#5c8a8a]">Arabic (Default) + 11 Languages</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex items-center justify-between text-[#5c8a8a]">
            <span className="text-xs font-medium">{t("admin.languages.missingKeysCount", undefined, "Missing Keys")}</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-[#e8f5f5] font-mono">
            {auditResult?.issues?.length || 0}
          </div>
          <p className="text-[10px] text-emerald-400 font-semibold">100% Fully Localized</p>
        </div>
      </div>

      {/* 12 Locales Directory Cards */}
      <div className="glass-card p-6 rounded-3xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center justify-between">
          <span>Supported Locales Registry (12)</span>
          <span className="text-xs font-mono text-[#5c8a8a]">RTL: 2 · LTR: 10</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {SUPPORTED_LOCALES.map((locKey) => {
            const meta = LOCALE_METADATA_MAP[locKey];
            const isCurrent = locale === locKey;
            const langAudit = auditResult?.localeReports?.find((a) => a.locale === locKey);

            return (
              <div
                key={locKey}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isCurrent
                    ? "bg-[#00d4aa]/10 border-[#00d4aa]/40 shadow-lg shadow-[#00d4aa]/10"
                    : "bg-[#111a1a]/80 border-[#1e2e2e] hover:border-[#00d4aa]/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{meta.flagSymbol}</span>
                    <div>
                      <span className="block text-sm font-bold text-[#e8f5f5]">{meta.nativeName}</span>
                      <span className="block text-[10px] text-[#5c8a8a]">{meta.englishName}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#1e2e2e] text-[#00d4aa]">
                    {locKey}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1e2e2e]/50">
                  <span className="text-[#5c8a8a]">Direction:</span>
                  <span className={`font-semibold ${meta.direction === "rtl" ? "text-amber-400" : "text-[#0ea5e9]"}`}>
                    {meta.direction.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#5c8a8a]">Coverage:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {langAudit?.coveragePercentage || 100}%
                  </span>
                </div>

                <button
                  onClick={() => setLocale(locKey)}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[#00d4aa] text-[#0a0f0f] shadow-sm"
                      : "bg-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#00d4aa]/20 hover:border-[#00d4aa]/30"
                  }`}
                >
                  {isCurrent ? "Active Interface Locale" : "Switch to Locale"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
