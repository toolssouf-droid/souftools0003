/**
 * SoufBehavior Engine - Data Contracts & Types
 * Local-First User Behavior & Personalization System for SoufTools
 */

export type BehaviorEventType =
  | "session_started"
  | "session_ended"
  | "tool_opened"
  | "tool_used"
  | "tool_completed"
  | "tool_failed"
  | "search_started"
  | "search_completed"
  | "file_uploaded"
  | "image_generated"
  | "image_edited"
  | "code_task_started"
  | "code_task_completed"
  | "preview_started"
  | "preview_closed"
  | "suggestion_clicked"
  | "model_selected"
  | "conversation_started"
  | "launch_intent_selected"
  | "onboarding_completed";

export type BehaviorPrivacyMode = "personalized" | "basic" | "off";
export type PreferredEntryMode = "launch" | "chat";

export interface BehaviorEvent {
  id: string;
  type: BehaviorEventType;
  timestamp: number;
  toolName?: string;
  status?: "success" | "failed";
  metadata?: Record<string, any>;
}

export interface UserBehaviorProfile {
  version: number;
  profileUpdatedAt: number;
  privacyMode: BehaviorPrivacyMode;
  sessions: number;
  completedTasks: number;
  failedTasks: number;
  favoriteTools: string[];
  recentTools: string[];
  preferredModes: string[];
  commonIntents: string[];
  launchChoices: string[];
  onboardingCompleted: boolean;
  returningUser: boolean;
  preferredEntry: PreferredEntryMode;
  lastActiveSession?: {
    id: string;
    title: string;
    updatedAt: number;
    modelId: string;
  } | null;
  tools: {
    webSearch: number;
    coding: number;
    imageGeneration: number;
    imageEditing: number;
    files: number;
    translation: number;
    calculator: number;
    agentMode?: number;
    dataAnalytics?: number;
    [toolName: string]: number | undefined;
  };
  usagePatterns: {
    frequentTools: string[];
    frequentWorkflows: string[];
    completionRate: number; // 0 to 1
  };
  preferences: {
    preferredInterfaceMode?: string;
    frequentlyUsedTools: string[];
  };
  lastSyncAt: number;
  unsyncedCount: number;
}

export interface BehaviorContextForAI {
  topTools: string[];
  commonWorkflow?: string;
  recentFeature?: string;
  completionRate?: number;
  preferredModes?: string[];
  launchChoices?: string[];
}

export interface SmartSuggestion {
  id: string;
  title: string;
  description: string;
  actionType: "tool_open" | "prompt_insert" | "workflow_run";
  actionPayload: any;
  iconName?: string;
}

export interface QuickIntentItem {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  badge?: string;
  defaultPrompt?: string;
  activeTools: string[];
  modelId?: string;
  workflowType: "research" | "coding" | "image" | "file" | "data" | "agent";
}

export interface SmartLaunchSuggestion {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: "research" | "coding" | "image" | "data" | "agent" | "resume" | "file";
  prompt: string;
  activeTools: string[];
  modelId?: string;
  highlight?: boolean;
}

export interface GreetingInfo {
  title: string;
  subtitle: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  isReturning: boolean;
  topContextSnippet?: string;
}
