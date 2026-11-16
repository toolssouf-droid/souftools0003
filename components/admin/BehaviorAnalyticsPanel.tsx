"use client";

import React, { useState, useEffect } from "react";
import { Activity, ShieldCheck, Cpu, BarChart3, Layers, CheckCircle2, RefreshCw } from "lucide-react";

export function BehaviorAnalyticsPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchBehaviorStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/behavior-stats");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn("Failed to fetch behavior analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBehaviorStats();
  }, []);

  if (loading && !data) {
    return (
      <div className="glass-card p-8 sm:p-10 rounded-2xl border border-[#1e2e2e] text-center space-y-4 my-4 sm:my-6 flex flex-col items-center justify-center">
        <RefreshCw className="w-7 h-7 text-[#00d4aa] animate-spin" />
        <p className="text-xs font-bold text-[#e8f5f5]">جاري تحميل إحصائيات السلوك من قاعدة بيانات PostgreSQL...</p>
      </div>
    );
  }

  const stats = data || {
    activeProfilesCount: 0,
    totalSessions: 0,
    totalCompletedTasks: 0,
    avgCompletionRate: 100,
    toolDistribution: [],
    topWorkflows: [],
    localFirstSavingQuota: "100% استقلالية عبر محرك PostgreSQL والتخزين الخاص",
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
      {/* Header Banner */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#00d4aa]/30 bg-gradient-to-r from-[#00d4aa]/10 to-[#0ea5e9]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00d4aa] shrink-0" />
            <h3 className="text-sm sm:text-base font-extrabold text-[#e8f5f5]">
              لوحة تحليل أنماط السلوك المجمعة (SoufBehavior Analytics)
            </h3>
          </div>
          <p className="text-xs text-[#88b0b0]">
            إحصائيات حقيقية مستخرجة مباشرة من سجلات قاعدة بيانات PostgreSQL المحلية.
          </p>
        </div>

        <button
          onClick={fetchBehaviorStats}
          className="px-3.5 py-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa] text-xs font-bold text-[#00d4aa] flex items-center gap-1.5 cursor-pointer shrink-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] space-y-1">
          <span className="text-xs text-[#4a7070] font-medium">المستخدمون المتفاعلون</span>
          <h3 className="text-xl sm:text-2xl font-bold text-[#e8f5f5] font-mono">{stats.activeProfilesCount}</h3>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] space-y-1">
          <span className="text-xs text-[#4a7070] font-medium">إجمالي الجلسات</span>
          <h3 className="text-xl sm:text-2xl font-bold text-[#00d4aa] font-mono">{stats.totalSessions}</h3>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] space-y-1">
          <span className="text-xs text-[#4a7070] font-medium">المهمات الناجحة</span>
          <h3 className="text-xl sm:text-2xl font-bold text-[#0ea5e9] font-mono">{stats.totalCompletedTasks}</h3>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] space-y-1">
          <span className="text-xs text-[#4a7070] font-medium">كفاءة البنية التحتية</span>
          <h3 className="text-xs font-bold text-[#00ff88] truncate font-mono">{stats.localFirstSavingQuota}</h3>
        </div>
      </div>

      {/* Tool Distribution Bar Charts */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h4 className="text-sm font-bold text-[#e8f5f5]">توزيع استخدام الأدوات الحقيقي (Tool Distribution)</h4>
        {stats.toolDistribution && stats.toolDistribution.length > 0 ? (
          <div className="space-y-3">
            {stats.toolDistribution.map((tool: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#88b0b0] truncate">{tool.name}</span>
                  <span className="font-mono text-[#e8f5f5] shrink-0">{tool.count} طلب ({tool.percentage}%)</span>
                </div>
                <div className="w-full bg-[#111a1a] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#00d4aa] h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(2, tool.percentage))}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#88b0b0]">
            لا توجد استدعاءات أدوات مسجلة في النطاق الزمني المحدد.
          </div>
        )}
      </div>
    </div>
  );
}

