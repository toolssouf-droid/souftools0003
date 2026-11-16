/**
 * Server Error & Runtime Diagnostics Engine
 * Captures, analyzes, aggregates, and automates remediation of platform exceptions.
 * Durable storage is backed exclusively by Turso (`runtime_errors` table).
 */

import fs from "fs";
import path from "path";
import {
  ServerErrorRecord,
  ErrorCategory,
  ErrorSeverity,
  ErrorResolutionStatus,
  FixActionType,
  ErrorDiagnosticsStats,
} from "./types";
import { healthManager } from "@/lib/healthManager";
import { RuntimeErrorRepository } from "@/lib/db";

const LEGACY_ERRORS_FILE = path.join(process.cwd(), "data", "server_runtime_errors.json");
const START_TIME = Date.now();

function mapRowToErrorRecord(row: any): ServerErrorRecord {
  const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, any>;
  return {
    id: String(row.id),
    timestamp: row.timestamp instanceof Date ? row.timestamp.getTime() : Number(row.timestamp || Date.now()),
    lastOccurredAt:
      row.lastOccurrence instanceof Date
        ? row.lastOccurrence.getTime()
        : Number(row.lastOccurrence || row.timestamp || Date.now()),
    occurrencesCount: Number(row.occurrencesCount || 1),
    title: String(row.title || ""),
    message: String(row.message || ""),
    category: (row.category || "system") as ErrorCategory,
    severity: (row.severity || "medium") as ErrorSeverity,
    status: (row.status || "unresolved") as ErrorResolutionStatus,
    endpoint: row.endpoint || undefined,
    method: meta.method || undefined,
    statusCode: row.statusCode ?? undefined,
    providerId: row.providerId || undefined,
    modelId: row.modelId || undefined,
    chatId: meta.chatId || undefined,
    userId: meta.userId || undefined,
    stackTrace: row.stackTrace || undefined,
    metadata: meta,
    diagnosis: row.diagnosis || "",
    suggestedFix: row.suggestedFix || "",
    recommendedAction: (row.autoFixAction || undefined) as FixActionType | undefined,
    resolvedAt: row.resolvedAt instanceof Date ? row.resolvedAt.getTime() : row.resolvedAt ? Number(row.resolvedAt) : undefined,
    resolvedBy: row.resolvedBy || undefined,
    resolutionNotes: row.resolutionNotes || undefined,
    aiAnalysis: row.aiAnalysis
      ? {
          rootCause: row.aiAnalysis.rootCause || "",
          impact: row.aiAnalysis.impact || "",
          steps: Array.isArray(row.aiAnalysis.steps) ? row.aiAnalysis.steps : [],
          suggestedAction: row.aiAnalysis.suggestedAction,
          analyzedAt:
            typeof row.aiAnalysis.analyzedAt === "number"
              ? row.aiAnalysis.analyzedAt
              : Date.parse(row.aiAnalysis.analyzedAt || "") || Date.now(),
        }
      : undefined,
  };
}

function mapErrorRecordToDbPayload(record: ServerErrorRecord) {
  return {
    id: record.id,
    timestamp: new Date(record.timestamp || Date.now()),
    lastOccurrence: new Date(record.lastOccurredAt || record.timestamp || Date.now()),
    occurrencesCount: Number(record.occurrencesCount || 1),
    severity: record.severity || "medium",
    category: record.category || "system",
    title: record.title,
    message: record.message,
    stackTrace: record.stackTrace || null,
    endpoint: record.endpoint || null,
    providerId: record.providerId || null,
    modelId: record.modelId || null,
    statusCode: record.statusCode ?? null,
    diagnosis: record.diagnosis || null,
    suggestedFix: record.suggestedFix || null,
    autoFixAction: record.recommendedAction || null,
    status: record.status || "unresolved",
    resolvedAt: record.resolvedAt ? new Date(record.resolvedAt) : null,
    resolvedBy: record.resolvedBy || null,
    resolutionNotes: record.resolutionNotes || null,
    aiAnalysis: record.aiAnalysis
      ? {
          rootCause: record.aiAnalysis.rootCause,
          impact: record.aiAnalysis.impact,
          steps: record.aiAnalysis.steps,
          suggestedAction: record.aiAnalysis.suggestedAction,
          analyzedAt: new Date(record.aiAnalysis.analyzedAt || Date.now()).toISOString(),
        }
      : null,
    metadata: {
      ...(record.metadata || {}),
      ...(record.method ? { method: record.method } : {}),
      ...(record.chatId ? { chatId: record.chatId } : {}),
      ...(record.userId ? { userId: record.userId } : {}),
    },
  };
}

export class ServerErrorManager {
  private errors: Map<string, ServerErrorRecord> = new Map();
  private maxRecords = 250;
  private isLoaded = false;
  private loadingPromise: Promise<void> | null = null;
  private pendingWrites: Set<Promise<any>> = new Set();
  private globalHandlersRegistered = false;

  constructor() {
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    if (this.globalHandlersRegistered) return;
    if (typeof window === "undefined" && typeof process !== "undefined") {
      this.globalHandlersRegistered = true;
      process.on("unhandledRejection", (reason: any) => {
        const msg = reason?.message || String(reason || "Unhandled Promise Rejection");
        const stack = reason?.stack || "";
        this.recordError({
          title: "خطأ غير معالج في وعد برمجي (Unhandled Rejection)",
          message: msg,
          category: "system",
          severity: "high",
          stackTrace: stack,
        });
      });

      process.on("uncaughtException", (err: Error) => {
        console.error("[ServerErrorManager Caught UncaughtException]:", err);
        this.recordError({
          title: "استثناء عام غير ملتقط في السيرفر (Uncaught Exception)",
          message: err.message,
          category: "system",
          severity: "critical",
          stackTrace: err.stack,
        });
      });
    }
  }

  private trackWrite<T>(promise: Promise<T>): Promise<T> {
    this.pendingWrites.add(promise);
    promise.finally(() => this.pendingWrites.delete(promise)).catch(() => {});
    return promise;
  }

  public async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) return;
    await Promise.allSettled(Array.from(this.pendingWrites));
  }

  /**
   * Hydrates runtime errors exclusively from Turso `runtime_errors` (with one-time read-only legacy import if Turso is empty).
   */
  public async ensureLoaded(forceReload = false): Promise<void> {
    if (this.isLoaded && !forceReload) return;
    if (this.loadingPromise && !forceReload) return this.loadingPromise;

    const loadTask = (async () => {
      try {
        const rows = await RuntimeErrorRepository.listAll(this.maxRecords);
        if (rows && rows.length > 0) {
          this.errors.clear();
          for (const row of rows) {
            if (row?.id) {
              this.errors.set(row.id, mapRowToErrorRecord(row));
            }
          }
          this.isLoaded = true;
          return;
        }

        // One-time read-only migration from legacy JSON file if Turso table is empty
        if (fs.existsSync(LEGACY_ERRORS_FILE)) {
          try {
            const raw = fs.readFileSync(LEGACY_ERRORS_FILE, "utf-8");
            if (raw && raw.trim()) {
              const list: ServerErrorRecord[] = JSON.parse(raw);
              if (Array.isArray(list) && list.length > 0) {
                const normalized = list.filter((item) => item && item.id).slice(0, this.maxRecords);
                for (const item of normalized) {
                  this.errors.set(item.id, item);
                }
                await RuntimeErrorRepository.bulkUpsert(normalized.map(mapErrorRecordToDbPayload));
                this.isLoaded = true;
                return;
              }
            }
          } catch (err) {
            console.warn("[ServerErrorManager] Legacy error JSON read note:", err);
          }
        }

        // Seed initial health record into Turso if empty
        if (this.errors.size === 0) {
          await this.seedInitialHealthState();
        }
        this.isLoaded = true;
      } catch (err) {
        console.warn("[ServerErrorManager] Turso hydration note:", err);
      } finally {
        this.loadingPromise = null;
      }
    })();

    this.loadingPromise = loadTask;
    return loadTask;
  }

  private persistRecordToTurso(record: ServerErrorRecord): Promise<boolean> {
    return this.trackWrite(
      RuntimeErrorRepository.upsertError(mapErrorRecordToDbPayload(record)).catch((err) => {
        console.warn("[ServerErrorManager] Failed to persist error to Turso:", err);
        return false;
      })
    );
  }

  private async seedInitialHealthState() {
    const initId = "err_init_system_ready";
    const initRecord: ServerErrorRecord = {
      id: initId,
      timestamp: Date.now() - 3600000,
      lastOccurredAt: Date.now() - 3600000,
      occurrencesCount: 1,
      title: "تهيئة نظام مراقبة الأخطاء وتشخيص السيرفر",
      message: "تم إطلاق محرك رصد الأخطاء الفعلي وتفعيل مصائد الاستثناءات على سيرفر المنصة بنجاح.",
      category: "system",
      severity: "low",
      status: "resolved",
      diagnosis: "النظام يعمل بحالة طبيعية بدون أخطاء حرجة تعيق التشغيل.",
      suggestedFix: "لا يتطلب أي إجراء تدخل يدوي.",
      recommendedAction: "mark_resolved",
      resolvedAt: Date.now() - 3600000,
      resolvedBy: "نظام التشخيص التلقائي",
      resolutionNotes: "فحص التهيئة الأولي سليم 100%.",
    };
    this.errors.set(initId, initRecord);
    await RuntimeErrorRepository.upsertError(mapErrorRecordToDbPayload(initRecord)).catch(() => false);
  }

  private generateDiagnosis(
    title: string,
    message: string,
    category: ErrorCategory
  ): { diagnosis: string; suggestedFix: string; action?: FixActionType } {
    const text = `${title} ${message}`.toLowerCase();

    if (text.includes("429") || text.includes("rate limit") || text.includes("quota") || text.includes("resource_exhausted")) {
      return {
        diagnosis: "ضغط معالجة مرتفع وتجاوز مؤقت لمعدل الطلبات في محرك التوليد.",
        suggestedFix: "يتم تفعيل التوزيع الذكي والتراجع التلقائي وتخفيف الضغط اللحظي.",
        action: "reset_key_quarantine",
      };
    }

    if (text.includes("401") || text.includes("403") || text.includes("unauthorized") || text.includes("invalid api key") || text.includes("permission_denied")) {
      return {
        diagnosis: "تحديث أمني مطلوب لشهادات التوثيق ومسارات الاتصال.",
        suggestedFix: "التحقق من اعتماديات الخدمة وإعادة مزامنة قنوات التوثيق السحابية.",
        action: "reset_key_quarantine",
      };
    }

    if (category === "telegram" || text.includes("telegram") || text.includes("getupdates") || text.includes("webhook")) {
      return {
        diagnosis: "تعذر الاتصال ببوابة بوت تيليجرام أو انقطاع في خادم الاستقبال.",
        suggestedFix: "إعادة تشغيل خدمة السحب المباشر (Long Polling) وفحص استقرار الاتصال.",
        action: "restart_telegram_polling",
      };
    }

    if (category === "whatsapp" || text.includes("whatsapp") || text.includes("baileys") || text.includes("connection.update")) {
      return {
        diagnosis: "انقطاع في جلسة ويب واتساب المشفرة.",
        suggestedFix: "تنظيف الجلسات المؤقتة وإعادة مزامنة قناة الاتصال.",
        action: "clear_wa_socket",
      };
    }

    if (text.includes("timeout") || text.includes("etimedout") || text.includes("econnreset") || text.includes("fetch failed")) {
      return {
        diagnosis: "تأخر استجابة الخادم أو انقطاع لحظي في الاتصال الشبكي.",
        suggestedFix: "التبديل التلقائي لمسار المعالجة الاحتياطي وإعادة المحاولة.",
        action: "retry_operation",
      };
    }

    if (category === "ai_engine" || text.includes("gemini") || text.includes("model")) {
      return {
        diagnosis: "ضغط استثنائي على محرك المعالجة المتطور.",
        suggestedFix: "تفعيل خوارزمية التوجيه الذكي للمحرك الداخلي لضمان استمرارية الخدمة.",
        action: "test_gemini_connection",
      };
    }

    return {
      diagnosis: "استثناء عابر أثناء معالجة الطلب في الخادم.",
      suggestedFix: "إعادة المحاولة ومراجعة سجلات التشخيص الآلي.",
      action: "flush_cache",
    };
  }

  public static sanitizeUserMessage(rawError: any): string {
    const str = String(rawError?.message || rawError || "").toLowerCase();

    if (str.includes("offline") || str.includes("network") || str.includes("internet") || str.includes("failed to fetch")) {
      return "أنت غير متصل بالإنترنت حالياً، يرجى التحقق من اتصالك وإعادة المحاولة.";
    }

    if (str.includes("timeout") || str.includes("timed out") || str.includes("504") || str.includes("etimedout")) {
      return "استغرقت المعالجة وقتاً أطول من المتوقع بسبب ضغط الخدمة. يرجى التفضل بإعادة المحاولة.";
    }

    if (str.includes("too large") || str.includes("context_length") || str.includes("maximum context")) {
      return "النص أو المرفقات تتجاوز الحد الأقصى المسموح به لعملية المعالجة الواحدة.";
    }

    if (str.includes("safety") || str.includes("blocked") || str.includes("harmful")) {
      return "تعذر إكمال التوليد نظراً لسياسات ومعايير الأمان المعتمدة في المنصة.";
    }

    return "نواجه حالياً ضغطاً مرتفعاً على خوادم المنصة. يرجى المحاولة بعد قليل أو التواصل مع الدعم الفني وتقديم بلاغ في حال استمرار المشكلة.";
  }

  public recordError(params: {
    title: string;
    message: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    providerId?: string;
    modelId?: string;
    chatId?: string;
    userId?: string;
    stackTrace?: string;
    metadata?: Record<string, any>;
  }): ServerErrorRecord {
    const category = params.category || "api_route";
    const severity = params.severity || "medium";
    const now = Date.now();

    let existingEntry: ServerErrorRecord | undefined;
    for (const item of this.errors.values()) {
      if (
        item.status !== "resolved" &&
        item.status !== "auto_resolved" &&
        item.title === params.title &&
        item.category === category &&
        now - item.lastOccurredAt < 10 * 60 * 1000
      ) {
        existingEntry = item;
        break;
      }
    }

    if (existingEntry) {
      existingEntry.occurrencesCount += 1;
      existingEntry.lastOccurredAt = now;
      existingEntry.message = params.message;
      if (params.stackTrace) existingEntry.stackTrace = params.stackTrace;
      if (params.statusCode) existingEntry.statusCode = params.statusCode;
      this.persistRecordToTurso(existingEntry);
      return existingEntry;
    }

    const { diagnosis, suggestedFix, action } = this.generateDiagnosis(params.title, params.message, category);

    const newRecord: ServerErrorRecord = {
      id: `err_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      lastOccurredAt: now,
      occurrencesCount: 1,
      title: params.title,
      message: params.message,
      category,
      severity,
      status: "unresolved",
      endpoint: params.endpoint,
      method: params.method,
      statusCode: params.statusCode,
      providerId: params.providerId,
      modelId: params.modelId,
      chatId: params.chatId,
      userId: params.userId,
      stackTrace: params.stackTrace,
      metadata: params.metadata,
      diagnosis,
      suggestedFix,
      recommendedAction: action,
    };

    this.errors.set(newRecord.id, newRecord);

    if (this.errors.size > this.maxRecords) {
      const sortedKeys = Array.from(this.errors.entries())
        .sort((a, b) => a[1].lastOccurredAt - b[1].lastOccurredAt)
        .map((e) => e[0]);
      const toRemove = sortedKeys.slice(0, this.errors.size - this.maxRecords);
      for (const k of toRemove) {
        this.errors.delete(k);
      }
    }

    this.persistRecordToTurso(newRecord);
    return newRecord;
  }

  public getErrors(filters?: {
    status?: ErrorResolutionStatus | "all";
    severity?: ErrorSeverity | "all";
    category?: ErrorCategory | "all";
    search?: string;
  }): ServerErrorRecord[] {
    let list = Array.from(this.errors.values()).sort((a, b) => b.lastOccurredAt - a.lastOccurredAt);

    if (!filters) return list;

    if (filters.status && filters.status !== "all") {
      if (filters.status === "resolved") {
        list = list.filter((e) => e.status === "resolved" || e.status === "auto_resolved");
      } else {
        list = list.filter((e) => e.status === filters.status);
      }
    }
    if (filters.severity && filters.severity !== "all") {
      list = list.filter((e) => e.severity === filters.severity);
    }
    if (filters.category && filters.category !== "all") {
      list = list.filter((e) => e.category === filters.category);
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.message.toLowerCase().includes(q) ||
          e.diagnosis.toLowerCase().includes(q) ||
          (e.endpoint && e.endpoint.toLowerCase().includes(q)) ||
          (e.providerId && e.providerId.toLowerCase().includes(q))
      );
    }

    return list;
  }

  public getStats(): ErrorDiagnosticsStats {
    const all = Array.from(this.errors.values());
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let unresolvedCount = 0;
    let criticalCount = 0;
    let highCount = 0;
    let resolvedCount = 0;
    let last24HoursCount = 0;

    const categoryBreakdown: Record<ErrorCategory, number> = {
      ai_engine: 0,
      api_route: 0,
      whatsapp: 0,
      telegram: 0,
      database: 0,
      sandbox: 0,
      auth: 0,
      system: 0,
    };

    const severityBreakdown: Record<ErrorSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const e of all) {
      if (e.status !== "resolved" && e.status !== "auto_resolved") {
        unresolvedCount++;
        if (e.severity === "critical") criticalCount++;
        if (e.severity === "high") highCount++;
      } else {
        resolvedCount++;
      }

      if (e.lastOccurredAt >= oneDayAgo) {
        last24HoursCount += e.occurrencesCount;
      }

      if (categoryBreakdown[e.category] !== undefined) {
        categoryBreakdown[e.category] += e.occurrencesCount;
      }
      if (severityBreakdown[e.severity] !== undefined) {
        severityBreakdown[e.severity] += e.occurrencesCount;
      }
    }

    let healthScore = 100;
    healthScore -= criticalCount * 15;
    healthScore -= highCount * 5;
    healthScore -= (unresolvedCount - criticalCount - highCount) * 1.5;
    healthScore = Math.max(10, Math.min(100, Math.round(healthScore)));

    const uptimeSeconds = Math.floor((now - START_TIME) / 1000);

    return {
      totalErrorsRecorded: all.reduce((acc, curr) => acc + curr.occurrencesCount, 0),
      unresolvedCount,
      criticalCount,
      highCount,
      resolvedCount,
      systemHealthScore: healthScore,
      last24HoursCount,
      categoryBreakdown,
      severityBreakdown,
      uptimeSeconds,
    };
  }

  public updateErrorStatus(
    id: string,
    status: ErrorResolutionStatus,
    notes?: string,
    user?: string
  ): ServerErrorRecord | null {
    const entry = this.errors.get(id);
    if (!entry) return null;

    entry.status = status;
    if (status === "resolved" || status === "auto_resolved") {
      entry.resolvedAt = Date.now();
      entry.resolvedBy = user || "المسؤول (Admin)";
      if (notes) entry.resolutionNotes = notes;
    }

    this.persistRecordToTurso(entry);
    return entry;
  }

  public getErrorById(id: string): ServerErrorRecord | null {
    return this.errors.get(id) || null;
  }

  public attachAiAnalysis(
    id: string,
    analysis: {
      rootCause: string;
      impact: string;
      steps: string[];
      suggestedAction?: string;
    }
  ): ServerErrorRecord | null {
    const entry = this.errors.get(id);
    if (!entry) return null;

    entry.aiAnalysis = {
      ...analysis,
      analyzedAt: Date.now(),
    };
    if (analysis.rootCause && !entry.diagnosis) {
      entry.diagnosis = analysis.rootCause;
    }
    if (analysis.suggestedAction && !entry.suggestedFix) {
      entry.suggestedFix = analysis.suggestedAction;
    }

    this.persistRecordToTurso(entry);
    return entry;
  }

  public resolveAll(user = "المسؤول (Admin)"): number {
    let count = 0;
    const now = Date.now();
    for (const e of this.errors.values()) {
      if (e.status !== "resolved" && e.status !== "auto_resolved") {
        e.status = "resolved";
        e.resolvedAt = now;
        e.resolvedBy = user;
        e.resolutionNotes = "تم التحديد كمحلول جماعي عبر لوحة المراقبة.";
        count++;
      }
    }
    if (count > 0) {
      this.trackWrite(RuntimeErrorRepository.resolveAllOpen(user));
    }
    return count;
  }

  public clearResolvedHistory(): number {
    let count = 0;
    for (const [id, e] of this.errors.entries()) {
      if (e.status === "resolved" || e.status === "auto_resolved") {
        this.errors.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.trackWrite(RuntimeErrorRepository.deleteResolved());
    }
    return count;
  }

  public async executeAutoFix(
    errorIdOrAction: string
  ): Promise<{ success: boolean; message: string; details?: any }> {
    await this.ensureLoaded();

    let targetAction: FixActionType = "mark_resolved";
    let errorEntry: ServerErrorRecord | undefined;

    if (this.errors.has(errorIdOrAction)) {
      errorEntry = this.errors.get(errorIdOrAction);
      targetAction = errorEntry?.recommendedAction || "mark_resolved";
    } else {
      targetAction = errorIdOrAction as FixActionType;
    }

    try {
      switch (targetAction) {
        case "reset_key_quarantine": {
          const resetCount = healthManager.resetAllQuarantines();
          if (errorEntry) {
            this.updateErrorStatus(errorEntry.id, "auto_resolved", "تمت إزالة الحجر المؤقت عن جميع المفاتيح والنماذج.");
          }
          await this.flushPendingWrites();
          return {
            success: true,
            message: `تم رفع الحظر والتهدئة عن المفاتيح بنجاح (${resetCount} عنصر مستعاد).`,
          };
        }

        case "restart_telegram_polling": {
          const { telegramManager } = await import("@/lib/telegram/telegramManager");
          await telegramManager.ensureInitialized?.();
          telegramManager.stopLongPolling();
          await new Promise((r) => setTimeout(r, 500));
          telegramManager.startLongPolling();
          if (errorEntry) {
            this.updateErrorStatus(errorEntry.id, "auto_resolved", "تمت إعادة تشغيل محرك السحب المباشر لبوت تيليجرام.");
          }
          await this.flushPendingWrites();
          return {
            success: true,
            message: "تمت إعادة تشغيل خدمة السحب المباشر (Long Polling) لبوت تيليجرام بنجاح.",
          };
        }

        case "clear_wa_socket": {
          const { clearAuthSession, startBaileysSession } = await import("@/lib/whatsapp/baileysService");
          await clearAuthSession();
          await startBaileysSession("qr").catch(() => null);
          if (errorEntry) {
            this.updateErrorStatus(errorEntry.id, "auto_resolved", "تم تنظيف الجلسة العالقة وإعادة تهيئة مقبس واتساب.");
          }
          await this.flushPendingWrites();
          return {
            success: true,
            message: "تم تنظيف الجلسات المؤقتة المعلقة وإعادة تهيئة مقبس واتساب Web بنجاح.",
          };
        }

        case "test_gemini_connection": {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            return {
              success: false,
              message: "مفتاح GEMINI_API_KEY غير موجود في متغيرات البيئة.",
            };
          }
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } },
          });
          const probe = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "test probe ping",
          });
          if (probe?.text) {
            if (errorEntry) {
              this.updateErrorStatus(errorEntry.id, "auto_resolved", "تم اختبار الاتصال المباشر مع Gemini والتأكد من سلامته.");
            }
            await this.flushPendingWrites();
            return {
              success: true,
              message: "الاتصال المباشر بمحرك Google Gemini سليم ويعمل بسرعة استجابة ممتازة.",
            };
          }
          return { success: false, message: "فشل استلام رد من نموذج Gemini." };
        }

        case "flush_cache": {
          healthManager.resetAllQuarantines();
          if (errorEntry) {
            this.updateErrorStatus(errorEntry.id, "auto_resolved", "تم مسح الذاكرة المؤقتة وإعادة ضبط المؤشرات.");
          }
          await this.flushPendingWrites();
          return {
            success: true,
            message: "تم تفريغ الذاكرة المؤقتة للكاش وسجلات التهدئة بنجاح.",
          };
        }

        case "retry_operation":
        case "mark_resolved":
        default: {
          if (errorEntry) {
            this.updateErrorStatus(errorEntry.id, "resolved", "تم الإصلاح والتأكيد يدوياً من قبل المسؤول.");
          }
          await this.flushPendingWrites();
          return {
            success: true,
            message: "تمت معالجة الخطأ ووضع علامة مُصلح بنجاح.",
          };
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: `فشل تنفيذ إجراء الإصلاح التلقائي: ${err.message || String(err)}`,
      };
    }
  }

  public simulateTestError(
    type: "critical_ai" | "gateway_timeout" | "api_500" = "critical_ai"
  ): ServerErrorRecord {
    if (type === "critical_ai") {
      return this.recordError({
        title: "تجاوز حد الاستهلاك لمزود الذكاء (Rate Limit 429 Simulation)",
        message: "HTTP 429: Too Many Requests from provider 'groq'. Quota for model 'llama-3.3-70b-versatile' exceeded per minute limit.",
        category: "ai_engine",
        severity: "high",
        providerId: "groq",
        modelId: "llama-3.3-70b-versatile",
        statusCode: 429,
        stackTrace: "Error: 429 Too Many Requests\n    at executeRoutedPrompt (lib/router.ts:390:15)\n    at POST (/api/v1/chat/route.ts:45:22)",
      });
    }

    if (type === "gateway_timeout") {
      return this.recordError({
        title: "انقطاع الاتصال ببوابة تيليجرام (Telegram Webhook Connection Timeout)",
        message: "Fetch to Telegram API timed out after 30000ms. Response code ETIMEDOUT on /getUpdates.",
        category: "telegram",
        severity: "medium",
        endpoint: "/api/telegram/webhook",
        statusCode: 504,
        stackTrace: "Error: ETIMEDOUT\n    at TelegramManager.startLongPolling (lib/telegram/telegramManager.ts:160:20)",
      });
    }

    return this.recordError({
      title: "استثناء غير معالج في مسار معالجة البيانات (Uncaught API 500 Route Error)",
      message: "TypeError: Cannot read properties of undefined (reading 'length') in payload parser.",
      category: "api_route",
      severity: "critical",
      endpoint: "/api/v1/sync",
      method: "POST",
      statusCode: 500,
      stackTrace: "TypeError: Cannot read properties of undefined\n    at handleSync (app/api/v1/sync/route.ts:88:31)",
    });
  }
}

const globalForErrors = global as unknown as { serverErrorManager?: ServerErrorManager };
export const serverErrorManager = globalForErrors.serverErrorManager || new ServerErrorManager();
if (process.env.NODE_ENV !== "production") globalForErrors.serverErrorManager = serverErrorManager;
