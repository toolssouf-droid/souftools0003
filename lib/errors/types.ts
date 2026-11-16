/**
 * Server Error & Runtime Diagnostics Hub Types
 * Tracks real-time platform runtime exceptions, AI failovers, gateway issues, and self-healing actions.
 */

export type ErrorSeverity = "critical" | "high" | "medium" | "low";

export type ErrorCategory =
  | "ai_engine"
  | "api_route"
  | "whatsapp"
  | "telegram"
  | "database"
  | "sandbox"
  | "auth"
  | "system";

export type ErrorResolutionStatus = "unresolved" | "investigating" | "auto_resolved" | "resolved";

export type FixActionType =
  | "reset_key_quarantine"
  | "restart_telegram_polling"
  | "clear_wa_socket"
  | "flush_cache"
  | "test_gemini_connection"
  | "retry_operation"
  | "mark_resolved";

export interface ServerErrorRecord {
  id: string;
  timestamp: number;
  lastOccurredAt: number;
  occurrencesCount: number;
  title: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  status: ErrorResolutionStatus;
  
  // Contextual debug info
  endpoint?: string;
  method?: string;
  statusCode?: number;
  providerId?: string;
  modelId?: string;
  chatId?: string;
  userId?: string;
  stackTrace?: string;
  metadata?: Record<string, any>;

  // AI & Heuristic Diagnostics
  diagnosis: string;
  suggestedFix: string;
  recommendedAction?: FixActionType;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNotes?: string;
  aiAnalysis?: {
    rootCause: string;
    impact: string;
    steps: string[];
    suggestedAction?: string;
    analyzedAt: number;
  };
}

export interface ErrorDiagnosticsStats {
  totalErrorsRecorded: number;
  unresolvedCount: number;
  criticalCount: number;
  highCount: number;
  resolvedCount: number;
  systemHealthScore: number; // 0 to 100%
  last24HoursCount: number;
  categoryBreakdown: Record<ErrorCategory, number>;
  severityBreakdown: Record<ErrorSeverity, number>;
  uptimeSeconds: number;
}
