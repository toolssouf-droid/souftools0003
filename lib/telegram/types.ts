/**
 * Telegram Bot & Autonomous Gateway Types
 */

export type TelegramConnectionStatus = "disconnected" | "connected" | "error" | "validating";

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramGatewayConfig {
  botToken: string;
  botUsername: string;
  botDisplayName: string;
  connectionStatus: TelegramConnectionStatus;
  webhookUrl: string;
  webhookActive: boolean;
  webhookSecretToken?: string;
  autoAiReply: boolean;
  defaultModel: string;
  temperature: number;
  welcomeMessage: string;
  systemPrompt: string;
  sendTypingAction: boolean;
  enableVoiceReplies: boolean;
  enableImageGeneration: boolean;
  allowedChatIds: string[]; // empty means allow all
  adminChatId?: string;
  lastConnectedAt: number | null;
  totalMessagesReceived: number;
  totalMessagesSent: number;
  lastError: string | null;
}

export interface TelegramActivityLog {
  id: string;
  timestamp: number;
  direction: "inbound" | "outbound" | "system";
  chatId: string;
  username?: string;
  senderName?: string;
  content: string;
  messageType: "text" | "command" | "photo" | "voice" | "audio" | "document" | "system";
  status: "sent" | "delivered" | "received" | "failed";
  modelUsed?: string;
  latencyMs?: number;
}

export interface TelegramChatMessage {
  id: string;
  role: "user" | "model" | "system";
  sender: "user" | "assistant";
  content: string;
  timestamp: number;
  source?: "telegram" | "web";
  messageType?: "text" | "command" | "photo" | "voice" | "audio" | "document";
}

export interface TelegramChatSession {
  id: string; // e.g. "tg_chat_<chatId>"
  chatId: string;
  senderName: string;
  username?: string;
  title: string;
  source: "telegram";
  channel: "telegram";
  isTelegram: boolean;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  pairedUserId?: string;
  pairedEmail?: string;
  messages: TelegramChatMessage[];
}
