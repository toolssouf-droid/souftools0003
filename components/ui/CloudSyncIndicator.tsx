"use client";

import React, { useState } from "react";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, ShieldCheck, User, Smartphone } from "lucide-react";
import { isRtlLocale } from "@/lib/i18n";
import { useSyncClient } from "@/lib/sync/useSyncClient";
import { ActiveDevicesModal } from "@/components/user/ActiveDevicesModal";

interface CloudSyncIndicatorProps {
  locale?: string;
  compact?: boolean;
}

export const CloudSyncIndicator: React.FC<CloudSyncIndicatorProps> = ({
  locale = "ar",
  compact = false,
}) => {
  const { syncState, refreshSync } = useSyncClient();
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const isRtl = isRtlLocale(locale);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await refreshSync();
  };

  const formattedTime = syncState.lastSyncedAt
    ? new Date(syncState.lastSyncedAt).toLocaleTimeString(isRtl ? "ar-EG" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : isRtl
    ? "قيد المزامنة الأولى"
    : "Initial sync";

  const getStatusBadge = () => {
    if (syncState.status === "syncing") {
      return (
        <div className="flex items-center gap-1.5 text-sky-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          {!compact && <span>{isRtl ? "جارٍ المزامنة السحابية..." : "Syncing to cloud..."}</span>}
        </div>
      );
    }
    if (syncState.status === "disconnected" || syncState.status === "error") {
      return (
        <div className="flex items-center gap-1.5 text-amber-400">
          <CloudOff className="w-3.5 h-3.5" />
          {!compact && <span>{isRtl ? "غير متصل بالسيرفر" : "Disconnected"}</span>}
        </div>
      );
    }
    if (syncState.status === "connected") {
      return (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Cloud className="w-3.5 h-3.5" />
          {!compact && (
            <span className="font-medium text-xs">
              {isRtl ? "مزامنة سحابية نشطة" : "Cloud Synced"}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-zinc-400">
        <Cloud className="w-3.5 h-3.5" />
        {!compact && <span>{isRtl ? "سحابي" : "Cloud"}</span>}
      </div>
    );
  };

  return (
    <>
      <div className="relative inline-flex items-center gap-1.5">
        <button
          id="cloud-sync-status-indicator-btn"
          onClick={() => setShowTooltip(!showTooltip)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 text-xs transition-all cursor-pointer shadow-sm"
          title={isRtl ? "حالة المزامنة السحابية للسيرفر" : "Server Cloud Sync Status"}
        >
          {getStatusBadge()}
        </button>

        {/* Floating Detailed Sync Info Tooltip / Dropdown */}
        {showTooltip && (
          <div
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={`absolute ${
              isRtl ? "left-0" : "right-0"
            } top-full mt-2 w-72 p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl text-xs text-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md`}
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
              <div className="flex items-center gap-2 font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isRtl ? "المزامنة السحابية الآمنة" : "Secure Cloud Sync"}</span>
              </div>
              <button
                onClick={handleManualSync}
                disabled={syncState.status === "syncing"}
                className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer disabled:opacity-50"
                title={isRtl ? "مزامنة فورية مع السيرفر" : "Sync Now"}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === "syncing" ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-2 text-[11px] text-zinc-400">
              <div className="flex justify-between items-center">
                <span>{isRtl ? "مصدر البيانات الحقيقي:" : "Source of Truth:"}</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1 font-mono">
                  PostgreSQL Server
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>{isRtl ? "حالة الاتصال المباشر:" : "Live Connection:"}</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isRtl ? "SSE Real-Time نشط" : "SSE Active"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>{isRtl ? "الأجهزة النشطة:" : "Active Devices:"}</span>
                <button
                  onClick={() => setIsDevicesModalOpen(true)}
                  className="font-mono text-indigo-400 hover:underline font-semibold"
                >
                  {syncState.activeDevicesCount} {isRtl ? "أجهزة متصلة" : "devices"}
                </button>
              </div>

              <div className="flex justify-between items-center">
                <span>{isRtl ? "آخر مزامنة:" : "Last Synced:"}</span>
                <span className="font-mono text-zinc-200">{formattedTime}</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-800 flex gap-2">
              <button
                onClick={handleManualSync}
                disabled={syncState.status === "syncing"}
                className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-950/40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === "syncing" ? "animate-spin" : ""}`} />
                <span>{isRtl ? "مزامنة فورية الآن" : "Sync Now"}</span>
              </button>
              <button
                onClick={() => setIsDevicesModalOpen(true)}
                className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs flex items-center justify-center gap-1 transition-all"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{isRtl ? "الأجهزة" : "Devices"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ActiveDevicesModal
        isOpen={isDevicesModalOpen}
        onClose={() => setIsDevicesModalOpen(false)}
      />
    </>
  );
};
