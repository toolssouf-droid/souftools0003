"use client";

/**
 * Cloud Sync Live Status Indicator Component
 * 
 * Shows real-time synchronization state with PostgreSQL backend:
 * - Green pulse: Cloud Synced (Source of truth active)
 * - Amber spin: Syncing deltas / Optimistic dispatch
 * - Red warning: Offline / Session disconnected
 * - Multi-device quick trigger modal
 */

import React, { useState } from "react";
import { Cloud, CloudOff, RefreshCw, Smartphone, Check, AlertTriangle } from "lucide-react";
import { useSyncClient } from "@/lib/sync/useSyncClient";
import { ActiveDevicesModal } from "@/components/user/ActiveDevicesModal";

export const CloudSyncIndicator: React.FC = () => {
  const { syncState, refreshSync } = useSyncClient();
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);

  const getStatusBadge = () => {
    switch (syncState.status) {
      case "connected":
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-emerald-400" />,
          label: "مزامنة سحابية نشطة",
          dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
          borderClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        };
      case "syncing":
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
          label: "جاري المزامنة...",
          dotClass: "bg-amber-500 animate-ping",
          borderClass: "border-amber-500/20 bg-amber-500/10 text-amber-300",
        };
      case "revoked":
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
          label: "تم إنهاء الجلسة",
          dotClass: "bg-red-500",
          borderClass: "border-red-500/20 bg-red-500/10 text-red-300",
        };
      case "disconnected":
      case "error":
      default:
        return {
          icon: <CloudOff className="w-3.5 h-3.5 text-zinc-400" />,
          label: "غير متصل بالسحابة",
          dotClass: "bg-zinc-500",
          borderClass: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <>
      <div id="cloud-sync-indicator-container" className="flex items-center gap-2" dir="rtl">
        {/* Main Sync Status Pill */}
        <button
          id="cloud-sync-status-btn"
          onClick={() => refreshSync()}
          title="انقر لإعادة المزامنة الفورية مع الخادم"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all hover:opacity-90 ${badge.borderClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
          {badge.icon}
          <span className="hidden sm:inline">{badge.label}</span>
        </button>

        {/* Active Devices Button */}
        <button
          id="active-devices-trigger-btn"
          onClick={() => setIsDevicesModalOpen(true)}
          title="عرض الأجهزة المتصلة بالحساب"
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all"
        >
          <Smartphone className="w-3 h-3 text-indigo-400" />
          <span>{syncState.activeDevicesCount}</span>
        </button>
      </div>

      <ActiveDevicesModal
        isOpen={isDevicesModalOpen}
        onClose={() => setIsDevicesModalOpen(false)}
      />
    </>
  );
};
