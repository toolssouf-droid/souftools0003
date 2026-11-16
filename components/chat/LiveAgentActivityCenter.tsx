"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Check,
  Square,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  FileCode,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import {
  AgentActivityState,
} from "@/lib/agent/agentActivityTypes";
import { isRtlLocale } from "@/lib/i18n";
import {
  aggregateAgentActivities,
  isSimpleDirectQuery,
  AggregatedActivityItem,
} from "@/lib/agent/activityAggregator";

export interface LiveAgentActivityCenterProps {
  activityState?: AgentActivityState;
  agentSteps?: string[];
  events?: any[];
  projectName?: string;
  sources?: any[];
  pagesRead?: any[];
  queriesUsed?: any[];
  isGenerating?: boolean;
  isStreaming?: boolean;
  locale?: string;
  onStop?: () => void;
  onRetryStep?: (stepNumber: number) => void;
  userPrompt?: string;
}

export const LiveAgentActivityCenter: React.FC<LiveAgentActivityCenterProps> = ({
  activityState,
  agentSteps = [],
  events = [],
  projectName,
  sources = [],
  pagesRead = [],
  queriesUsed = [],
  isGenerating = false,
  isStreaming = false,
  locale = "ar",
  onStop,
  onRetryStep,
  userPrompt = "",
}) => {
  const isRtl = isRtlLocale(locale);
  // Detailed activity is visible by default so agent operations and files are clearly exposed
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Run the Aggregator to transform raw events/steps into clean dynamic state
  const summary = useMemo(() => {
    return aggregateAgentActivities({
      events: events.length > 0 ? events : activityState?.activities || [],
      agentSteps: agentSteps.length > 0 ? agentSteps : activityState?.planSteps?.map((s) => s.title) || [],
      userPrompt,
      status: activityState?.status,
      isGenerating,
      isStreaming,
      locale,
      projectName: projectName || activityState?.projectName,
      toolsUsed: activityState?.toolsUsed || [],
      sources: sources.length > 0 ? sources : activityState?.sources || [],
    });
  }, [
    events,
    activityState,
    agentSteps,
    userPrompt,
    isGenerating,
    isStreaming,
    locale,
    projectName,
    sources,
  ]);

  const isRunning = summary.status === "running";
  const isCompleted = summary.status === "completed";
  const isCancelled = summary.status === "cancelled";
  const isFailed = summary.status === "failed";

  // =========================================================================
  // RULE 3 & 8: SIMPLE TASK / DIRECT CONVERSATION
  // Never show Agent Activity for simple questions, translations, direct chat
  // =========================================================================
  if (summary.complexity === "none") {
    return null;
  }

  // =========================================================================
  // RULE 8: QUICK TASK (e.g. "اكتب لي دالة JavaScript" or single calculation)
  // When completed: render nothing (the code/answer is in the message).
  // When running: show a tiny, subtle inline indicator.
  // =========================================================================
  if (summary.complexity === "quick") {
    if (!isRunning) return null;

    return (
      <div
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/25 text-[#00d4aa] text-xs font-medium my-1.5 max-w-full"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <Sparkles className="w-3.5 h-3.5 text-[#00ff88] animate-spin shrink-0" style={{ animationDuration: "2.5s" }} />
        <span className="truncate">{summary.currentActivity || (isRtl ? "⚡ SoufAI يعمل..." : "⚡ SoufAI working...")}</span>
      </div>
    );
  }

  // =========================================================================
  // RULE 9: MEDIUM TASK (e.g. "حلل هذا الملف وأصلح الخطأ")
  // When running: show a sleek compact single-line indicator.
  // When completed: show nothing or a subtle badge, keeping chat primary.
  // =========================================================================
  if (summary.complexity === "medium") {
    if (!isRunning) return null;

    return (
      <div
        className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl bg-[#091414]/90 border border-[#162929] text-xs my-2 max-w-md shadow-sm"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#00d4aa] font-bold shrink-0">⚡ SoufAI</span>
          <span className="text-[#203a3a]">·</span>
          <span className="text-[#e2f7f7] truncate">{summary.currentActivity}</span>
        </div>
        <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-ping shrink-0" />
      </div>
    );
  }

  // =========================================================================
  // RULE 4, 5, 7, 10, 11: DEEP / COMPLEX AGENT TASK
  // Compact smart card. Zero hardcoded 9-step static list.
  // Moves purely with real events. Expandable on demand via "عرض النشاط".
  // =========================================================================
  return (
    <div className="w-full max-w-xl my-2.5 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      <div
        className={`w-full rounded-xl transition-all duration-200 border ${
          isRunning
            ? "bg-[#081212]/95 border-[#00d4aa]/40 shadow-lg shadow-[#00d4aa]/5"
            : isCancelled
            ? "bg-[#140b0b]/90 border-[#ef4444]/30"
            : isFailed
            ? "bg-[#140b0b]/90 border-[#f59e0b]/40"
            : "bg-[#071010]/90 border-[#152424] hover:border-[#00d4aa]/30"
        }`}
      >
        {/* Compact Card Header */}
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          {/* Status Label */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Live Indicator Icon */}
            <div className="relative flex items-center justify-center shrink-0">
              {isRunning ? (
                <div className="w-6 h-6 rounded-lg bg-[#00d4aa]/15 border border-[#00d4aa]/50 flex items-center justify-center text-[#00d4aa]">
                  <Sparkles className="w-3.5 h-3.5 text-[#00ff88] animate-spin" style={{ animationDuration: "3s" }} />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />
                </div>
              ) : isCancelled ? (
                <div className="w-6 h-6 rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/40 flex items-center justify-center text-[#ef4444]">
                  <Square className="w-3 h-3 fill-current" />
                </div>
              ) : isFailed ? (
                <div className="w-6 h-6 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/40 flex items-center justify-center text-[#f59e0b]">
                  <AlertTriangle className="w-3 h-3" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-lg bg-[#00ff88]/15 border border-[#00ff88]/30 flex items-center justify-center text-[#00ff88]">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#e6f4f4] tracking-wide flex items-center gap-1">
                  {isRunning ? (
                    <>
                      <span className="text-[#00d4aa]">⚡</span>
                      <span>{isRtl ? "SoufAI يعمل" : "SoufAI Working"}</span>
                    </>
                  ) : isCancelled ? (
                    <span>{isRtl ? "تم إيقاف الوكيل" : "Agent Stopped"}</span>
                  ) : isFailed ? (
                    <span className="text-[#f59e0b]">{isRtl ? "تعثر في التنفيذ" : "Execution Issue"}</span>
                  ) : (
                    <>
                      <span className="text-[#00ff88]">✓</span>
                      <span>{summary.completionTitle}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Stop (if running) & Expand Activity Toggle */}
          <div className="flex items-center gap-1.5 mr-auto">
            {isRunning && onStop && (
              <button
                type="button"
                onClick={onStop}
                className="px-2 py-1 rounded-lg bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#f87171] border border-[#ef4444]/30 text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
                title={isRtl ? "إيقاف الوكيل" : "Stop Agent"}
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>{isRtl ? "إيقاف" : "Stop"}</span>
              </button>
            )}

            {summary.timeline.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-2.5 py-1 rounded-lg bg-[#111f1f] hover:bg-[#162b2b] text-[#82a8a8] hover:text-[#00d4aa] border border-[#1b2e2e] text-[11px] font-medium flex items-center gap-1 transition-all"
              >
                <span>{isExpanded ? (isRtl ? "طي النشاط" : "Collapse") : (isRtl ? "عرض النشاط" : "Show Activity")}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3 text-[#00d4aa]" /> : <ChevronDown className="w-3 h-3 text-[#00d4aa]" />}
              </button>
            )}
          </div>
        </div>

        {/* Current Activity Dynamic Display (Only when running, or if summary exists) */}
        {isRunning && (
          <div className="px-3.5 pb-2.5 pt-0.5">
            <div className="flex items-center gap-2 text-xs text-[#e8f7f7] font-medium bg-[#0c1818]/60 px-2.5 py-1.5 rounded-lg border border-[#152626]">
              <span className="text-sm shrink-0">{summary.currentActivityIcon}</span>
              <span className="truncate">{summary.currentActivity}</span>
            </div>
          </div>
        )}

        {/* Parallel Execution View (Requirement 11 - Only when real parallel tasks exist) */}
        {summary.parallelTasks.length > 1 && (
          <div className="px-3.5 pb-2.5 pt-0.5">
            <div className="text-[11px] text-[#719999] mb-1.5 flex items-center gap-1.5 font-medium">
              <Layers className="w-3 h-3 text-[#00d4aa]" />
              <span>
                {isRtl
                  ? `يعمل على ${summary.parallelTasks.length} مهام بالتوازي:`
                  : `Working on ${summary.parallelTasks.length} parallel tasks:`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summary.parallelTasks.map((t) => {
                const isTaskDone = t.status === "completed";
                const isTaskFailed = t.status === "failed";
                const isTaskRunning = t.status === "running";
                return (
                  <div
                    key={t.id}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border font-medium transition-all ${
                      isTaskDone
                        ? "bg-[#00ff88]/10 border-[#00ff88]/25 text-[#a7f3d0]"
                        : isTaskFailed
                        ? "bg-[#ef4444]/10 border-[#ef4444]/25 text-[#fca5a5]"
                        : isTaskRunning
                        ? "bg-[#00d4aa]/15 border-[#00d4aa]/40 text-[#00d4aa]"
                        : "bg-[#101b1b] border-[#182828] text-[#557575]"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0">
                      {isTaskDone ? (
                        <span className="text-[#00ff88] text-[9px] font-black leading-none">✓</span>
                      ) : isTaskRunning ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-ping block" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3d5a5a] block" />
                      )}
                    </span>
                    <span className="truncate max-w-[140px]">{t.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compact Stats Footer */}
        <div className="px-3.5 py-2 bg-[#050c0c]/80 border-t border-[#132222] flex items-center justify-between text-[11px] text-[#698a8a] rounded-b-xl">
          <span className="truncate">{summary.statsLabel}</span>
          {!isExpanded && summary.timeline.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-[#00d4aa] hover:underline shrink-0 text-[11px] font-medium"
            >
              {isRtl ? "التفاصيل" : "Details"}
            </button>
          )}
        </div>

        {/* ================================================================= */}
        {/* EXPANDED DETAILED ACTIVITY (COLLAPSIBLE / ACCORDION ON DEMAND)     */}
        {/* ================================================================= */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="border-t border-[#142323] p-3 bg-[#040909] rounded-b-xl space-y-2 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-[#0f1b1b] text-[11px] text-[#719999]">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Clock className="w-3 h-3 text-[#00d4aa]" />
                  <span>{isRtl ? "سجل الأحداث والأنشطة المنفذة" : "Executed Events Log"}</span>
                </span>
                <span className="font-mono text-[10px] text-[#00d4aa] bg-[#00d4aa]/10 px-1.5 py-0.5 rounded border border-[#00d4aa]/25">
                  {summary.timeline.length} {isRtl ? "أحداث" : "events"}
                </span>
              </div>

              {/* Chronological List of Real Events */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 text-xs">
                {summary.timeline.map((item, idx) => {
                  const isItemRunning = item.status === "running";
                  const isItemDone = item.status === "completed";
                  const isItemFailed = item.status === "failed";

                  return (
                    <div
                      key={item.id || idx}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all ${
                        isItemRunning
                          ? "bg-[#00d4aa]/10 border-[#00d4aa]/30 text-[#e6f4f4]"
                          : isItemFailed
                          ? "bg-[#ef4444]/10 border-[#ef4444]/30 text-[#fca5a5]"
                          : "bg-[#091313]/70 border-[#142222] text-[#b4d0d0]"
                      }`}
                    >
                      {/* Event Status Glyph */}
                      <span className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5 text-xs">
                        {isItemDone ? (
                          <span className="text-[#00ff88] font-bold text-xs">✓</span>
                        ) : isItemRunning ? (
                          <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-ping" />
                        ) : isItemFailed ? (
                          <span className="text-[#ef4444] font-bold text-xs">✕</span>
                        ) : (
                          <span className="text-[#436161]">○</span>
                        )}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-xs text-[#e6f4f4] truncate flex items-center gap-1.5">
                            <span>{item.icon}</span>
                            <span>{item.title}</span>
                          </span>
                          {item.timeStr && (
                            <span className="text-[10px] font-mono text-[#527777] shrink-0">
                              {item.timeStr}
                            </span>
                          )}
                        </div>

                        {item.detail && (
                          <p className="text-[11px] text-[#719999] mt-0.5 line-clamp-2 leading-relaxed">
                            {item.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
export default LiveAgentActivityCenter;
