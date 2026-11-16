/**
 * SoufTools Enterprise Analytics Type Definitions
 * Complete type contracts for 12 comprehensive analytical modules,
 * live telemetry streams, time range filtering, and CSV/JSON export formats.
 */

export type AnalyticsTimeRange = "today" | "7d" | "30d" | "90d" | "custom";

export interface TimeRangeParams {
  range: AnalyticsTimeRange;
  startDate?: string;
  endDate?: string;
}

export interface MetricComparison {
  current: number;
  previous: number;
  growthPct: number; // e.g. +14.5 or -3.2
  trend: "up" | "down" | "flat";
}

// -------------------------------------------------------------
// A) OVERVIEW METRICS
// -------------------------------------------------------------
export interface OverviewMetrics {
  totalUsers: MetricComparison;
  activeUsers: MetricComparison;
  onlineUsers: number;
  dau: MetricComparison;
  wau: MetricComparison;
  mau: MetricComparison;
  newUsers: MetricComparison;
  sessions: MetricComparison;
  messages: MetricComparison;
  conversations: MetricComparison;
  agentTasks: MetricComparison;
  toolCalls: MetricComparison;
  fileUploads: MetricComparison;
  imageGenerations: MetricComparison;
  webSearches: MetricComparison;
  apiRequests: MetricComparison;
  promptTokens: MetricComparison;
  completionTokens: MetricComparison;
  totalTokens: MetricComparison;
  successRate: MetricComparison; // in %
  errorRate: MetricComparison; // in %
  avgLatencyMs: MetricComparison;
  p95LatencyMs: MetricComparison;
  serverUptimeSeconds: number;
  serverUptimeFormatted: string;
  activityTimeSeries: {
    timestamp: string;
    label: string;
    requests: number;
    messages: number;
    agentTasks: number;
    errors: number;
  }[];
  peakRequestsPerHour: number;
  minRequestsPerHour: number;
  avgRequestsPerHour: number;
}

// -------------------------------------------------------------
// B) USERS METRICS
// -------------------------------------------------------------
export interface UserCohort {
  cohortDate: string;
  cohortSize: number;
  d1Retention: number; // %
  d7Retention: number; // %
  d30Retention: number; // %
}

export interface UserLifecycleMetrics {
  newUsers: number;
  activeUsers: number;
  returningUsers: number;
  dormantUsers: number;
  churnRatePct: number;
  avgSessionDurationSeconds: number;
  avgMessagesPerSession: number;
}

export interface UsersMetrics {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  returningUsers: number;
  dau: number;
  wau: number;
  mau: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
  cohorts: UserCohort[];
  registrationTrend: { date: string; count: number }[];
  activeUsersTrend: { date: string; count: number }[];
  distributionByCountry: { country: string; code: string; count: number; percentage: number }[];
  distributionByLanguage: { language: string; name: string; count: number; percentage: number }[];
  distributionByDevice: { device: "desktop" | "mobile" | "tablet"; count: number; percentage: number }[];
  distributionByBrowser: { browser: string; count: number; percentage: number }[];
  distributionByOS: { os: string; count: number; percentage: number }[];
  lifecycle: UserLifecycleMetrics;
  recentActiveUsers: {
    id: string;
    email: string;
    name?: string;
    lastActiveAt: string;
    sessionsCount: number;
    messagesCount: number;
    storageUsedMb: number;
  }[];
}

// -------------------------------------------------------------
// C) SOUFAI METRICS
// -------------------------------------------------------------
export interface SoufAIMetrics {
  totalConversations: number;
  totalMessages: number;
  totalAgentTasks: number;
  routingDistribution: {
    direct: { count: number; percentage: number };
    tool: { count: number; percentage: number };
    agent: { count: number; percentage: number };
  };
  totalToolCalls: number;
  totalAgentSteps: number;
  avgStepsPerTask: number;
  avgResponseTimeMs: number;
  p95LatencyMs: number;
  modelBreakdown: {
    modelId: string;
    modelName: string;
    provider: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    avgLatencyMs: number;
    percentage: number;
  }[];
  providerBreakdown: {
    providerId: string;
    providerName: string;
    requests: number;
    percentage: number;
    status: "active" | "degraded" | "inactive";
  }[];
  tokensIn: number;
  tokensOut: number;
  successCount: number;
  failureCount: number;
  successRatePct: number;
  errorClassification: {
    type: string;
    count: number;
    percentage: number;
    description: string;
  }[];
  mostUsedCapabilities: {
    capability: string;
    name: string;
    count: number;
    percentage: number;
  }[];
  conversationTimeSeries: {
    date: string;
    conversations: number;
    messages: number;
    agentSteps: number;
  }[];
}

// -------------------------------------------------------------
// D) TOOLS METRICS
// -------------------------------------------------------------
export interface ToolItemMetric {
  toolId: string;
  toolName: string;
  category: string;
  requests: number;
  uniqueUsers: number;
  successCount: number;
  failedCount: number;
  successRate: number; // in %
  errorRate: number; // in %
  avgLatencyMs: number;
  p95LatencyMs: number;
  trend: { date: string; count: number }[];
}

export interface ToolsMetrics {
  totalToolCalls: number;
  uniqueToolUsers: number;
  overallSuccessRate: number;
  overallAvgLatencyMs: number;
  tools: ToolItemMetric[];
  topTools: { toolId: string; toolName: string; requests: number; sharePct: number }[];
  leastUsedTools: { toolId: string; toolName: string; requests: number }[];
  usageTrend: { date: string; [toolName: string]: any }[];
}

// -------------------------------------------------------------
// E) WEB RESEARCH METRICS
// -------------------------------------------------------------
export interface WebResearchMetrics {
  totalSearches: number;
  uniqueQueries: number;
  openedSources: number;
  readPagesCount: number;
  extractedSourcesCount: number;
  avgResearchDurationMs: number;
  successCount: number;
  failureCount: number;
  successRatePct: number;
  topDomains: { domain: string; count: number; percentage: number }[];
  researchTrends: {
    date: string;
    searches: number;
    sourcesExtracted: number;
    avgDurationMs: number;
  }[];
  recentSearchQueries: {
    query: string;
    provider: string;
    sourcesCount: number;
    durationMs: number;
    timestamp: string;
  }[];
}

// -------------------------------------------------------------
// F) IMAGE / VISION METRICS
// -------------------------------------------------------------
export interface ImageVisionMetrics {
  generatedImages: number;
  editedImages: number;
  visionRequests: number;
  ocrRequests: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRatePct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  providerModelBreakdown: {
    provider: string;
    model: string;
    count: number;
    avgLatencyMs: number;
    successRatePct: number;
  }[];
  usageTrend: {
    date: string;
    generated: number;
    edited: number;
    vision: number;
    ocr: number;
  }[];
}

// -------------------------------------------------------------
// G) CODING / SANDBOX METRICS
// -------------------------------------------------------------
export interface CodingSandboxMetrics {
  totalProjects: number;
  activeSandboxes: number;
  completedSandboxes: number;
  totalSandboxesCreated: number;
  avgCpuUsagePct: number;
  avgMemoryUsageMb: number;
  totalDiskUsageMb: number;
  avgRuntimeDurationSeconds: number;
  totalCommandsExecuted: number;
  totalBuildsTriggered: number;
  totalTestsRun: number;
  totalPreviewSessions: number;
  crashesCount: number;
  timeoutsCount: number;
  sandboxSecurityEventsCount: number;
  securityIncidents: {
    id: string;
    type: string;
    description: string;
    severity: "low" | "medium" | "high";
    timestamp: string;
    actionTaken: string;
  }[];
  runtimeTimeSeries: {
    timestamp: string;
    activeSandboxes: number;
    cpuPct: number;
    memoryMb: number;
  }[];
}

// -------------------------------------------------------------
// H) INFRASTRUCTURE METRICS
// -------------------------------------------------------------
export interface InfrastructureMetrics {
  serverCpuPct: number;
  serverMemoryUsedMb: number;
  serverMemoryTotalMb: number;
  serverMemoryUsagePct: number;
  serverDiskUsedMb: number;
  serverDiskTotalMb: number;
  serverDiskUsagePct: number;
  networkRxBytes: number;
  networkTxBytes: number;
  requestsPerSec: number;
  apiLatencyMs: number;
  p95ApiLatencyMs: number;
  totalErrorsCount: number;
  errorRatePct: number;
  postgresHealth: "healthy" | "degraded" | "unreachable";
  postgresVersion: string;
  dbConnectionsActive: number;
  dbConnectionsMax: number;
  dbLatencyMs: number;
  dbSizeBytes: number;
  activeWorkersCount: number;
  queuePendingJobs: number;
  queueCompletedJobs: number;
  queueFailedJobs: number;
  objectStorageHealth: "healthy" | "warning" | "error";
  objectStorageUsedBytes: number;
  uptimeSeconds: number;
  uptimeFormatted: string;
  healthChecks: {
    service: string;
    status: "healthy" | "warning" | "error";
    latencyMs: number;
    lastCheckedAt: string;
  }[];
  telemetryTimeSeries: {
    timestamp: string;
    cpu: number;
    memory: number;
    reqPerSec: number;
    dbLatency: number;
  }[];
}

// -------------------------------------------------------------
// I) SECURITY METRICS (Zero Secrets Exposed)
// -------------------------------------------------------------
export interface SecurityMetrics {
  failedLoginsCount: number;
  rateLimitEventsCount: number;
  blockedRequestsCount: number;
  csrfFailuresCount: number;
  ssrfBlocksCount: number;
  invalidSessionsTokensCount: number;
  suspiciousEventsCount: number;
  adminActionsCount: number;
  sandboxSecurityEventsCount: number;
  activeBannedIPsCount?: number;
  topAttackerTool?: string;
  topAttackVector?: string;
  hackerIncidents?: Array<{
    id: string;
    ip: string;
    ipSanitized: string;
    country: string;
    countryCode: string;
    city?: string;
    isVpnOrTor: boolean;
    asnOrIsp?: string;
    deviceType: string;
    os: string;
    browserEngine: string;
    architecture: string;
    rawUserAgent: string;
    attackerTool: {
      name: string;
      category: string;
      confidence: number;
      matchedSignature: string;
    };
    attackVector: string;
    targetEndpoint: string;
    httpMethod: string;
    payloadSample: string;
    payloadLocation: string;
    severity: "low" | "medium" | "high" | "critical";
    actionTaken: string;
    status: "active_ban" | "flagged" | "mitigated";
    timestamp: string;
    hitsCount: number;
  }>;
  bannedIPsList?: Array<{
    ip: string;
    reason: string;
    bannedAt: string;
    bannedBy: string;
    attackVector: string;
    toolDetected?: string;
    hitsBlocked: number;
  }>;
  securityEventsLog: {
    id: string;
    eventType: string;
    severity: "low" | "medium" | "high" | "critical";
    ipAddressSanitized: string;
    action: string;
    reason: string;
    timestamp: string;
  }[];
  adminAuditLog: {
    id: string;
    adminEmail: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    timestamp: string;
  }[];
  threatLevel: "normal" | "elevated" | "high";
}

// -------------------------------------------------------------
// J) STORAGE METRICS
// -------------------------------------------------------------
export interface StorageMetrics {
  totalStorageBytes: number;
  totalStorageFormatted: string;
  totalFilesCount: number;
  storageByCategory: {
    category: "image" | "video" | "document" | "code" | "archive" | "audio" | "other";
    name: string;
    sizeBytes: number;
    formattedSize: string;
    fileCount: number;
    percentage: number;
  }[];
  userFilesCount: number;
  objectCount: number;
  uploadBandwidthBytes: number;
  downloadBandwidthBytes: number;
  databaseSizeBytes: number;
  databaseSizeFormatted: string;
  storageGrowthTrend: {
    date: string;
    totalBytes: number;
    fileCount: number;
  }[];
}

// -------------------------------------------------------------
// K) PRODUCT / BEHAVIOR ANALYTICS
// -------------------------------------------------------------
export interface ProductBehaviorMetrics {
  mostVisitedPages: { path: string; title: string; views: number; uniqueVisitors: number }[];
  mostUsedFeatures: { featureKey: string; name: string; uses: number; adoptionRatePct: number }[];
  featureAdoptionRate: { featureName: string; category: string; adoptionPct: number }[];
  userJourney: {
    step: number;
    name: string;
    userCount: number;
    conversionRatePct: number;
    dropoffRatePct: number;
  }[];
  avgTimeToFirstMessageSeconds: number;
  registrationToFirstActionSeconds: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
  dropOffPoints: { step: string; dropOffCount: number; dropOffPct: number }[];
  topCapabilities: { capability: string; name: string; count: number }[];
}

// -------------------------------------------------------------
// L) API / MODEL USAGE METRICS
// -------------------------------------------------------------
export interface ModelUsageDetail {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorCount: number;
  successRatePct: number;
  rateLimitEventsCount: number;
  costEstimateUsd: number;
}

export interface ModelUsageMetrics {
  totalApiRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  overallAvgLatencyMs: number;
  overallSuccessRatePct: number;
  totalCostEstimateUsd: number;
  models: ModelUsageDetail[];
  providerSummary: {
    providerId: string;
    name: string;
    requests: number;
    tokens: number;
    sharePct: number;
    errors: number;
  }[];
  usagePerUser: {
    userId: string;
    email: string;
    requests: number;
    tokens: number;
  }[];
  rateLimitTimeSeries: {
    date: string;
    rateLimitHits: number;
  }[];
}

// -------------------------------------------------------------
// LIVE REAL-TIME METRICS (SSE / Real-time Poll)
// -------------------------------------------------------------
export type ModelApiUsageMetrics = ModelUsageMetrics;

export interface LiveSystemPulse {
  timestamp: string;
  onlineUsers: number;
  requestsPerSec: number;
  activeAgentTasks: number;
  activeSandboxes: number;
  serverCpuPct: number;
  serverMemoryMb: number;
  serverMemoryPct: number;
  queueLength: number;
  activeWorkers: number;
  apiLatencyMs: number;
  errorRatePct: number;
  dbLatencyMs: number;
  dbHealth: "healthy" | "degraded" | "down";
}
