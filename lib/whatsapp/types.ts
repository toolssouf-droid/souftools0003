/**
 * WhatsApp Gateway & Autonomous Agent Integration Types
 */

export type WhatsAppConnectionStatus = "disconnected" | "connecting" | "waiting_scan" | "connected";

export type WhatsAppPairingMethod = "qr" | "code";

export interface WhatsAppGatewayConfig {
  pairingMethod: WhatsAppPairingMethod;
  agentPhoneNumber: string;
  agentName: string;
  connectionStatus: WhatsAppConnectionStatus;
  connectedNumber: string | null;
  pairingCode: string | null;
  qrCodeData: string | null;
  qrExpiresAt: number | null;
  autoAiReply: boolean;
  preferredModelId?: string;
  scheduledNotify: boolean;
  welcomeMessage: string;
  systemPrompt: string;
  lastConnectedAt: number | null;
  totalMessagesReceived: number;
  totalMessagesSent: number;
  // Session Persistence Status
  hasPersistentSession?: boolean;
  storageType?: "turso" | "postgresql" | "memory";
  // Agent Dedicated Gmail & Identity Settings
  agentEmail: string;
  agentDisplayName: string;
  agentEmailSignature: string;
  agentEmailAutoSend: boolean;
  agentEmailNotifyOnTasks: boolean;
}

export interface WhatsAppActivityLog {
  id: string;
  timestamp: number;
  direction: "inbound" | "outbound" | "system";
  phone: string;
  content: string;
  status: "sent" | "delivered" | "received" | "failed";
  automated: boolean;
}

export interface WhatsAppPairedUser {
  phone: string; // E.164 (e.g. +966501234567)
  userId?: string;
  email?: string;
  firstName?: string;
  pairingCode?: string;
  linkedAt: number;
}

export interface PendingWhatsAppPairing {
  code: string;
  userId?: string;
  email?: string;
  firstName?: string;
  createdAt: number;
}
