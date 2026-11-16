"use client";

import React, { useState } from "react";
import {
  Users,
  UserPlus,
  UserCheck,
  TrendingUp,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Compass,
  Layers,
  Calendar,
  HardDrive,
  MessageSquare,
} from "lucide-react";
import { UsersMetrics } from "@/lib/analytics/types";

interface UsersTabProps {
  data: UsersMetrics | null;
  loading: boolean;
}

export const UsersTab: React.FC<UsersTabProps> = ({ data, loading }) => {
  const [searchTerm, setSearchTerm] = useState("");

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 rounded-2xl border border-[#1e2e2e] h-24 bg-[#111a1a]/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredUsers = data.recentActiveUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* 4 User Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>إجمالي المستخدمين</span>
            <Users className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.totalUsers.toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">حسابات مسجلة في PostgreSQL</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>المستخدمون النشطون (Active)</span>
            <UserCheck className="w-4 h-4 text-[#00ff88]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#00ff88] font-mono">{data.activeUsers.toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">
            معدل تفاعل {data.totalUsers > 0 ? Math.round((data.activeUsers / data.totalUsers) * 100) : 0}%
          </span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>مستخدمون جدد بالنطاق</span>
            <UserPlus className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{data.newUsers.toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">تسجيلات جديدة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>المعدلات الحيوية (DAU / MAU)</span>
            <TrendingUp className="w-4 h-4 text-[#a855f7]" />
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-xl font-bold text-[#e8f5f5]">DAU: {data.dau}</span>
            <span className="text-xs text-[#a855f7]">/ MAU: {data.mau}</span>
          </div>
          <span className="text-[11px] text-[#00ff88]">نسبة الالتصاق Stickiness: {Math.round((data.dau / Math.max(1, data.mau)) * 100)}%</span>
        </div>
      </div>

      {/* Retention & Cohorts Table */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#e8f5f5]">مصفوفة الاحتفاظ بالأفواج (User Retention Cohorts)</h3>
            <p className="text-xs text-[#88b0b0]">نسبة عودة المستخدمين بعد D1 و D7 و D30 يوماً من أول تفاعل.</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-[#00ff88]">D1 Avg: {data.retentionD1}%</span>
            <span className="text-[#0ea5e9]">D7 Avg: {data.retentionD7}%</span>
            <span className="text-[#a855f7]">D30 Avg: {data.retentionD30}%</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">فوج التسجيل (Cohort)</th>
                <th className="pb-3">الحجم</th>
                <th className="pb-3 text-center">اليوم الأول (D1)</th>
                <th className="pb-3 text-center">اليوم السابع (D7)</th>
                <th className="pb-3 text-center">اليوم الـ 30 (D30)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {data.cohorts.map((c, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5]">{c.cohortDate}</td>
                  <td className="py-3 text-[#88b0b0]">{c.cohortSize} مستخدم</td>
                  <td className="py-3 text-center">
                    <span
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold"
                      style={{
                        backgroundColor: `rgba(0, 212, 170, ${c.d1Retention / 100})`,
                        color: c.d1Retention > 60 ? "#0a0f0f" : "#e8f5f5",
                      }}
                    >
                      {c.d1Retention}%
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold"
                      style={{
                        backgroundColor: `rgba(14, 165, 233, ${c.d7Retention / 100})`,
                        color: c.d7Retention > 60 ? "#0a0f0f" : "#e8f5f5",
                      }}
                    >
                      {c.d7Retention}%
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold"
                      style={{
                        backgroundColor: `rgba(168, 85, 247, ${c.d30Retention / 100})`,
                        color: c.d30Retention > 60 ? "#0a0f0f" : "#e8f5f5",
                      }}
                    >
                      {c.d30Retention}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demographics & Devices (3 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Countries */}
        <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#e8f5f5]">
            <Globe className="w-4 h-4 text-[#00d4aa]" />
            <span>التوزيع الجغرافي (الدول)</span>
          </div>
          <div className="space-y-2 text-xs">
            {data.distributionByCountry.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-[#88b0b0]">
                  <span>{c.country}</span>
                  <span className="font-mono text-[#e8f5f5] font-bold">{c.percentage}%</span>
                </div>
                <div className="w-full bg-[#111a1a] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#00d4aa] h-full" style={{ width: `${c.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Devices */}
        <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#e8f5f5]">
            <Monitor className="w-4 h-4 text-[#0ea5e9]" />
            <span>نوع الجهاز والمنصة</span>
          </div>
          <div className="space-y-3 pt-2">
            {data.distributionByDevice.map((d, i) => {
              const DevIcon = d.device === "desktop" ? Monitor : d.device === "mobile" ? Smartphone : Tablet;
              return (
                <div key={i} className="flex items-center justify-between p-2.5 bg-[#111a1a] rounded-xl border border-[#1e2e2e]">
                  <div className="flex items-center gap-2">
                    <DevIcon className="w-4 h-4 text-[#0ea5e9]" />
                    <span className="text-xs text-[#e8f5f5] font-bold capitalize">
                      {d.device === "desktop" ? "أجهزة مكتبية (Desktop)" : d.device === "mobile" ? "هواتف ذكية (Mobile)" : "أجهزة لوحية (Tablet)"}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-[#00ff88]">{d.percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* OS & Browsers */}
        <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#e8f5f5]">
            <Compass className="w-4 h-4 text-[#a855f7]" />
            <span>المتصفحات وأنظمة التشغيل</span>
          </div>
          <div className="space-y-2 text-xs">
            {data.distributionByBrowser.map((b, i) => (
              <div key={i} className="flex justify-between items-center py-1 border-b border-[#1e2e2e]/50">
                <span className="text-[#88b0b0]">{b.browser}</span>
                <span className="font-mono text-[#e8f5f5] font-bold">{b.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Active Users List */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#e8f5f5]">أحدث المستخدمين المتفاعلين بالمنصة</h3>
            <p className="text-xs text-[#88b0b0]">استعلام حي من جدول `users` بدون إظهار أي كلمات مرور أو مفاتيح سرية.</p>
          </div>
          <input
            type="text"
            placeholder="بحث بالبريد أو الاسم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 bg-[#111a1a] text-xs text-[#e8f5f5] placeholder-[#4a7070] rounded-xl border border-[#1e2e2e] outline-none focus:border-[#00d4aa]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">المستخدم</th>
                <th className="pb-3">البريد الإلكتروني</th>
                <th className="pb-3">الجلسات</th>
                <th className="pb-3">الرسائل</th>
                <th className="pb-3">مساحة التخزين</th>
                <th className="pb-3">آخر نشاط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {filteredUsers.map((u, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5] flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#00d4aa]/20 border border-[#00d4aa]/40 flex items-center justify-center text-[10px] text-[#00d4aa] font-bold">
                      {(u.name || u.email)[0].toUpperCase()}
                    </div>
                    <span>{u.name || "مستخدم SoufTools"}</span>
                  </td>
                  <td className="py-3 text-[#88b0b0]">{u.email}</td>
                  <td className="py-3 text-[#38bdf8] font-bold">{u.sessionsCount}</td>
                  <td className="py-3 text-[#00ff88] font-bold">{u.messagesCount}</td>
                  <td className="py-3 text-[#e8f5f5]">{u.storageUsedMb} MB</td>
                  <td className="py-3 text-[#4a7070] text-[11px]">
                    {new Date(u.lastActiveAt).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
