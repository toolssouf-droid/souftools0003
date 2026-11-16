/**
 * SoufTools Native Sandbox & Runtime Manager - Types & Configurations
 */

export type SandboxProviderId = "native_sandbox" | "e2b" | "webcontainer" | "docker";

export type SandboxStatus =
  | "created"
  | "starting"
  | "running"
  | "active"
  | "idle"
  | "stopping"
  | "stopped"
  | "failed"
  | "expired";

export interface SandboxLimits {
  enabled?: boolean; // default: false (Disabled / Standby)
  ramMb: number; // default: 500 MB
  cpuCores: number; // default: 1 Core
  diskMb: number; // default: 2048 MB (2 GB)
  timeoutMinutes: number; // default: 10 Minutes
  maxProcesses: number; // default: 50
  networkMode: "restricted" | "isolated" | "allow_safe_outbound";
  maxFileSizeMb: number; // default: 30 MB
}

export interface SandboxLiveMetrics {
  ramUsageMb: number;
  ramLimitMb: number;
  cpuUsagePercent: number;
  diskUsageMb: number;
  diskLimitMb: number;
  processCount: number;
  maxProcesses: number;
  durationSeconds: number;
  timeoutSeconds: number;
  networkStatus: "restricted" | "isolated" | "active";
}

export interface SandboxResources {
  cpu: string;
  memory: string;
  disk: string;
  activeTimeSeconds?: number;
  processCount?: number;
  networkMode?: string;
}

export interface SandboxSession {
  sessionId: string;
  userId: string;
  projectId: string;
  projectName: string;
  framework: string;
  provider: SandboxProviderId;
  status: SandboxStatus;
  previewUrl?: string;
  port: number;
  createdAt: number;
  lastActivity: number;
  resources: SandboxResources;
  savedFilesSnapshot?: Record<string, string>;
  error?: string;
  limits?: SandboxLimits;
  metrics?: SandboxLiveMetrics;
  pid?: number;
}

export interface SandboxCreateOptions {
  userId: string;
  projectId: string;
  projectName: string;
  framework: string;
  files: Record<string, string>;
  port?: number;
  timeoutMs?: number;
  limits?: Partial<SandboxLimits>;
}

export interface SandboxExecutionResponse {
  success: boolean;
  sessionId?: string;
  previewUrl?: string;
  status: SandboxStatus;
  provider: SandboxProviderId;
  message?: string;
  error?: string;
  resources?: SandboxResources;
  latencyMs?: number;
  metrics?: SandboxLiveMetrics;
}

export interface RuntimeProviderConfig {
  provider: SandboxProviderId;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  isCloudSandbox: boolean;
}

export interface RuntimeKeyItem {
  id: string;
  provider: SandboxProviderId;
  key: string;
  label?: string;
  status: "active" | "testing" | "failed";
  failures: number;
  createdAt: number;
  lastUsed?: number;
  latencyMs?: number;
  lastError?: string;
  maskedKey?: string;
  hasRealKey?: boolean;
}

export interface RuntimeSettings {
  autoCleanupMinutes: number;
  idleTimeoutMs: number;
  defaultProvider: SandboxProviderId;
  saveStateBeforeStop: boolean;
  enableHealthCheck: boolean;
  limits?: SandboxLimits;
}

export interface RuntimeLogItem {
  id?: string;
  event:
    | "sandbox_create"
    | "sandbox_start"
    | "sandbox_stop"
    | "sandbox_restart"
    | "sandbox_expired"
    | "sandbox_cleanup"
    | "key_rotation"
    | "failover"
    | "health_check"
    | "auto_cleanup"
    | "command_exec"
    | "limit_violation"
    | "error";
  provider: SandboxProviderId;
  success: boolean;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  latencyMs?: number;
  details?: string;
  error?: string;
}

export interface KeyTestResult {
  valid: boolean;
  latencyMs: number;
  message: string;
  quotaRemaining?: string;
  keyId?: string;
  testedAt?: number;
}

