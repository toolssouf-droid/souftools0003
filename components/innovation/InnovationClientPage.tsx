"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Compass,
  MapPin,
  Sparkles,
  Layers,
  Activity,
  Server,
  Zap,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

interface InnovationClientPageProps {
  locale: string;
}

export function InnovationClientPage({ locale }: InnovationClientPageProps) {
  const isRtl = isRtlLocale(locale);
  const [selectedNode, setSelectedNode] = useState("meknes");

  const nodes = [
    {
      id: "meknes",
      name: isRtl ? "عقدة مكناس (Meknes Core Node)" : "Meknes Core Node",
      projectsCount: 42,
      developers: 180,
      activeModels: 5,
      status: "Online • 99.9%",
      desc: isRtl
        ? "حاضنة التقنيات الزراعية الذكية ومشاريع تحليل البيانات المكانية وسلاسل الإمداد."
        : "Hub for AgriTech AI, spatial analytics, and supply chain telemetry.",
    },
    {
      id: "fez",
      name: isRtl ? "عقدة فاس (Fez Tech Node)" : "Fez Tech Node",
      projectsCount: 38,
      developers: 154,
      activeModels: 5,
      status: "Online • 99.8%",
      desc: isRtl
        ? "مركز المعالجة اللغوية للغات التراثية وحلول الرقمنة السياحية والتعليمية."
        : "Heritage NLP, cultural digitization, and EdTech pipelines.",
    },
    {
      id: "ifrane",
      name: isRtl ? "عقدة إفران (Ifrane Research Node)" : "Ifrane Research Node",
      projectsCount: 24,
      developers: 96,
      activeModels: 5,
      status: "Online • 100%",
      desc: isRtl
        ? "أبحاث الذكاء الاصطناعي الأكاديمية ونماذج التنبؤ المناخي وحماية البيئة."
        : "Academic AI research, climate prediction, and ecological modeling.",
    },
  ];

  const currentNode = nodes.find((n) => n.id === selectedNode) || nodes[0];

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30">
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "خريطة تدفق الذكاء والابتكار الإقليمي" : "Fez-Meknes Regional Intelligence Grid"}
        subtitle={isRtl ? "استكشف العقد التقنية وحاضنات المشاريع النشطة" : "Real-time telemetry of regional AI innovation nodes"}
        icon={<Compass className="w-4 h-4 text-[#0ea5e9]" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="innovation"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#0ea5e9] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "جهة فاس-مكناس (Fez-Meknes Region)" : "Regional Intelligence Grid"}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#e8f5f5]">
            {isRtl ? "خريطة تدفق الذكاء والابتكار الإقليمي" : "Fez-Meknes Intelligence Flow Map"}
          </h1>
          <p className="text-xs sm:text-sm text-[#88b0b0]">
            {isRtl
              ? "استكشف العقد التقنية وحاضنات المشاريع النشطة عبر الأقاليم في الوقت الفعلي."
              : "Real-time topology of regional computing nodes, innovation centers, and developers."}
          </p>
        </div>

        {/* MAP & NODE SELECTOR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* NODES LIST */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#4a7070] uppercase">
              {isRtl ? "العقد الإقليمية النشطة" : "Active Regional Nodes"}
            </h3>
            {nodes.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedNode(n.id)}
                className={`w-full p-4 rounded-2xl border text-right transition-all flex flex-col gap-2 cursor-pointer ${
                  selectedNode === n.id
                    ? "bg-[#111a1a] border-[#0ea5e9] shadow-lg shadow-[#0ea5e9]/15"
                    : "bg-[#0d1414] border-[#1e2e2e] hover:border-[#4a7070]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#e8f5f5]">{n.name}</span>
                  <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#88b0b0]">
                  <span>{n.projectsCount} مشروع</span>
                  <span>•</span>
                  <span>{n.developers} مطور</span>
                </div>
              </button>
            ))}
          </div>

          {/* NODE DETAILS INSPECTOR */}
          <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-[#0ea5e9]/30 bg-[#0d1414] shadow-2xl flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e2e2e] pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#0ea5e9]" />
                  <h2 className="text-base font-bold text-[#e8f5f5]">{currentNode.name}</h2>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30">
                  {currentNode.status}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#88b0b0] leading-relaxed">
                {currentNode.desc}
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] text-center">
                  <div className="text-lg font-black text-[#00d4aa] font-mono">{currentNode.projectsCount}</div>
                  <div className="text-[10px] text-[#4a7070] font-bold">{isRtl ? "مشاريع نشطة" : "Active Projects"}</div>
                </div>
                <div className="p-3 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] text-center">
                  <div className="text-lg font-black text-[#0ea5e9] font-mono">{currentNode.developers}</div>
                  <div className="text-[10px] text-[#4a7070] font-bold">{isRtl ? "مطورو العقدة" : "Active Devs"}</div>
                </div>
                <div className="p-3 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] text-center">
                  <div className="text-lg font-black text-[#00ff88] font-mono">100%</div>
                  <div className="text-[10px] text-[#4a7070] font-bold">{isRtl ? "جاهزية الاتصال" : "Readiness"}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1e2e2e]">
              <span className="text-xs text-[#4a7070]">SoufTools Regional Grid v2.4</span>
              <Link
                href={`/${locale}/community`}
                className="px-4 py-2 rounded-xl bg-[#0ea5e9] text-white text-xs font-bold hover:bg-[#38bdf8] transition-colors"
              >
                {isRtl ? "انضم لهذه العقدة" : "Connect to Node"}
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1e2e2e] bg-[#080d0d] py-6 px-4 text-center text-xs text-[#4a7070]">
        SoufTools Platform © 2026. All rights reserved.
      </footer>
    </div>
  );
}
