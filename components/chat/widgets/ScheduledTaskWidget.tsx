"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Edit3,
  Check,
  RotateCcw,
  Loader2,
  Trash2,
  Tag,
  ListTodo,
  ExternalLink,
  Bot,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useScheduleStore, ScheduledItem } from "@/store/scheduleStore";
import { useGmailStore } from "@/store/gmailStore";
import { normalizeAndFixEmailAddress, getEmailDomainSuggestions } from "@/lib/utils/emailFormatter";

interface ScheduledTaskWidgetProps {
  data: {
    taskId?: string;
    task?: Partial<ScheduledItem>;
    isList?: boolean;
    filter?: string;
    message?: string;
    [key: string]: any;
  };
  isRtl?: boolean;
}

export function ScheduledTaskWidget({ data, isRtl = true }: ScheduledTaskWidgetProps) {
  const { items, addItem, updateItem, cancelItem, completeItem, deleteItem } = useScheduleStore();
  const { accessToken } = useGmailStore();

  // If this widget was created by a single task tool call, ensure it's registered in the store
  useEffect(() => {
    if (data.task && data.task.id) {
      const state = useScheduleStore.getState();
      const existing = state.items.find((i) => i.id === data.task?.id);
      if (!existing && data.task.title) {
        state.addItem({
          title: data.task.title,
          type: (data.task.type as any) || "task",
          dueDate: data.task.dueDate || new Date().toISOString(),
          targetTimestamp: data.task.targetTimestamp || Date.now() + 3600000,
          priority: data.task.priority || "medium",
          category: data.task.category || "work",
          description: data.task.description || "",
          emailData: data.task.emailData,
          autoExecute: data.task.autoExecute ?? true,
        });
      }
    }
  }, [data.task]);

  // If it's a list view
  if (data.isList) {
    return <ScheduledListSubView isRtl={isRtl} initialFilter={data.filter} />;
  }

  // Find the task in store or use fallback from props
  const taskId = data.taskId || data.task?.id;
  const storeItem = items.find((i) => i.id === taskId);
  const currentTask: Partial<ScheduledItem> = storeItem || data.task || {};

  return <SingleScheduledItemCard task={currentTask} isRtl={isRtl} />;
}

// -------------------------------------------------------------
// Component: Single Scheduled Item Card
// -------------------------------------------------------------
function SingleScheduledItemCard({
  task,
  isRtl,
}: {
  task: Partial<ScheduledItem>;
  isRtl: boolean;
}) {
  const { updateItem, cancelItem, completeItem, setAutoExecute, resetForRetry, markExecuted } = useScheduleStore();
  const { accessToken } = useGmailStore();

  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isDue, setIsDue] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Edit fields
  const [editTitle, setEditTitle] = useState(task.title || "");
  const [editTo, setEditTo] = useState(task.emailData?.to || "");
  const [editSubject, setEditSubject] = useState(task.emailData?.subject || "");
  const [editBody, setEditBody] = useState(task.emailData?.body || "");

  const isEmail = task.type === "email" || !!task.emailData;
  const status = task.status || "pending";
  const targetTs = task.targetTimestamp || Date.now();
  const autoExecute = task.autoExecute ?? true;

  // Countdown timer logic
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = targetTs - now;

      if (diff <= 0) {
        setIsDue(true);
        setTimeLeft(isRtl ? "حان موعد التنفيذ الآن" : "Due now");
        return;
      }

      setIsDue(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(isRtl ? `متبقي ${days} يوم و ${hours % 24} س` : `${days}d ${hours % 24}h remaining`);
      } else if (hours > 0) {
        setTimeLeft(isRtl ? `متبقي ${hours} س و ${minutes} د` : `${hours}h ${minutes}m remaining`);
      } else if (minutes > 0) {
        setTimeLeft(isRtl ? `متبقي ${minutes} د و ${seconds} ث` : `${minutes}m ${seconds}s remaining`);
      } else {
        setTimeLeft(isRtl ? `متبقي ${seconds} ثانية` : `${seconds}s remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetTs, isRtl]);

  // Execute / Send immediately
  const handleExecuteNow = async () => {
    setIsActionLoading(true);
    setActionFeedback(null);

    try {
      if (isEmail && task.emailData) {
        if (!accessToken) {
          setActionFeedback({
            type: "error",
            message: isRtl
              ? "يرجى ربط حساب Gmail من قائمة الأدوات لتنفيذ الإرسال الفوري."
              : "Please connect Gmail account from Tools menu to send.",
          });
          setIsActionLoading(false);
          return;
        }

        const cleanRecipient = normalizeAndFixEmailAddress(editTo || task.emailData.to || "");
        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: cleanRecipient,
            subject: editSubject || task.emailData.subject,
            emailBody: editBody || task.emailData.body,
            token: accessToken,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || "فشل في إرسال البريد الإلكتروني");
        }
      }

      if (task.id) {
        markExecuted(
          task.id,
          true,
          isEmail
            ? isRtl
              ? "تم إرسال البريد الإلكتروني بنجاح وتأكيد التسليم."
              : "Email sent successfully."
            : isRtl
            ? "تم تنفيذ المهمة والمراقبة بنجاح."
            : "Task executed successfully."
        );
      }

      setActionFeedback({
        type: "success",
        message: isEmail
          ? isRtl
            ? "تم إرسال البريد الإلكتروني بنجاح الآن!"
            : "Email sent successfully now!"
          : isRtl
          ? "تم تنفيذ وإنهاء المهمة بنجاح!"
          : "Task marked as completed!",
      });
    } catch (err: any) {
      if (task.id) {
        markExecuted(task.id, false, err.message || "فشل في التنفيذ");
      }
      setActionFeedback({
        type: "error",
        message: err.message || (isRtl ? "حدث خطأ أثناء التنفيذ" : "Execution error occurred"),
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Cancel schedule
  const handleCancel = () => {
    if (task.id) {
      cancelItem(task.id, isRtl ? "ألغيت بواسطة المستخدم" : "Cancelled by user");
      setActionFeedback({
        type: "success",
        message: isRtl ? "تم إلغاء الجدولة." : "Scheduled task cancelled.",
      });
    }
  };

  // Save edits
  const handleSaveEdits = () => {
    if (task.id) {
      updateItem(task.id, {
        title: editTitle,
        emailData: isEmail
          ? {
              to: editTo,
              subject: editSubject,
              body: editBody,
            }
          : undefined,
      });
    }
    setIsEditing(false);
  };

  // Toggle Auto-execute
  const handleToggleAutoExecute = () => {
    if (task.id) {
      setAutoExecute(task.id, !autoExecute);
    }
  };

  // Retry failed task
  const handleRetry = () => {
    if (task.id) {
      resetForRetry(task.id);
      setActionFeedback(null);
    }
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="my-3 overflow-hidden rounded-2xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/60 shadow-sm transition-all dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950/60"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-neutral-200/60 px-4 py-3 dark:border-neutral-800/60">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              isEmail
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
            }`}
          >
            {isEmail ? <Mail className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {isEmail
                  ? isRtl
                    ? "بريد إلكتروني مجدول (Send Later)"
                    : "Scheduled Email"
                  : isRtl
                  ? "مهمة / تذكير مجدول"
                  : "Scheduled Task"}
              </span>
              {task.priority && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    task.priority === "high"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {task.priority === "high"
                    ? isRtl
                      ? "أولوية عالية"
                      : "High"
                    : isRtl
                    ? "عادي"
                    : "Normal"}
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
              {task.title || (isEmail ? "إرسال بريد مجدول" : "مهمة مجدولة")}
            </h4>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {status === "executing" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 animate-pulse dark:bg-blue-950/60 dark:text-blue-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isRtl ? "الوكيل ينفذ الآن..." : "Executing..."}
            </span>
          ) : status === "completed" ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isRtl ? "مكتملة بنجاح" : "Completed"}
            </span>
          ) : status === "failed" ? (
            <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5" />
              {isRtl ? "تعذر التنفيذ" : "Failed"}
            </span>
          ) : status === "cancelled" ? (
            <span className="flex items-center gap-1 rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              <XCircle className="h-3.5 w-3.5" />
              {isRtl ? "ملغاة" : "Cancelled"}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              </span>
              <span>{timeLeft}</span>
            </div>
          )}
        </div>
      </div>

      {/* Body Details */}
      <div className="p-4 space-y-3">
        {/* Date and Time badge */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-neutral-600 dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-400" />
            <span>{task.dueDate || "موعد محدد لاحقاً"}</span>
          </div>

          {/* Autonomous Mode Switch */}
          {status === "pending" && (
            <button
              onClick={handleToggleAutoExecute}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
                autoExecute
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
              title={isRtl ? "تبديل الإرسال التلقائي للوكيل" : "Toggle autonomous execution"}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>
                {autoExecute
                  ? isRtl
                    ? "إرسال ذاتي بواسطة الوكيل (مفعّل)"
                    : "Autonomous: Active"
                  : isRtl
                  ? "تذكير يدوي فقط"
                  : "Manual send"}
              </span>
            </button>
          )}
        </div>

        {/* Executing Banner */}
        {status === "executing" && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800">
            <Loader2 className="h-4 w-4 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-semibold block">
                {isRtl ? "الوكيل يستيقظ الآن وينفذ المهمة..." : "Agent is executing now..."}
              </span>
              <span className="text-[11px] text-blue-700 dark:text-blue-300">
                {isRtl
                  ? "يراقب الوكيل استجابة الخادم وتأكيد العملية وسيقوم بإبلاغك فوراً."
                  : "Monitoring server response and will verify completion."}
              </span>
            </div>
          </div>
        )}

        {/* Execution Result Banner */}
        {task.executionResult && (
          <div
            className={`rounded-xl p-3 text-xs border ${
              task.executionResult.success
                ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800/60"
                : "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-800/60"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {task.executionResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>
                {task.executionResult.success
                  ? isRtl
                    ? "تقرير المراقبة: تم التنفيذ بنجاح بواسطة الوكيل الذكي"
                    : "Monitoring Report: Executed successfully by Agent"
                  : isRtl
                  ? "تقرير المراقبة: تعذر إكمال المهمة"
                  : "Monitoring Report: Execution failed"}
              </span>
            </div>
            <p className="mt-1 text-[11px] opacity-90">{task.executionResult.responseMessage}</p>
          </div>
        )}

        {/* Email specific details */}
        {isEmail && task.emailData && (
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-0.5">
                    {isRtl ? "إلى (المستلم):" : "To:"}
                  </label>
                  <input
                    type="email"
                    value={editTo}
                    onChange={(e) => setEditTo(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-0.5">
                    {isRtl ? "الموضوع:" : "Subject:"}
                  </label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 mb-0.5">
                    {isRtl ? "محتوى الرسالة:" : "Body:"}
                  </label>
                  <textarea
                    rows={3}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    {isRtl ? "إلغاء التعديل" : "Cancel"}
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    className="flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    <Check className="h-3 w-3" />
                    {isRtl ? "حفظ التغييرات" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-500">{isRtl ? "المستلم:" : "To:"}</span>
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {task.emailData.to}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-500">{isRtl ? "الموضوع:" : "Subject:"}</span>
                  <span className="text-neutral-800 dark:text-neutral-200">
                    {task.emailData.subject}
                  </span>
                </div>
                {task.emailData.body && (
                  <p className="line-clamp-2 pt-1 text-neutral-600 dark:text-neutral-400 border-t border-neutral-200/50 dark:border-neutral-800/50">
                    {task.emailData.body}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Task description if not email */}
        {!isEmail && task.description && (
          <p className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60">
            {task.description}
          </p>
        )}

        {/* Action feedback message */}
        {actionFeedback && (
          <div
            className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${
              actionFeedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Action Buttons Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/60 bg-neutral-50/50 px-4 py-2.5 dark:border-neutral-800/60 dark:bg-neutral-900/30">
        {status === "pending" && !isEditing ? (
          <>
            <div className="flex items-center gap-2">
              {isEmail && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <Edit3 className="h-3 w-3" />
                  {isRtl ? "تعديل" : "Edit"}
                </button>
              )}
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="h-3 w-3" />
                {isRtl ? "إلغاء الجدولة" : "Cancel"}
              </button>
            </div>

            <button
              onClick={handleExecuteNow}
              disabled={isActionLoading}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all ${
                isEmail
                  ? "bg-amber-600 hover:bg-amber-700 active:scale-95"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-95"
              }`}
            >
              {isActionLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>
                {isEmail
                  ? isRtl
                    ? "إرسال الآن فوراً"
                    : "Send Now"
                  : isRtl
                  ? "إكمال المهمة الآن"
                  : "Complete Now"}
              </span>
            </button>
          </>
        ) : status === "failed" ? (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-rose-600 dark:text-rose-400">
              {isRtl ? "يمكنك إعادة المحاولة بعد إصلاح الاتصال" : "Retry when ready"}
            </span>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{isRtl ? "إعادة المحاولة الآن" : "Retry Now"}</span>
            </button>
          </div>
        ) : status === "completed" ? (
          <div className="flex w-full items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isRtl ? "الوكيل قام بالمراقبة وتأكيد العملية بنجاح." : "Monitored and completed by Agent."}
            </span>
            <span className="text-[11px] text-neutral-400">
              {task.executionResult?.executedAt
                ? new Date(task.executionResult.executedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Scheduled List SubView
// -------------------------------------------------------------
function ScheduledListSubView({
  isRtl,
  initialFilter = "all",
}: {
  isRtl: boolean;
  initialFilter?: string;
}) {
  const { items } = useScheduleStore();
  const [filter, setFilter] = useState<string>(initialFilter);

  const filteredItems = items.filter((item) => {
    if (filter === "pending") return item.status === "pending";
    if (filter === "completed") return item.status === "completed";
    if (filter === "email") return item.type === "email";
    if (filter === "task") return item.type === "task";
    return true;
  });

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="my-3 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* List Header */}
      <div className="flex items-center justify-between border-b border-neutral-200/70 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
            {isRtl ? "قائمة المهام والرسائل المجدولة" : "Scheduled Tasks & Messages"}
          </h4>
        </div>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          {filteredItems.length} {isRtl ? "عنصر" : "items"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200/60 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800/60 dark:bg-neutral-950/40">
        {[
          { key: "all", label: isRtl ? "الكل" : "All" },
          { key: "pending", label: isRtl ? "المعلقة" : "Pending" },
          { key: "email", label: isRtl ? "بريد مجدول" : "Emails" },
          { key: "task", label: isRtl ? "مهام وتذكيرات" : "Tasks" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === tab.key
                ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="divide-y divide-neutral-100 p-2 dark:divide-neutral-800/50 max-h-[340px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400">
            {isRtl ? "لا توجد عناصر مجدولة حالياً ضمن هذا التصنيف." : "No scheduled items found."}
          </div>
        ) : (
          filteredItems.map((item) => (
            <SingleScheduledItemCard key={item.id} task={item} isRtl={isRtl} />
          ))
        )}
      </div>
    </div>
  );
}
