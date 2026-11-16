"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart3,
  Users,
  Bot,
  Wrench,
  Search,
  Image as ImageIcon,
  Code,
  Server,
  ShieldCheck,
  HardDrive,
  Compass,
  Coins,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AnalyticsHeader } from "./AnalyticsHeader";
import { LiveMonitorBar } from "./LiveMonitorBar";
import { OverviewTab } from "./tabs/OverviewTab";
import { UsersTab } from "./tabs/UsersTab";
import { AiTab } from "./tabs/AiTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { ResearchTab } from "./tabs/ResearchTab";
import { ImagesTab } from "./tabs/ImagesTab";
import { SandboxTab } from "./tabs/SandboxTab";
import { InfrastructureTab } from "./tabs/InfrastructureTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { StorageTab } from "./tabs/StorageTab";
import { BehaviorTab } from "./tabs/BehaviorTab";
import { UsageTab } from "./tabs/UsageTab";

import {
  AnalyticsTimeRange,
  OverviewMetrics,
  UsersMetrics,
  SoufAIMetrics,
  ToolsMetrics,
  WebResearchMetrics,
  ImageVisionMetrics,
  CodingSandboxMetrics,
  InfrastructureMetrics,
  SecurityMetrics,
  StorageMetrics,
  ProductBehaviorMetrics,
  ModelApiUsageMetrics,
} from "@/lib/analytics/types";

export const AnalyticsCenter: React.FC = () => {
  // Navigation & Range State
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("7d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [comparePrevious, setComparePrevious] = useState<boolean>(true);

  // Loading & Data States for each module
  const [loading, setLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Cached data objects
  const [overviewData, setOverviewData] = useState<OverviewMetrics | null>(null);
  const [usersData, setUsersData] = useState<UsersMetrics | null>(null);
  const [aiData, setAiData] = useState<SoufAIMetrics | null>(null);
  const [toolsData, setToolsData] = useState<ToolsMetrics | null>(null);
  const [researchData, setResearchData] = useState<WebResearchMetrics | null>(null);
  const [imagesData, setImagesData] = useState<ImageVisionMetrics | null>(null);
  const [sandboxData, setSandboxData] = useState<CodingSandboxMetrics | null>(null);
  const [infraData, setInfraData] = useState<InfrastructureMetrics | null>(null);
  const [securityData, setSecurityData] = useState<SecurityMetrics | null>(null);
  const [storageData, setStorageData] = useState<StorageMetrics | null>(null);
  const [behaviorData, setBehaviorData] = useState<ProductBehaviorMetrics | null>(null);
  const [usageData, setUsageData] = useState<ModelApiUsageMetrics | null>(null);

  const buildQuery = useCallback(() => {
    let q = `?range=${timeRange}`;
    if (timeRange === "custom") {
      if (customStartDate) q += `&startDate=${customStartDate}`;
      if (customEndDate) q += `&endDate=${customEndDate}`;
    }
    return q;
  }, [timeRange, customStartDate, customEndDate]);

  // Fetch current active tab data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = buildQuery();

    try {
      if (activeTab === "overview") {
        const res = await fetch(`/api/v1/admin/analytics/overview${query}`);
        const json = await res.json();
        if (json.success) setOverviewData(json.data);
      } else if (activeTab === "users") {
        const res = await fetch(`/api/v1/admin/analytics/users${query}`);
        const json = await res.json();
        if (json.success) setUsersData(json.data);
      } else if (activeTab === "ai") {
        const res = await fetch(`/api/v1/admin/analytics/ai${query}`);
        const json = await res.json();
        if (json.success) setAiData(json.data);
      } else if (activeTab === "tools") {
        const res = await fetch(`/api/v1/admin/analytics/tools${query}`);
        const json = await res.json();
        if (json.success) setToolsData(json.data);
      } else if (activeTab === "research") {
        const res = await fetch(`/api/v1/admin/analytics/research${query}`);
        const json = await res.json();
        if (json.success) setResearchData(json.data);
      } else if (activeTab === "images") {
        const res = await fetch(`/api/v1/admin/analytics/images${query}`);
        const json = await res.json();
        if (json.success) setImagesData(json.data);
      } else if (activeTab === "sandbox") {
        const res = await fetch(`/api/v1/admin/analytics/coding${query}`);
        const json = await res.json();
        if (json.success) setSandboxData(json.data);
      } else if (activeTab === "infra") {
        const res = await fetch(`/api/v1/admin/analytics/infrastructure`);
        const json = await res.json();
        if (json.success) setInfraData(json.data);
      } else if (activeTab === "security") {
        const res = await fetch(`/api/v1/admin/analytics/security${query}`);
        const json = await res.json();
        if (json.success) setSecurityData(json.data);
      } else if (activeTab === "storage") {
        const res = await fetch(`/api/v1/admin/analytics/storage`);
        const json = await res.json();
        if (json.success) setStorageData(json.data);
      } else if (activeTab === "behavior") {
        const res = await fetch(`/api/v1/admin/analytics/behavior${query}`);
        const json = await res.json();
        if (json.success) setBehaviorData(json.data);
      } else if (activeTab === "usage") {
        const res = await fetch(`/api/v1/admin/analytics/usage${query}`);
        const json = await res.json();
        if (json.success) setUsageData(json.data);
      }
    } catch (err: any) {
      setError(err.message || "فشل تحميل البيانات من الخادم");
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export handler
  const handleExport = async (format: "csv" | "json") => {
    setIsExporting(true);
    try {
      const query = buildQuery();
      const exportUrl = `/api/v1/admin/analytics/export${query}&module=${activeTab}&format=${format}`;
      window.location.href = exportUrl;
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setTimeout(() => setIsExporting(false), 1500);
    }
  };

  const navTabs = [
    { id: "overview", label: "نظرة عامة", icon: BarChart3 },
    { id: "users", label: "المستخدمون والنمو", icon: Users },
    { id: "ai", label: "محرك SoufAI", icon: Bot },
    { id: "tools", label: "الأدوات والتكاملات", icon: Wrench },
    { id: "research", label: "البحث في الويب", icon: Search },
    { id: "images", label: "الصور والرؤية", icon: ImageIcon },
    { id: "sandbox", label: "بيئة البرمجة", icon: Code },
    { id: "infra", label: "البنية التحتية والـ DB", icon: Server },
    { id: "security", label: "الأمان وسجل التدقيق", icon: ShieldCheck },
    { id: "storage", label: "التخزين الخاص", icon: HardDrive },
    { id: "behavior", label: "السلوك والتحويل", icon: Compass },
    { id: "usage", label: "الرموز والتكلفة", icon: Coins },
  ];

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsScrollRef.current) {
      const offset = direction === "left" ? -200 : 200;
      tabsScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in w-full max-w-full overflow-hidden" dir="rtl">
      {/* 1. Header with Filters & Controls */}
      <AnalyticsHeader
        activeTab={activeTab}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        comparePrevious={comparePrevious}
        setComparePrevious={setComparePrevious}
        loading={loading}
        onRefresh={fetchData}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* 2. Live Monitoring Bar (Heartbeat) */}
      <LiveMonitorBar />

      {/* 3. Horizontal Navigation Tabs (12 Modules) with mobile touch scroll */}
      <div className="relative w-full">
        <div
          ref={tabsScrollRef}
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scroll-smooth no-scrollbar touch-pan-x border-b border-[#1e2e2e] w-full"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 select-none ${
                  isActive
                    ? "bg-[#00d4aa] text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/20 font-extrabold"
                    : "bg-[#111a1a] text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#1e2e2e] border border-[#1e2e2e]/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Error Message Banner if any */}
      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer self-end sm:self-auto"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* 5. Dynamic Module Content Rendering */}
      <div className="min-h-[400px] w-full max-w-full overflow-hidden">
        {activeTab === "overview" && (
          <OverviewTab data={overviewData} loading={loading} comparePrevious={comparePrevious} />
        )}
        {activeTab === "users" && <UsersTab data={usersData} loading={loading} />}
        {activeTab === "ai" && <AiTab data={aiData} loading={loading} />}
        {activeTab === "tools" && <ToolsTab data={toolsData} loading={loading} />}
        {activeTab === "research" && <ResearchTab data={researchData} loading={loading} />}
        {activeTab === "images" && <ImagesTab data={imagesData} loading={loading} />}
        {activeTab === "sandbox" && <SandboxTab data={sandboxData} loading={loading} />}
        {activeTab === "infra" && <InfrastructureTab data={infraData} loading={loading} />}
        {activeTab === "security" && <SecurityTab data={securityData} loading={loading} />}
        {activeTab === "storage" && <StorageTab data={storageData} loading={loading} />}
        {activeTab === "behavior" && <BehaviorTab data={behaviorData} loading={loading} />}
        {activeTab === "usage" && <UsageTab data={usageData} loading={loading} />}
      </div>
    </div>
  );
};

