/**
 * SoufTools Native Sandbox - Types & Configurations
 */

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
  enabled: boolean; // default: false (Disabled / Standby by default)
  ramMb: number; // default: 500 MB
  cpuCores: number; // default: 1 Core
  diskMb: number; // default: 2048 MB (2 GB)
  timeoutMinutes: number; // default: 10 Minutes
  maxProcesses: number; // default: 50
  networkMode: "restricted" | "isolated" | "allow_safe_outbound";
  maxFileSizeMb: number; // default: 30 MB
}

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  enabled: false, // Default: Disabled / Standby
  ramMb: 500,
  cpuCores: 1,
  diskMb: 2048,
  timeoutMinutes: 10,
  maxProcesses: 50,
  networkMode: "restricted",
  maxFileSizeMb: 30,
};

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

export interface SandboxInfo {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  framework: string;
  status: SandboxStatus;
  port: number;
  previewUrl?: string;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  lastActivity: number;
  limits: SandboxLimits;
  metrics: SandboxLiveMetrics;
  errorMessage?: string;
}
