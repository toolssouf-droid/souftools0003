/**
 * SoufTools Cloud Memory Engine - Core Types
 * Defines memory classifications, lifecycle status, storage structures,
 * and context injection models for SoufAI.
 */

export type MemoryType =
  | "USER_FACT"
  | "PREFERENCE"
  | "PROJECT_CONTEXT"
  | "CONVERSATION_CONTEXT"
  | "INSTRUCTION"
  | "WORKFLOW_PREFERENCE"
  | "TOOL_PREFERENCE"
  | "PROFILE_INFORMATION"
  // Legacy compatibility mappings
  | "user"
  | "project"
  | "knowledge"
  | "preference"
  | "search"
  | "habit";

export type MemoryStatus = "active" | "archived" | "expired" | "deleted";
export type MemorySource = "user" | "auto" | "agent" | "system" | "migration";

export interface SoufAIMemory {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  importance: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  source: MemorySource;
  status: MemoryStatus;
  projectId?: string;
  projectName?: string;
  userName?: string;
  category?: string;
  tags?: string[];
  enabled: boolean;
  version: number;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
}

export interface UserProfileKnowledge {
  userId: string;
  userName?: string;
  preferredName?: string;
  primaryRole?: string;
  tonePreference?: string;
  activeProjects: Array<{
    id: string;
    name: string;
    description: string;
    techStack?: string[];
    updatedAt: number;
  }>;
  keyPreferences: string[];
  importantSearches: Array<{
    query: string;
    summary: string;
    timestamp: number;
  }>;
  totalMemoriesCount: number;
  familiarityScore: number; // 1 to 10
}

export interface MemorySettings {
  memoryEnabled: boolean;
  autoSuggest: boolean;
  autoExtract: boolean;
  maxContextItems: number;
  retentionDays?: number;
}

export interface MemoryCandidate {
  type: MemoryType;
  content: string;
  projectId?: string;
  projectName?: string;
  userName?: string;
  importance: number;
  confidence: number;
  isExplicitRequest: boolean;
  sensitive: boolean;
  reason?: string;
}

export interface MemoryContextBuildResult {
  retrievedMemories: SoufAIMemory[];
  userProfile?: UserProfileKnowledge;
  contextBlock: string;
  candidateNewMemory?: MemoryCandidate | null;
}

export interface MemoryStats {
  totalMemories: number;
  activeMemories: number;
  byType: Record<string, number>;
  lastAddedAt?: number;
  lastUsedAt?: number;
  deduplicationCount: number;
}

export interface MemorySearchFilter {
  query?: string;
  type?: MemoryType | "all";
  projectId?: string;
  status?: MemoryStatus;
  limit?: number;
  offset?: number;
}

export interface MemoryAccessLog {
  id: string;
  userId: string;
  memoryId?: string;
  action: "created" | "retrieved" | "updated" | "deleted" | "deduplicated" | "pruned" | "exported";
  promptSnippet?: string;
  relevanceScore?: number;
  metadata?: Record<string, any>;
  createdAt: number;
}
