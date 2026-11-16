"use client";

/**
 * SoufAI Behavioral Notification Hub & Cognitive Sparks Dropdown
 * Realtime psychological notification center integrated with Fogg Behavioral Model
 * and Multi-Armed Bandit (MAB) Reinforcement Learning feedback loop.
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Sparkles,
  Zap,
  BookOpen,
  Brain,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { isRtlLocale } from "@/lib/i18n";
import { KnowledgeSpark } from "@/lib/notifications/encyclopediaKnowledge";
import { WebPushSubscriptionToggle } from "@/components/ui/WebPushSubscriptionToggle";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
  metadata?: {
    framing?: string;
    actionUrl?: string;
    actionLabel?: string;
    sparkId?: string;
  };
}

interface BehavioralNotificationHubProps {
  locale: string;
}

export function BehavioralNotificationHub({ locale }: BehavioralNotificationHubProps) {
  const isRtl = isRtlLocale(locale);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "sparks">("notifications");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sparks, setSparks] = useState<KnowledgeSpark[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications and sparks
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch In-App notifications
      const notifRes = await fetch("/api/v1/notifications?limit=15");
      if (notifRes.ok) {
        const notifData = await notifRes.json().catch(() => null);
        if (notifData && notifData.success) {
          setNotifications(notifData.notifications || []);
          setUnreadCount(notifData.unreadCount || 0);
        }
      }

      // 2. Fetch Encyclopedic Sparks
      const sparkRes = await fetch("/api/v1/notifications/behavioral?mode=sparks");
      if (sparkRes.ok) {
        const sparkData = await sparkRes.json().catch(() => null);
        if (sparkData && sparkData.success && Array.isArray(sparkData.sparks)) {
          setSparks(sparkData.sparks);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch notification hub data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Re-check periodically
    const interval = setInterval(fetchData, 45000);
    return () => clearInterval(interval);
  }, []);

  // Handle Mark as Read or Action Click with Bandit Feedback
  const handleActionClick = async (notif: NotificationItem, actionUrl?: string) => {
    // Register Bandit Reward
    try {
      await fetch("/api/v1/notifications/behavioral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          notificationId: notif.id,
          feedbackAction: "click",
        }),
      });

      // Mark notification as read
      await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notif.id }),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}

    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  const handleDismiss = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    try {
      await fetch("/api/v1/notifications/behavioral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          notificationId: notifId,
          feedbackAction: "dismiss",
        }),
      });

      await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notifId }),
      });

      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition-all ${
          isOpen
            ? "bg-[#00d4aa]/15 border-[#00d4aa]/50 text-[#00d4aa]"
            : "bg-[#111a1a] hover:bg-[#162222] border-[#1e2e2e] text-[#8db3b3] hover:text-[#00d4aa]"
        }`}
        title={isRtl ? "مركز الإشعارات والومضات المعرفية" : "Notification & Spark Hub"}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#00d4aa] px-1 text-[10px] font-bold text-[#0a0f0f] shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full mt-2 w-80 sm:w-96 rounded-2xl bg-[#0d1414] border border-[#1e2e2e] shadow-2xl shadow-black/80 z-50 overflow-hidden ${
              isRtl ? "left-0 sm:left-auto sm:right-0" : "right-0 sm:right-auto sm:left-0"
            }`}
          >
            {/* Header */}
            <div className="p-3.5 border-b border-[#1e2e2e] bg-[#111a1a]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa]">
                  <Brain className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-bold text-[#e8f5f5]">
                  {isRtl ? "مركز التنبيهات والومضات السلوكية" : "Behavioral AI Hub"}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={fetchData}
                  className="p-1 text-[#6b9090] hover:text-[#00d4aa] transition-colors rounded-lg hover:bg-[#162222]"
                  title={isRtl ? "تحديث" : "Refresh"}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] text-[#00d4aa] hover:underline font-medium px-1.5 py-0.5 rounded"
                  >
                    {isRtl ? "تحديد الكل كمقروء" : "Mark all read"}
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-[#0a0f0f] border-b border-[#1e2e2e] text-xs font-semibold">
              <button
                onClick={() => setActiveTab("notifications")}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "notifications"
                    ? "bg-[#162222] text-[#00d4aa] shadow-sm border border-[#00d4aa]/20"
                    : "text-[#6b9090] hover:text-[#e8f5f5]"
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{isRtl ? "الإشعارات الذكية" : "Smart Alerts"}</span>
                {unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#00d4aa]/20 text-[#00d4aa] text-[9px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("sparks")}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "sparks"
                    ? "bg-[#162222] text-[#00d4aa] shadow-sm border border-[#00d4aa]/20"
                    : "text-[#6b9090] hover:text-[#e8f5f5]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isRtl ? "الموسوعة والومضات" : "Sparks Hub"}</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="max-h-[380px] overflow-y-auto p-2 space-y-2">
              {activeTab === "notifications" ? (
                notifications.length === 0 ? (
                  <div className="p-6 text-center text-[#6b9090] text-xs">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#00d4aa]/40" />
                    <p className="font-medium text-[#8db3b3]">
                      {isRtl ? "أنت على اطلاع تام بكل شيء!" : "All caught up!"}
                    </p>
                    <p className="text-[11px] mt-1 text-[#4a7070]">
                      {isRtl
                        ? "خوارزمية الحماية من الإرهاق تضمن عدم إزعاجك إلا بالتنبيهات الهامة."
                        : "Smart anti-fatigue cooldown keeps your focus uninterrupted."}
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isSecurity = notif.type === "security";
                    const isSystem = notif.type === "system";

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleActionClick(notif, notif.metadata?.actionUrl)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                          isSecurity
                            ? notif.isRead
                              ? "bg-red-950/20 border-red-900/40 text-red-200"
                              : "bg-red-950/40 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                            : isSystem
                            ? notif.isRead
                              ? "bg-amber-950/20 border-amber-900/40 text-amber-200"
                              : "bg-amber-950/40 border-amber-500/50"
                            : notif.isRead
                            ? "bg-[#111a1a]/40 border-[#1e2e2e]/60 hover:bg-[#162222]"
                            : "bg-[#162525] border-[#00d4aa]/30 hover:border-[#00d4aa]/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                            {isSecurity ? (
                              <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            ) : isSystem ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : !notif.isRead ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] shrink-0" />
                            ) : null}
                            <span>{notif.title}</span>
                          </h4>
                          <button
                            onClick={(e) => handleDismiss(e, notif.id)}
                            className="opacity-0 group-hover:opacity-100 text-[#4a7070] hover:text-red-400 p-0.5 rounded transition-opacity"
                            title={isRtl ? "إغلاق" : "Dismiss"}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        <p className="text-[11px] text-[#8db3b3] mt-1 leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>

                        {(isSecurity || isSystem || notif.metadata?.actionLabel) && (
                          <div className="mt-2 flex items-center justify-between pt-1 border-t border-[#1e2e2e]/40">
                            {notif.metadata?.actionLabel ? (
                              <span className="text-[10px] text-[#00d4aa] font-medium flex items-center gap-1">
                                <span>{notif.metadata.actionLabel}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            ) : (
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                  isSecurity
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {isSecurity ? "تنبيه أمني مباشر" : "إنذار نظام"}
                              </span>
                            )}
                            <span className="text-[9px] text-[#4a7070]">
                              {isSecurity ? "SoufShield WAF" : isSystem ? "Watchdog Pulse" : isRtl ? "سلوكي ذكي (Fogg MAP)" : "Behavioral"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              ) : (
                sparks.map((spark) => (
                  <div
                    key={spark.id}
                    className="p-3 rounded-xl bg-[#111a1a]/70 border border-[#1e2e2e] hover:border-[#00d4aa]/40 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-[#00d4aa]/10 text-[#00d4aa] font-semibold">
                        {spark.categoryAr}
                      </span>
                      <span className="text-[9px] text-[#4a7070] uppercase">
                        {spark.depthLevel}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#e8f5f5]">{spark.title}</h4>
                    <p className="text-[11px] text-[#8db3b3] leading-relaxed">{spark.summary}</p>

                    <div className="p-2 rounded-lg bg-[#0a0f0f] border border-[#1e2e2e]/60 text-[10px] text-[#00d4aa]">
                      <span className="font-bold text-[#e8f5f5]">{isRtl ? "التطبيق العملي: " : "Actionable: "}</span>
                      {spark.actionableTakeaway}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-[#1e2e2e] bg-[#0a0f0f] text-center">
              <span className="text-[10px] text-[#4a7070]">
                {isRtl
                  ? "نظام التنبيهات السلوكية مدعوم بخوارزميات Thompson Sampling وBJ Fogg"
                  : "Powered by BJ Fogg Behavior Model & CMAB Thompson Sampling"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
