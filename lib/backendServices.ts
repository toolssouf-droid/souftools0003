/**
 * SoufTools Cloud & Turso Backend Service Layer
 * Seamlessly routes sessions, admin configurations, and user behavior
 * to the SoufTools Turso Database via API v1 routes.
 */

import { authClient } from "./auth/authClient";
import { getAuthCookie } from "./authCookies";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  messages: any[];
  source?: "web" | "telegram";
  channel?: "web" | "telegram";
  isTelegram?: boolean;
  telegramChatId?: string;
  telegramUsername?: string;
  telegramSender?: string;
}

function getAuthHeaders(userId?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
  const activeUserId = userId || cookieData?.userId;
  const activeUserEmail = cookieData?.email;

  if (activeUserId) {
    headers["x-user-id"] = activeUserId;
  }
  if (activeUserEmail) {
    headers["x-user-email"] = activeUserEmail;
  }
  return headers;
}

// ==========================================
// 1. Chat Sessions Turso Backend Service
// ==========================================

export async function saveSessionToCloud(userId: string, session: ChatSession): Promise<void> {
  const activeUserId = userId || "default_user";
  if (!session?.id) return;
  try {
    await fetch("/api/v1/chat/sessions", {
      method: "POST",
      headers: getAuthHeaders(activeUserId),
      body: JSON.stringify({ session }),
    });
  } catch (error) {
    // Non-blocking background save
  }
}

export async function deleteSessionFromCloud(userId: string, sessionId: string): Promise<void> {
  const activeUserId = userId || "default_user";
  if (!sessionId) return;
  try {
    await fetch(`/api/v1/chat/sessions/${sessionId}`, {
      method: "DELETE",
      headers: getAuthHeaders(activeUserId),
    });
  } catch (error) {
    // Non-blocking background delete
  }
}

export async function getUserSessionsFromCloud(userId: string): Promise<ChatSession[]> {
  const activeUserId = userId || "default_user";
  try {
    const res = await fetch("/api/v1/chat/sessions", {
      method: "GET",
      headers: getAuthHeaders(activeUserId),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch (error) {
    return [];
  }
}

export function subscribeToUserSessions(
  userId: string,
  onUpdate: (sessions: ChatSession[]) => void
) {
  if (!userId) return () => {};

  // Fetch immediately
  getUserSessionsFromCloud(userId).then(onUpdate);

  // Polling interval
  const interval = setInterval(async () => {
    const sessions = await getUserSessionsFromCloud(userId);
    if (sessions.length > 0) {
      onUpdate(sessions);
    }
  }, 15000);

  return () => clearInterval(interval);
}

// ==========================================
// 2. Admin Config & Keys Turso Storage Service
// ==========================================

export async function saveAdminConfigToCloud(
  modelProviders?: any,
  keys?: any,
  activeModelTiers?: string[],
  selectedAgentModel?: string,
  toolsConfig?: any,
  toolsStats?: any,
  platformSupportEmail?: string
): Promise<boolean> {
  try {
    const payload: any = {};
    if (modelProviders !== undefined) payload.modelProviders = modelProviders;
    if (keys !== undefined) payload.keys = keys;
    if (activeModelTiers !== undefined) payload.activeModelTiers = activeModelTiers;
    if (selectedAgentModel !== undefined) payload.selectedAgentModel = selectedAgentModel;
    if (toolsConfig !== undefined) payload.toolsConfig = toolsConfig;
    if (toolsStats !== undefined) payload.toolsStats = toolsStats;
    if (platformSupportEmail !== undefined) payload.platformSupportEmail = platformSupportEmail;

    const res = await fetch("/api/v1/admin/settings", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ settings: payload }),
    });
    return res.ok;
  } catch (error) {
    return false;
  }
}

export async function getAdminConfigFromCloud(): Promise<{
  modelProviders?: any;
  keys?: any;
  activeModelTiers?: string[];
  selectedAgentModel?: string;
  toolsConfig?: any;
  toolsStats?: any;
  platformSupportEmail?: string;
} | null> {
  try {
    const res = await fetch("/api/v1/admin/settings", {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.settings || null;
  } catch (error) {
    return null;
  }
}

// ==========================================
// 3. SoufBehavior Engine Turso Storage Service
// ==========================================

export async function saveBehaviorProfileToCloud(
  userId: string,
  profile: any
): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await fetch("/api/v1/behavior", {
      method: "POST",
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ profile }),
    });
    return res.ok;
  } catch (error) {
    return false;
  }
}

export async function getBehaviorProfileFromCloud(userId: string): Promise<any | null> {
  if (!userId) return null;
  try {
    const res = await fetch("/api/v1/behavior", {
      method: "GET",
      headers: getAuthHeaders(userId),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.profile || null;
  } catch (error) {
    return null;
  }
}

export async function deleteBehaviorProfileFromCloud(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await fetch("/api/v1/behavior", {
      method: "POST",
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ profile: {} }),
    });
    return res.ok;
  } catch (error) {
    return false;
  }
}

// Backward-compatible named aliases
export const saveSessionToFirestore = saveSessionToCloud;
export const deleteSessionFromFirestore = deleteSessionFromCloud;
export const getUserSessionsFromFirestore = getUserSessionsFromCloud;
export const saveAdminConfigToFirestore = saveAdminConfigToCloud;
export const getAdminConfigFromFirestore = getAdminConfigFromCloud;
export const saveBehaviorProfileToFirestore = saveBehaviorProfileToCloud;
export const getBehaviorProfileFromFirestore = getBehaviorProfileFromCloud;
export const deleteBehaviorProfileFromFirestore = deleteBehaviorProfileFromCloud;
