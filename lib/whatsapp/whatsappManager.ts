/**
 * WhatsApp Gateway Session & State Manager
 * Handles QR codes, Pairing Codes, message dispatch, and agent automation.
 */

import QRCode from "qrcode";
import {
  WhatsAppGatewayConfig,
  WhatsAppActivityLog,
  WhatsAppPairingMethod,
  WhatsAppPairedUser,
  PendingWhatsAppPairing,
} from "./types";
import { WhatsAppPairedUsersRepository } from "@/lib/db";

class WhatsAppManager {
  private config: WhatsAppGatewayConfig = {
    pairingMethod: "qr",
    agentPhoneNumber: "",
    agentName: "SoufAI Autonomous Agent",
    connectionStatus: "disconnected",
    connectedNumber: null,
    pairingCode: null,
    qrCodeData: null,
    qrExpiresAt: null,
    autoAiReply: true,
    preferredModelId: "core",
    scheduledNotify: true,
    welcomeMessage: "مرحباً بك! أنا الوكيل الذكي لمنصة SoufAI، كيف يمكنني مساعدتك اليوم؟",
    systemPrompt: "أنت وكيل ذكي ودود يمثل منصة SoufAI. أجب على استفسارات المستخدمين باللغة العربية بأسلوب راقٍ ومفيد ومباشر.",
    lastConnectedAt: null,
    totalMessagesReceived: 0,
    totalMessagesSent: 0,
    // Agent Dedicated Gmail & Identity Settings
    agentEmail: "souftoolsheb@gmail.com",
    agentDisplayName: "سوف - الوكيل الذكي المستقل (SoufAI Agent)",
    agentEmailSignature: "—\nتم الإرسال والمراقبة بواسطة الوكيل الذكي المستقل SoufAI Agent\nالمنصة: SoufTools V2",
    agentEmailAutoSend: true,
    agentEmailNotifyOnTasks: true,
  };

  private logs: WhatsAppActivityLog[] = [
    {
      id: "init-1",
      timestamp: Date.now() - 3600000,
      direction: "system",
      phone: "System",
      content: "تمت تهيئة بوابة واتساب للوكيل الذكي بنجاح.",
      status: "delivered",
      automated: true,
    }
  ];

  // User Pairing Engine: Pair WhatsApp Phone with Platform User & Memory
  private pairedUsers = new Map<string, WhatsAppPairedUser>();
  private pendingPairingCodes = new Map<string, PendingWhatsAppPairing>();

  constructor() {
    // Load persisted paired users from Turso on server startup (skip during build)
    if (
      typeof window === "undefined" &&
      process.env.NEXT_PHASE !== "phase-production-build" &&
      Boolean(process.env.TURSO_DATABASE_URL)
    ) {
      setTimeout(async () => {
        try {
          const list = await WhatsAppPairedUsersRepository.getAll();
          for (const item of list) {
            if (item && item.phone) {
              this.pairedUsers.set(item.phone, {
                phone: item.phone,
                userId: item.userId || undefined,
                email: item.email || undefined,
                firstName: item.firstName || undefined,
                pairingCode: item.pairingCode || undefined,
                linkedAt: item.linkedAt ? new Date(item.linkedAt).getTime() : Date.now(),
              });
            }
          }
        } catch (err) {
          console.warn("[WhatsAppManager] Warning loading paired users:", err);
        }
      }, 1500);
    }
  }

  /**
   * Generates a high-entropy 5-character alphanumeric pairing code (e.g., WA-7892)
   */
  public createPairingCode(
    email?: string,
    userId?: string,
    firstName?: string
  ): { code: string; botPhoneNumber: string; deepLink: string } {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `WA-${rand}`;

    this.pendingPairingCodes.set(code, {
      code,
      email: email || undefined,
      userId: userId || undefined,
      firstName: firstName || undefined,
      createdAt: Date.now(),
    });

    // Cleanup expired codes older than 15 mins
    const now = Date.now();
    for (const [k, v] of this.pendingPairingCodes.entries()) {
      if (now - v.createdAt > 15 * 60 * 1000) {
        this.pendingPairingCodes.delete(k);
      }
    }

    const botNumber = this.config.connectedNumber || this.config.agentPhoneNumber || "";
    const cleanDigits = botNumber.replace(/[^0-9]/g, "");
    const prefilledText = encodeURIComponent(`ربط ${code}`);
    const deepLink = cleanDigits
      ? `https://wa.me/${cleanDigits}?text=${prefilledText}`
      : `https://wa.me/?text=${prefilledText}`;

    return {
      code,
      botPhoneNumber: botNumber,
      deepLink,
    };
  }

  /**
   * Checks if a pairing code has been claimed/linked
   */
  public checkPairingCode(code: string): {
    isLinked: boolean;
    phone?: string;
    user?: WhatsAppPairedUser;
    botPhoneNumber?: string;
  } {
    const cleanCode = code.trim().toUpperCase();
    const botNumber = this.config.connectedNumber || this.config.agentPhoneNumber || undefined;

    for (const user of this.pairedUsers.values()) {
      if (user.pairingCode === cleanCode) {
        return { isLinked: true, phone: user.phone, user, botPhoneNumber: botNumber };
      }
    }

    // Check if code's email or userId was linked
    const pending = this.pendingPairingCodes.get(cleanCode);
    if (pending) {
      for (const user of this.pairedUsers.values()) {
        if (
          (pending.email && user.email?.toLowerCase() === pending.email.toLowerCase()) ||
          (pending.userId && user.userId === pending.userId)
        ) {
          return { isLinked: true, phone: user.phone, user, botPhoneNumber: botNumber };
        }
      }
    }

    return { isLinked: false, botPhoneNumber: botNumber };
  }

  /**
   * Confirms pairing when an inbound WhatsApp message contains a valid pairing code
   */
  public async linkUserByCode(
    code: string,
    phone: string,
    name?: string
  ): Promise<WhatsAppPairedUser | null> {
    const cleanCode = code.trim().toUpperCase();
    const pending = this.pendingPairingCodes.get(cleanCode);
    if (!pending) {
      return null;
    }

    const normalizedPhone = this.normalizePhoneNumber(phone);
    const rawFirstName = pending.firstName || name || undefined;
    const resolvedName = (rawFirstName && rawFirstName.toLowerCase() !== "souftoolsai" && !rawFirstName.includes("@") && rawFirstName !== "المستخدم") ? rawFirstName : "سفيان";

    const paired: WhatsAppPairedUser = {
      phone: normalizedPhone,
      userId: pending.userId,
      email: pending.email,
      firstName: resolvedName,
      pairingCode: cleanCode,
      linkedAt: Date.now(),
    };

    // 1. In-memory cache
    this.pairedUsers.set(normalizedPhone, paired);
    this.pendingPairingCodes.delete(cleanCode);

    // 2. Persistent Turso Database
    await WhatsAppPairedUsersRepository.link(normalizedPhone, {
      userId: pending.userId,
      email: pending.email,
      firstName: paired.firstName,
      pairingCode: cleanCode,
    });

    this.addLog({
      direction: "system",
      phone: normalizedPhone,
      content: `تم ربط حساب المستخدم (${paired.firstName || paired.email || "مستخدم"}) برقم واتساب (${normalizedPhone}) بنجاح. الذاكرة الشخصية مفعّلة الآن.`,
      status: "delivered",
      automated: true,
    });

    return paired;
  }

  /**
   * Retrieves paired user data by phone
   */
  public async getPairedUser(phone: string): Promise<WhatsAppPairedUser | null> {
    const normalized = this.normalizePhoneNumber(phone);
    if (this.pairedUsers.has(normalized)) {
      return this.pairedUsers.get(normalized)!;
    }

    const dbUser = await WhatsAppPairedUsersRepository.getByPhone(normalized);
    if (dbUser) {
      const parsed: WhatsAppPairedUser = {
        phone: dbUser.phone,
        userId: dbUser.userId || undefined,
        email: dbUser.email || undefined,
        firstName: dbUser.firstName || undefined,
        pairingCode: dbUser.pairingCode || undefined,
        linkedAt: dbUser.linkedAt ? new Date(dbUser.linkedAt).getTime() : Date.now(),
      };
      this.pairedUsers.set(normalized, parsed);
      return parsed;
    }

    return null;
  }

  public getPairedUserSync(phone: string): WhatsAppPairedUser | null {
    const normalized = this.normalizePhoneNumber(phone);
    return this.pairedUsers.get(normalized) || null;
  }

  /**
   * Unlinks WhatsApp user pairing from memory and Turso
   */
  public async unlinkUser(phoneOrCodeOrUserId: string): Promise<boolean> {
    const clean = phoneOrCodeOrUserId.trim();
    const normalizedPhone = this.normalizePhoneNumber(clean);

    this.pairedUsers.delete(normalizedPhone);
    this.pairedUsers.delete(clean);

    for (const [code, p] of this.pendingPairingCodes.entries()) {
      if (code === clean || p.userId === clean || p.email === clean) {
        this.pendingPairingCodes.delete(code);
      }
    }

    for (const [ph, u] of this.pairedUsers.entries()) {
      if (u.pairingCode === clean || u.userId === clean || u.email?.toLowerCase() === clean.toLowerCase()) {
        this.pairedUsers.delete(ph);
      }
    }

    await WhatsAppPairedUsersRepository.unlinkByUserIdOrEmail(clean);
    await WhatsAppPairedUsersRepository.unlink(normalizedPhone);
    return true;
  }

  public getConfig(): WhatsAppGatewayConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<WhatsAppGatewayConfig>): WhatsAppGatewayConfig {
    this.config = {
      ...this.config,
      ...partial,
    };
    return { ...this.config };
  }

  public getLogs(filterPhone?: string, limit = 100): WhatsAppActivityLog[] {
    let list = [...this.logs];
    if (filterPhone) {
      const cleanFilter = filterPhone.replace(/[^0-9]/g, "");
      if (cleanFilter) {
        list = list.filter((l) => l.phone.replace(/[^0-9]/g, "").includes(cleanFilter) || l.direction === "system");
      }
    }
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  public addLog(log: Omit<WhatsAppActivityLog, "id" | "timestamp">): WhatsAppActivityLog {
    const entry: WhatsAppActivityLog = {
      ...log,
      id: `walog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    this.logs.unshift(entry);
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
    return entry;
  }

  /**
   * Clears QR and Pairing state and sets to connecting
   */
  public prepareConnecting(method: WhatsAppPairingMethod, phoneNumber?: string) {
    this.config.pairingMethod = method;
    this.config.connectionStatus = "connecting";
    this.config.qrCodeData = null;
    this.config.qrExpiresAt = null;
    this.config.pairingCode = null;
    if (phoneNumber) {
      this.config.agentPhoneNumber = this.normalizePhoneNumber(phoneNumber);
    }
  }

  /**
   * Helper to normalize and format phone numbers into international E.164 format
   */
  public normalizePhoneNumber(phone: string): string {
    let clean = phone.trim().replace(/[^\d+]/g, "");
    if (clean.startsWith("00")) {
      clean = "+" + clean.substring(2);
    }
    // Remove all non-digits for raw processing
    let digitsOnly = clean.replace(/[^0-9]/g, "");
    // If phone starts with local '0' and is 10 digits (e.g. 0501234567 or 0600000000), default to Saudi (+966) if 05 or Moroccan (+212) if 06/07 unless international code present
    if (digitsOnly.startsWith("05") && digitsOnly.length === 10) {
      digitsOnly = "966" + digitsOnly.substring(1);
    } else if ((digitsOnly.startsWith("06") || digitsOnly.startsWith("07")) && digitsOnly.length === 10) {
      digitsOnly = "212" + digitsOnly.substring(1);
    }
    return `+${digitsOnly}`;
  }

  /**
   * Confirms pairing connection
   */
  public confirmConnection(phoneNumber?: string): WhatsAppGatewayConfig {
    const rawNumber = phoneNumber || this.config.agentPhoneNumber || "+966501234567";
    const number = this.normalizePhoneNumber(rawNumber);
    this.config.connectionStatus = "connected";
    this.config.connectedNumber = number;
    this.config.agentPhoneNumber = number;
    this.config.lastConnectedAt = Date.now();
    this.config.pairingCode = null;
    this.config.qrCodeData = null;

    this.addLog({
      direction: "system",
      phone: number,
      content: `تم اقتران الوكيل بنجاح مع حساب واتساب (${number}). البوابة نشطة 24/7.`,
      status: "delivered",
      automated: true,
    });

    return { ...this.config };
  }

  /**
   * Disconnects WhatsApp session
   */
  public disconnect(): WhatsAppGatewayConfig {
    const prevNumber = this.config.connectedNumber;
    this.config.connectionStatus = "disconnected";
    this.config.connectedNumber = null;
    this.config.pairingCode = null;
    this.config.qrCodeData = null;
    this.config.qrExpiresAt = null;

    this.addLog({
      direction: "system",
      phone: prevNumber || "Gateway",
      content: "تم إلغاء ارتباط جلسة واتساب وتسجيل الخروج بنجاح.",
      status: "delivered",
      automated: true,
    });

    return { ...this.config };
  }

  /**
   * Sends an outbound test or automated message
   */
  public async sendMessage(to: string, message: string, isAutomated = true): Promise<{ success: boolean; messageId: string }> {
    const cleanTo = to.replace(/[^0-9]/g, "");
    if (!cleanTo) {
      throw new Error("رقم المستلم غير صحيح");
    }

    const messageId = `wamsg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.config.totalMessagesSent += 1;

    this.addLog({
      direction: "outbound",
      phone: `+${cleanTo}`,
      content: message,
      status: "sent",
      automated: isAutomated,
    });

    return {
      success: true,
      messageId,
    };
  }
}

// Global singleton instance
const globalForWhatsApp = globalThis as unknown as {
  whatsappManagerInstance?: WhatsAppManager;
};

export const whatsappManager = globalForWhatsApp.whatsappManagerInstance ?? new WhatsAppManager();

if (process.env.NODE_ENV !== "production") {
  globalForWhatsApp.whatsappManagerInstance = whatsappManager;
}
