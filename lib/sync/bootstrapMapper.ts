import type { ChatMessage, ChatSession } from "@/store/chatStore";

interface BootstrapConversation {
  id: string;
  title: string;
  modelId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface BootstrapMessage {
  id: string;
  sender: string;
  content: string;
  createdAt: string | Date;
  reasoning?: string | null;
  sources?: ChatMessage["sources"];
}

interface BootstrapBody {
  sync?: { cursor?: string | null };
  conversations?: BootstrapConversation[];
  activeConversationId?: string | null;
  initialMessages?: BootstrapMessage[];
  preferences?: {
    defaultModelId?: string | null;
    webSearchEnabled?: boolean;
  } | null;
  devices?: unknown[];
  notifications?: { unreadCount?: number };
}

export interface SyncBootstrapSnapshot {
  cursor: string | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  preferences: BootstrapBody["preferences"];
  activeDevicesCount: number;
  unreadNotifications: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mapSyncBootstrapResponse(response: unknown): SyncBootstrapSnapshot {
  if (!isRecord(response) || response.success !== true || !isRecord(response.data)) {
    const message = isRecord(response) && typeof response.message === "string"
      ? response.message
      : "Bootstrap error";
    throw new Error(message);
  }

  const body = response.data as BootstrapBody;
  const conversations = Array.isArray(body.conversations) ? body.conversations : [];
  const initialMessages = Array.isArray(body.initialMessages) ? body.initialMessages : [];
  const sessions: ChatSession[] = conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    modelId: (conversation.modelId || "spark") as ChatSession["modelId"],
    createdAt: new Date(conversation.createdAt).getTime(),
    updatedAt: new Date(conversation.updatedAt).getTime(),
    messages: [],
  }));
  const activeSessionId =
    body.activeConversationId && sessions.some((session) => session.id === body.activeConversationId)
      ? body.activeConversationId
      : sessions[0]?.id || null;
  const messages: ChatMessage[] = initialMessages.map((message) => ({
    id: message.id,
    role: message.sender === "user" ? "user" : "model",
    content: message.content,
    timestamp: new Date(message.createdAt).getTime(),
    reasoningSteps: message.reasoning ? [message.reasoning] : undefined,
    sources: message.sources || [],
  }));

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  if (activeSession) activeSession.messages = messages;

  return {
    cursor: body.sync?.cursor || null,
    sessions,
    activeSessionId,
    messages,
    preferences: body.preferences || null,
    activeDevicesCount: Array.isArray(body.devices) ? body.devices.length : 1,
    unreadNotifications: body.notifications?.unreadCount || 0,
  };
}
