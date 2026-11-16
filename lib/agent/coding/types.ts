/**
 * SoufAI Virtual Project Workspace & Coding Agent Engine
 * Core types, interface contracts, supported frameworks, and file models.
 */

export type SupportedFramework =
  // Frontend
  | "react"
  | "nextjs"
  | "vue"
  | "svelte"
  | "angular"
  | "vanilla_html"
  | "vanilla_ts"
  // Backend
  | "nodejs"
  | "express"
  | "python_fastapi"
  | "python_django"
  | "php"
  | "java_spring"
  | "golang"
  | "csharp_dotnet"
  // Mobile
  | "react_native"
  | "flutter"
  // Generic / Custom
  | "custom";

export interface ProjectFile {
  path: string; // e.g. "src/components/Header.tsx"
  content: string;
  language?: string;
  updatedAt?: number;
  lastModified?: number;
  isReadOnly?: boolean;
}

export type WorkspaceFile = ProjectFile;

export interface ProjectErrorItem {
  id: string;
  filePath?: string;
  line?: number;
  column?: number;
  message: string;
  severity: "error" | "warning" | "info";
  source?: "build" | "runtime" | "lint" | "agent";
  suggestedFix?: string;
  resolved?: boolean;
  timestamp: number;
}

export interface ProjectCheckpoint {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  filesSnapshot: Record<string, string>; // path -> content
  activeFilePath?: string;
}

export interface TerminalLogItem {
  id: string;
  text: string;
  type: "stdout" | "stderr" | "info" | "success" | "command" | "error";
  timestamp: number;
}

export interface AgentCodingStep {
  id: string;
  type:
    | "plan"
    | "analyze"
    | "create_file"
    | "edit_file"
    | "delete_file"
    | "run_command"
    | "install_dep"
    | "inspect_errors"
    | "fix_error"
    | "test"
    | "preview_update"
    | "checkpoint";
  title: string;
  details?: string;
  targetFile?: string;
  command?: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: number;
  durationMs?: number;
}

export interface ProjectWorkspace {
  id: string;
  title: string;
  description?: string;
  framework: SupportedFramework;
  files: Record<string, ProjectFile>; // key is path
  activeFilePath: string | null;
  openFilePaths: string[];
  checkpoints: ProjectCheckpoint[];
  errors: ProjectErrorItem[];
  terminalLogs: TerminalLogItem[];
  agentSteps: AgentCodingStep[];
  isPreviewRunning: boolean;
  previewUrl?: string;
  createdAt: number;
  updatedAt: number;
  isDirty?: boolean;
}

export interface FrameworkPreset {
  id: SupportedFramework;
  name: string;
  category: "frontend" | "backend" | "mobile" | "fullstack";
  iconName: string;
  color: string;
  description: string;
  initialFiles: Record<string, string>;
  entryFile: string;
  buildRunner: (files: Record<string, string>) => {
    previewHtml?: string;
    bundleErrors?: ProjectErrorItem[];
  };
}
