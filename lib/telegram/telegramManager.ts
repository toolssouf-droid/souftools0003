/**
 * Telegram Bot Server Manager & Telegram API Client
 * Connects Telegram Bot with SoufAI Models, Webhook Management, Long Polling, and Dispatching.
 */

import fs from "fs";
import path from "path";
import { TelegramGatewayConfig, TelegramActivityLog, TelegramBotInfo, TelegramChatSession, TelegramChatMessage } from "./types";
import { executeRoutedPrompt } from "@/lib/router";
import { SettingsRepository, MemoryRepository, ConversationRepository, ScheduledTaskRepository, UserLearningRepository, TelegramRepository } from "@/lib/db";
import { encryptKey, decryptKey } from "@/lib/encryption";
import { AdaptiveLearningEngine } from "@/lib/learning/adaptiveLearningEngine";
import { GoogleGenAI } from "@google/genai";
import { serverErrorManager } from "@/lib/errors/errorManager";
import { runAgentRuntime } from "@/lib/agent/agentRuntime";
import { GoogleDriveService } from "@/lib/drive/googleDriveService";
import { executeRawSearchQuery } from "@/lib/agent/webResearchAgent";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { getCurrentTimeInfo, convertTimeInfo } from "@/lib/tools/timeEngine";
import { generateImageViaManager } from "@/lib/providers/imageProviderManager";
import { globalToolRegistry } from "@/lib/agent/tools/toolRegistry";
import { buildMemoryContext } from "@/lib/memory/contextBuilder";
import { saveUserMemory, getUserProfileKnowledge } from "@/lib/memory/memoryService";
import { terminalLogger } from "@/lib/logger/terminalLogger";

const TELEGRAM_CONFIG_DIR = path.join(process.cwd(), "data");
const TELEGRAM_CONFIG_FILE = path.join(TELEGRAM_CONFIG_DIR, "telegram_gateway_config.json");
const TELEGRAM_CONVERSATIONS_FILE = path.join(TELEGRAM_CONFIG_DIR, "telegram_conversations.json");
const TELEGRAM_PAIRED_USERS_FILE = path.join(TELEGRAM_CONFIG_DIR, "telegram_paired_users.json");
const TELEGRAM_GMAIL_TOKENS_FILE = path.join(TELEGRAM_CONFIG_DIR, "telegram_gmail_tokens.json");
const TELEGRAM_DRIVE_TOKENS_FILE = path.join(TELEGRAM_CONFIG_DIR, "telegram_drive_tokens.json");

export interface TelegramPairedUser {
  chatId: string | number;
  userId?: string;
  email?: string;
  firstName?: string;
  username?: string;
  linkedAt: number;
}

export interface TelegramGmailTokenEntry {
  chatId: string | number;
  userId?: string;
  email?: string;
  accessToken: string;
  updatedAt: number;
}

export interface TelegramDriveTokenEntry {
  chatId: string | number;
  userId?: string;
  email?: string;
  accessToken: string;
  updatedAt: number;
}

interface PendingPairing {
  code: string;
  email?: string;
  userId?: string;
  createdAt: number;
}

class TelegramManager {
  private config: TelegramGatewayConfig = {
    botToken: "",
    botUsername: "",
    botDisplayName: "SoufAI Assistant Bot",
    connectionStatus: "disconnected",
    webhookUrl: "",
    webhookActive: false,
    autoAiReply: true,
    defaultModel: "spark",
    temperature: 0.7,
    welcomeMessage: "مرحباً بك! أنا مساعد SoufAI الذكي عبر تيليجرام. أرسل لي أي سؤال أو فكرة وسأجيبك فوراً.",
    systemPrompt: "أنت مساعد ذكي ومتطور يمثل منصة SoufTools (SoufAI). تجيب دائماً باللغة العربية الفصحى بأسلوب راقٍ ومفيد ودقيق ومباشر. تدعم شرح الأكواد، تحليل الأفكار، وحل المشكلات ببراعة وسرعة.",
    sendTypingAction: true,
    enableVoiceReplies: false,
    enableImageGeneration: true,
    allowedChatIds: [],
    adminChatId: "",
    lastConnectedAt: null,
    totalMessagesReceived: 0,
    totalMessagesSent: 0,
    lastError: null,
  };

  private logs: TelegramActivityLog[] = [
    {
      id: "tg-init-1",
      timestamp: Date.now() - 1800000,
      direction: "system",
      chatId: "System",
      content: "تمت تهيئة وحدة ربط بوت تيليجرام (Telegram Gateway) ومحرك نماذج SoufAI بنجاح.",
      messageType: "system",
      status: "delivered",
    },
  ];

  private isPolling = false;
  private lastUpdateId = 0;
  private pollingAbortController: AbortController | null = null;
  // In-memory conversation context per chat (rolling last 12 messages)
  private chatHistories = new Map<string | number, { role: "user" | "model"; content: string }[]>();
  private telegramSessions = new Map<string, TelegramChatSession>();

  // User Pairing Engine: Pair Telegram Chat with Platform User & Memory
  private pairedUsers = new Map<string, TelegramPairedUser>();
  private pendingPairingCodes = new Map<string, PendingPairing>();
  private userGmailTokens = new Map<string, TelegramGmailTokenEntry>();
  private userDriveTokens = new Map<string, TelegramDriveTokenEntry>();
  private rateLimits = new Map<string, number[]>();
  private serverBaseUrl: string | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private pendingWrites: Set<Promise<any>> = new Set();

  private trackWrite<T>(promise: Promise<T>): Promise<T> {
    this.pendingWrites.add(promise);
    promise.finally(() => this.pendingWrites.delete(promise)).catch(() => {});
    return promise;
  }

  public async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) return;
    await Promise.allSettled(Array.from(this.pendingWrites));
  }

  public setServerBaseUrl(url: string) {
    if (url && typeof url === "string" && url.startsWith("http")) {
      const clean = url.replace(/\/+$/, "");
      if (this.serverBaseUrl !== clean) {
        this.serverBaseUrl = clean;
      }
    }
  }

  public getBaseUrl(): string {
    if (this.serverBaseUrl) {
      return this.serverBaseUrl;
    }
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/+$/, "");
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
    }
    return "https://souftools.com";
  }

  public createServiceKey(chatId: string | number, service: "GMAIL" | "DRIVE" | "SOUF" = "SOUF"): string {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `${service}-${rand}`;
    this.pendingPairingCodes.set(code, {
      code,
      createdAt: Date.now(),
      ...({ chatId: String(chatId) } as any),
    });
    this.persistPendingPairingCodes();
    return code;
  }

  public resolveChatIdFromKey(keyOrChatId: string | number): string {
    const target = String(keyOrChatId || "").trim();
    if (!target) return target;
    const clean = target.toUpperCase();

    // Direct match in pairedUsers, userGmailTokens, userDriveTokens or numeric Chat ID
    if (
      this.pairedUsers.has(target) ||
      this.userGmailTokens.has(target) ||
      this.userDriveTokens.has(target) ||
      /^\d+$/.test(target)
    ) {
      return target;
    }

    // Check pending pairing codes / service keys
    const pending = this.pendingPairingCodes.get(clean);
    if (pending) {
      if ((pending as any).chatId) return String((pending as any).chatId);
      for (const paired of this.pairedUsers.values()) {
        if (
          (paired as any).pairingCode === clean ||
          paired.email === pending.email ||
          paired.userId === pending.userId
        ) {
          return String(paired.chatId);
        }
      }
    }

    // Search pendingPairingCodes entries for matching chatId property
    for (const [code, val] of this.pendingPairingCodes.entries()) {
      if (code === clean && (val as any).chatId) {
        return String((val as any).chatId);
      }
    }

    // Search by email or userId
    for (const user of this.pairedUsers.values()) {
      if (user.email && user.email.toLowerCase() === target.toLowerCase()) {
        return String(user.chatId);
      }
      if (user.userId && user.userId === target) {
        return String(user.chatId);
      }
    }

    return target;
  }

  constructor() {
    if (typeof window === "undefined") {
      const isBuildPhase =
        process.env.NEXT_PHASE === "phase-production-build" ||
        process.env.NEXT_PHASE === "phase-export" ||
        process.env.npm_lifecycle_event === "build" ||
        process.env.NEXT_RUNTIME === "edge";

      if (!isBuildPhase) {
        setTimeout(async () => {
          await this.ensureInitialized().catch(() => null);
          if (this.config.botToken) {
            if (this.config.connectionStatus !== "connected") {
              await this.verifyToken(this.config.botToken).catch(() => null);
            } else if (!this.config.webhookActive && !this.isPolling) {
              this.startLongPolling();
            }
          }
        }, 1500);
      }
    }
  }

  /**
   * Idempotently hydrates Telegram configuration, paired users, encrypted OAuth tokens,
   * pending pairing codes, and chat sessions exclusively from Turso.
   * Performs one-time read-only import from legacy JSON files if Turso has no records yet.
   */
  public async ensureInitialized(forceReload = false): Promise<void> {
    if (this.initialized && !forceReload) return;
    if (this.initPromise && !forceReload) return this.initPromise;

    const task = (async () => {
      try {
        // 1. Gateway config
        const dbConf = await SettingsRepository.getSetting<any>("telegram_gateway_config");
        if (dbConf && typeof dbConf === "object") {
          const restored = { ...dbConf };
          if (restored.botToken && typeof restored.botToken === "string") {
            restored.botToken = decryptKey(restored.botToken);
          }
          this.config = { ...this.config, ...restored };
        } else if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
          try {
            const raw = fs.readFileSync(TELEGRAM_CONFIG_FILE, "utf-8");
            if (raw && raw.trim()) {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                this.config = { ...this.config, ...parsed };
                await this.saveConfigToTurso();
              }
            }
          } catch {}
        }

        if (!this.config.botToken && process.env.TELEGRAM_BOT_TOKEN) {
          this.config.botToken = process.env.TELEGRAM_BOT_TOKEN.trim();
        }

        // 2. Paired Users (from Turso `telegram_paired_users`)
        let dbPaired = await TelegramRepository.listPairedUsers();
        if ((!dbPaired || dbPaired.length === 0)) {
          const legacySettingsPaired = await SettingsRepository.getSetting<TelegramPairedUser[]>("telegram_paired_users");
          const legacyDiskPaired =
            !legacySettingsPaired && fs.existsSync(TELEGRAM_PAIRED_USERS_FILE)
              ? (JSON.parse(fs.readFileSync(TELEGRAM_PAIRED_USERS_FILE, "utf-8")) as TelegramPairedUser[])
              : null;
          const toImport = Array.isArray(legacySettingsPaired)
            ? legacySettingsPaired
            : Array.isArray(legacyDiskPaired)
              ? legacyDiskPaired
              : [];
          for (const p of toImport) {
            if (p && p.chatId) {
              await TelegramRepository.linkUser({
                chatId: String(p.chatId),
                userId: p.userId || (p.email ? `user_${p.email}` : `tg_${p.chatId}`),
                email: p.email || null,
                username: p.username || null,
                firstName: p.firstName || null,
                pairingCode: (p as any).pairingCode || null,
              }).catch(() => null);
            }
          }
          dbPaired = await TelegramRepository.listPairedUsers();
        }
        this.pairedUsers.clear();
        for (const p of dbPaired) {
          if (p && p.chatId) {
            this.pairedUsers.set(String(p.chatId), {
              chatId: p.chatId,
              userId: p.userId,
              email: p.email || undefined,
              firstName: p.firstName || undefined,
              username: p.username || undefined,
              linkedAt: p.linkedAt instanceof Date ? p.linkedAt.getTime() : Number(p.linkedAt || Date.now()),
              ...({ pairingCode: p.pairingCode || undefined } as any),
            });
          }
        }

        // 3. Gmail encrypted OAuth tokens (`telegram_oauth_tokens`)
        let dbGmail = await TelegramRepository.listOAuthTokens("gmail");
        if ((!dbGmail || dbGmail.length === 0)) {
          const legacyGmail = await SettingsRepository.getSetting<TelegramGmailTokenEntry[]>("telegram_gmail_tokens");
          const diskGmail =
            !legacyGmail && fs.existsSync(TELEGRAM_GMAIL_TOKENS_FILE)
              ? (JSON.parse(fs.readFileSync(TELEGRAM_GMAIL_TOKENS_FILE, "utf-8")) as TelegramGmailTokenEntry[])
              : null;
          const toImport = Array.isArray(legacyGmail) ? legacyGmail : Array.isArray(diskGmail) ? diskGmail : [];
          for (const g of toImport) {
            if (g && g.chatId && g.accessToken) {
              await TelegramRepository.setOAuthToken({
                chatId: String(g.chatId),
                service: "gmail",
                accessToken: decryptKey(g.accessToken),
                email: g.email || null,
              }).catch(() => null);
            }
          }
          dbGmail = await TelegramRepository.listOAuthTokens("gmail");
        }
        this.userGmailTokens.clear();
        for (const g of dbGmail) {
          this.userGmailTokens.set(String(g.chatId), {
            chatId: String(g.chatId),
            accessToken: g.accessToken,
            email: g.email,
            updatedAt: Date.parse(g.connectedAt || "") || Date.now(),
          });
        }

        // 4. Drive encrypted OAuth tokens (`telegram_oauth_tokens`)
        let dbDrive = await TelegramRepository.listOAuthTokens("drive");
        if ((!dbDrive || dbDrive.length === 0)) {
          const legacyDrive = await SettingsRepository.getSetting<TelegramDriveTokenEntry[]>("telegram_drive_tokens");
          const diskDrive =
            !legacyDrive && fs.existsSync(TELEGRAM_DRIVE_TOKENS_FILE)
              ? (JSON.parse(fs.readFileSync(TELEGRAM_DRIVE_TOKENS_FILE, "utf-8")) as TelegramDriveTokenEntry[])
              : null;
          const toImport = Array.isArray(legacyDrive) ? legacyDrive : Array.isArray(diskDrive) ? diskDrive : [];
          for (const d of toImport) {
            if (d && d.chatId && d.accessToken) {
              await TelegramRepository.setOAuthToken({
                chatId: String(d.chatId),
                service: "drive",
                accessToken: decryptKey(d.accessToken),
                email: d.email || null,
              }).catch(() => null);
            }
          }
          dbDrive = await TelegramRepository.listOAuthTokens("drive");
        }
        this.userDriveTokens.clear();
        for (const d of dbDrive) {
          this.userDriveTokens.set(String(d.chatId), {
            chatId: String(d.chatId),
            accessToken: d.accessToken,
            email: d.email,
            updatedAt: Date.parse(d.connectedAt || "") || Date.now(),
          });
        }

        // 5. Conversations (`telegram_conversations_v1`)
        let dbConv = await SettingsRepository.getSetting<TelegramChatSession[]>("telegram_conversations_v1");
        if ((!Array.isArray(dbConv) || dbConv.length === 0) && fs.existsSync(TELEGRAM_CONVERSATIONS_FILE)) {
          try {
            const raw = fs.readFileSync(TELEGRAM_CONVERSATIONS_FILE, "utf-8");
            if (raw && raw.trim()) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                dbConv = parsed;
                await SettingsRepository.setSetting("telegram_conversations_v1", dbConv, false);
              }
            }
          } catch {}
        }
        this.telegramSessions.clear();
        if (Array.isArray(dbConv)) {
          for (const c of dbConv) {
            if (c && c.id) {
              this.telegramSessions.set(c.id, c);
              if (c.chatId) this.telegramSessions.set(`tg_${c.chatId}`, c);
            }
          }
        }

        // 6. Pending Pairing / Service Keys
        const dbPending = await SettingsRepository.getSetting<any[]>("telegram_pending_pairing_codes");
        if (Array.isArray(dbPending)) {
          const now = Date.now();
          for (const p of dbPending) {
            if (p && p.code && now - (p.createdAt || 0) <= 15 * 60 * 1000) {
              this.pendingPairingCodes.set(p.code, p);
            }
          }
        }

        this.initialized = true;
      } catch (err) {
        console.warn("[TelegramManager] Initialization note:", err);
      } finally {
        this.initPromise = null;
      }
    })();

    this.initPromise = task;
    return task;
  }

  private persistPendingPairingCodes() {
    const now = Date.now();
    for (const [k, v] of this.pendingPairingCodes.entries()) {
      if (now - v.createdAt > 15 * 60 * 1000) {
        this.pendingPairingCodes.delete(k);
      }
    }
    const list = Array.from(this.pendingPairingCodes.values());
    this.trackWrite(SettingsRepository.setSetting("telegram_pending_pairing_codes", list, false).catch(() => null));
  }

  private async saveConfigToTurso() {
    const payload = {
      ...this.config,
      botToken: this.config.botToken ? encryptKey(this.config.botToken) : "",
    };
    await SettingsRepository.setSetting("telegram_gateway_config", payload, true);
  }

  public async setGmailToken(
    chatId: string | number,
    accessToken: string,
    email?: string,
    userId?: string,
    notifyUser = false
  ) {
    await this.ensureInitialized();
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    const entry: TelegramGmailTokenEntry = {
      chatId: resolvedChatId,
      accessToken,
      email: email || undefined,
      userId: userId || undefined,
      updatedAt: Date.now(),
    };

    this.userGmailTokens.set(resolvedChatId, entry);
    await TelegramRepository.setOAuthToken({
      chatId: resolvedChatId,
      service: "gmail",
      accessToken,
      email: email || null,
    });

    if (email) {
      for (const paired of this.pairedUsers.values()) {
        if (paired.email === email && String(paired.chatId) !== resolvedChatId) {
          const siblingChat = String(paired.chatId);
          this.userGmailTokens.set(siblingChat, { ...entry, chatId: siblingChat });
          await TelegramRepository.setOAuthToken({
            chatId: siblingChat,
            service: "gmail",
            accessToken,
            email,
          }).catch(() => null);
        }
      }
    }

    if (notifyUser) {
      const notifyMsg = `🎉 **تم ربط حسابك في Gmail بنجاح مع بوت تيليجرام!**\n\n📧 **البريد المرتبط:** \`${email || "حساب Google"}\`\n\n💡 **القدرات المتاحة لك الآن:**\n• *"فحص الجيميل"* أو *"اقرأ رسائلي غير المقروءة"*\n• *"ابحث في الإيميل عن فواتير أو رسائل معينة"*\n• *"إرسال بريد إلكتروني إلى name@domain.com"*\n\nأرسل لي أي استفسار بخصوص بريدك وسأقوم بإنجازه فوراً! 🚀`;
      await this.sendMessage(resolvedChatId, notifyMsg);
    }
  }

  public getGmailToken(chatId: string | number): string | null {
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    const entry = this.userGmailTokens.get(resolvedChatId);
    if (entry?.accessToken) return entry.accessToken;

    const paired = this.getPairedUser(resolvedChatId);
    if (paired?.email) {
      for (const v of this.userGmailTokens.values()) {
        if (v.email === paired.email && v.accessToken) {
          return v.accessToken;
        }
      }
    }

    return null;
  }

  public getGmailDetails(chatId: string | number): TelegramGmailTokenEntry | null {
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    const entry = this.userGmailTokens.get(resolvedChatId);
    if (entry) return entry;

    const paired = this.getPairedUser(resolvedChatId);
    if (paired?.email) {
      for (const v of this.userGmailTokens.values()) {
        if (v.email === paired.email) {
          return v;
        }
      }
    }

    return null;
  }

  public disconnectGmail(chatId: string | number): boolean {
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    if (this.userGmailTokens.has(resolvedChatId)) {
      this.userGmailTokens.delete(resolvedChatId);
      this.trackWrite(TelegramRepository.deleteOAuthToken(resolvedChatId, "gmail"));
      return true;
    }
    return false;
  }

  public async setDriveToken(
    chatId: string | number,
    accessToken: string,
    email?: string,
    userId?: string,
    notifyUser = false
  ) {
    await this.ensureInitialized();
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    const entry: TelegramDriveTokenEntry = {
      chatId: resolvedChatId,
      accessToken,
      email: email || undefined,
      userId: userId || undefined,
      updatedAt: Date.now(),
    };

    this.userDriveTokens.set(resolvedChatId, entry);
    await TelegramRepository.setOAuthToken({
      chatId: resolvedChatId,
      service: "drive",
      accessToken,
      email: email || null,
    });

    if (email) {
      for (const paired of this.pairedUsers.values()) {
        if (paired.email === email && String(paired.chatId) !== resolvedChatId) {
          const siblingChat = String(paired.chatId);
          this.userDriveTokens.set(siblingChat, { ...entry, chatId: siblingChat });
          await TelegramRepository.setOAuthToken({
            chatId: siblingChat,
            service: "drive",
            accessToken,
            email,
          }).catch(() => null);
        }
      }
    }

    if (notifyUser) {
      const notifyMsg = `🎉 **تم ربط حسابك في Google Drive بنجاح مع بوت تيليجرام!**\n\n📁 **الحساب المرتبط:** \`${email || "Google Drive"}\`\n\n🧠 **التكامل الذكي مفعل الآن:**\n• يمكنك إرسال *"فحص مستندات درايف"* أو *"ابحث في درايف عن [كلمة]"*\n• يمكنك إرسال أي رابط **Google Docs** وستتم قراءته ومزامنته مع **ذاكرتك الشخصية** تلقائياً.\n• يمكنك السؤال عن محتوى ملفاتك في أي وقت وسيستحضر الـ AI الإجابات بدقة. 🚀`;
      await this.sendMessage(resolvedChatId, notifyMsg);
    }
  }

  public getDriveToken(chatId: string | number): string | null {
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    const entry = this.userDriveTokens.get(resolvedChatId);
    if (entry?.accessToken) return entry.accessToken;

    const paired = this.getPairedUser(resolvedChatId);
    if (paired?.email) {
      for (const v of this.userDriveTokens.values()) {
        if (v.email === paired.email && v.accessToken) {
          return v.accessToken;
        }
      }
    }

    return null;
  }

  public getDriveDetails(chatId: string | number): TelegramDriveTokenEntry | null {
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    const entry = this.userDriveTokens.get(resolvedChatId);
    if (entry) return entry;

    const paired = this.getPairedUser(resolvedChatId);
    if (paired?.email) {
      for (const v of this.userDriveTokens.values()) {
        if (v.email === paired.email) {
          return v;
        }
      }
    }

    return null;
  }

  public disconnectDrive(chatId: string | number): boolean {
    const resolvedChatId = this.resolveChatIdFromKey(chatId) || String(chatId);
    if (this.userDriveTokens.has(resolvedChatId)) {
      this.userDriveTokens.delete(resolvedChatId);
      this.trackWrite(TelegramRepository.deleteOAuthToken(resolvedChatId, "drive"));
      return true;
    }
    return false;
  }

  private persistConversations() {
    try {
      const mapById = new Map<string, TelegramChatSession>();
      for (const sess of this.telegramSessions.values()) {
        mapById.set(sess.id, sess);
      }
      const list = Array.from(mapById.values());
      this.trackWrite(SettingsRepository.setSetting("telegram_conversations_v1", list, false).catch(() => null));
    } catch (err) {
      console.warn("Could not save telegram conversations to Turso:", err);
    }
  }

  /**
   * Record a message turn in Telegram chat history, persisting it for the sidebar & web views
   */
  public recordTelegramTurn(
    chatId: string | number,
    sender: string,
    username: string | undefined,
    userText: string,
    botReply: string,
    pairedUser?: TelegramPairedUser | null
  ): TelegramChatSession {
    const sChatId = String(chatId);
    const isDiagnosticProbe =
      sChatId === "admin_diagnostic_channel" ||
      sChatId === "admin_test" ||
      username === "admin_diagnostic";
    if (isDiagnosticProbe) {
      return {
        id: `tg_${sChatId}`,
        chatId: sChatId,
        senderName: sender || "المسؤول (فحص تشخيصي)",
        username: username || "admin_diagnostic",
        title: "محادثة تشخيصية مؤقتة",
        source: "telegram",
        channel: "telegram",
        isTelegram: true,
        modelId: this.config.defaultModel || "spark",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
    }
    const sessionId = `tg_${sChatId}`;
    const now = Date.now();

    let session = this.telegramSessions.get(sessionId) || this.telegramSessions.get(sChatId);

    const userMsg: TelegramChatMessage = {
      id: `tg_msg_u_${now}_${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      sender: "user",
      content: userText || "[رسالة من تيليجرام]",
      timestamp: now,
      source: "telegram",
    };

    const botMsg: TelegramChatMessage = {
      id: `tg_msg_m_${now + 10}_${Math.random().toString(36).slice(2, 6)}`,
      role: "model",
      sender: "assistant",
      content: botReply || "",
      timestamp: now + 10,
      source: "telegram",
    };

    const displayName = sender ? (username ? `${sender} (@${username})` : sender) : (username ? `@${username}` : `المستخدم (${sChatId})`);

    if (!session) {
      session = {
        id: sessionId,
        chatId: sChatId,
        senderName: sender || "مستخدم تيليجرام",
        username: username || "",
        title: `محادثة تيليجرام: ${displayName}`,
        source: "telegram",
        channel: "telegram",
        isTelegram: true,
        modelId: this.config.defaultModel || "spark",
        createdAt: now,
        updatedAt: now,
        pairedUserId: pairedUser?.userId,
        pairedEmail: pairedUser?.email,
        messages: [userMsg, botMsg],
      };
    } else {
      session.senderName = sender || session.senderName;
      if (username) session.username = username;
      session.title = `محادثة تيليجرام: ${displayName}`;
      session.updatedAt = now;
      if (pairedUser?.userId) session.pairedUserId = pairedUser.userId;
      if (pairedUser?.email) session.pairedEmail = pairedUser.email;
      session.messages.push(userMsg, botMsg);
      if (session.messages.length > 80) {
        session.messages = session.messages.slice(-80);
      }
    }

    this.telegramSessions.set(sessionId, session);
    this.telegramSessions.set(sChatId, session);
    this.persistConversations();

    // Persist to ConversationRepository using isolated per-chat or paired user identity
    const canonicalUserId = pairedUser?.userId || (pairedUser?.email ? `user_${pairedUser.email}` : sessionId);
    this.trackWrite(
      ConversationRepository.saveConversation(canonicalUserId, {
        id: sessionId,
        title: session.title,
        modelId: session.modelId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          sender: m.sender,
          content: m.content,
          timestamp: m.timestamp,
          createdAt: m.timestamp,
          source: "telegram",
        })),
      }).catch(() => null)
    );

    // Broadcast sync event to live clients
    recordSyncEvent({
      userId: canonicalUserId,
      entityType: "conversation",
      entityId: sessionId,
      operation: "updated",
      payload: session,
      deviceId: null,
    }).catch(() => null);

    return session;
  }

  /**
   * Sync and record a web message turn into a Telegram session when continuing the chat on the web platform
   */
  public recordWebTurnOnTelegramSession(
    sessionId: string,
    userText: string,
    botReply: string,
    userId?: string
  ): TelegramChatSession | null {
    if (!sessionId) return null;
    const cleanId = sessionId;
    const chatId = cleanId.startsWith("tg_") ? cleanId.replace("tg_", "") : cleanId;
    let session = this.telegramSessions.get(cleanId) || this.telegramSessions.get(`tg_${chatId}`) || this.telegramSessions.get(chatId);

    const now = Date.now();
    const userMsg: TelegramChatMessage = {
      id: `web_msg_u_${now}_${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      sender: "user",
      content: userText,
      timestamp: now,
      source: "web",
    };

    const botMsg: TelegramChatMessage = {
      id: `web_msg_m_${now + 10}_${Math.random().toString(36).slice(2, 6)}`,
      role: "model",
      sender: "assistant",
      content: botReply,
      timestamp: now + 10,
      source: "web",
    };

    if (session) {
      session.updatedAt = now;
      session.messages.push(userMsg, botMsg);
      if (session.messages.length > 100) {
        session.messages = session.messages.slice(-100);
      }
      this.telegramSessions.set(session.id, session);
      if (session.chatId) {
        this.telegramSessions.set(`tg_${session.chatId}`, session);
        this.telegramSessions.set(session.chatId, session);

        // Also update memory in Telegram cache so that future messages sent on Telegram know this web conversation context!
        const existingHist = this.chatHistories.get(session.chatId) || [];
        existingHist.push({ role: "user", content: `[رسالة من المنصة]: ${userText}` });
        existingHist.push({ role: "model", content: botReply });
        this.chatHistories.set(session.chatId, existingHist.slice(-14));
      }
      this.persistConversations();

      const canonicalUserId = userId || session.pairedUserId || (session.pairedEmail ? `user_${session.pairedEmail}` : session.id);
      this.trackWrite(
        ConversationRepository.saveConversation(canonicalUserId, {
          id: session.id,
          title: session.title,
          modelId: session.modelId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messages: session.messages.map((m) => ({
            id: m.id,
            role: m.role,
            sender: m.sender,
            content: m.content,
            timestamp: m.timestamp,
            createdAt: m.timestamp,
            source: m.source || "web",
          })),
        }).catch(() => null)
      );

      recordSyncEvent({
        userId: canonicalUserId,
        entityType: "conversation",
        entityId: session.id,
        operation: "updated",
        payload: session,
        deviceId: null,
      }).catch(() => null);

      return session;
    }

    return null;
  }

  /**
   * Retrieve all Telegram conversation sessions accessible to the user/admin
   */
  public getTelegramSessions(userId?: string | null, userEmail?: string | null): TelegramChatSession[] {
    const mapById = new Map<string, TelegramChatSession>();
    for (const sess of this.telegramSessions.values()) {
      mapById.set(sess.id, sess);
    }
    const all = Array.from(mapById.values());

    const cleanEmail = (userEmail || "").trim().toLowerCase();
    const isAdmin = cleanEmail === "toolssouf@gmail.com" || cleanEmail === "souftoolsheb@gmail.com" || (cleanEmail ? isUserAdmin(cleanEmail) : false);

    // If verified admin, return all Telegram sessions for platform monitoring
    if (isAdmin) {
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    // Security & Privacy Guard: Unauthenticated requests or requests without user identity MUST receive empty list
    if (!userId && !cleanEmail) {
      return [];
    }

    // Filter sessions strictly belonging to this authenticated user
    const filtered = all.filter((s) => {
      if (s.pairedUserId && userId && s.pairedUserId === userId) return true;
      if (s.pairedEmail && cleanEmail && s.pairedEmail.toLowerCase() === cleanEmail) return true;
      return false;
    });

    // Also check pairedUsers map for matching user
    for (const paired of this.pairedUsers.values()) {
      if (
        (paired.userId && userId && paired.userId === userId) ||
        (paired.email && cleanEmail && paired.email.toLowerCase() === cleanEmail)
      ) {
        const sess = this.telegramSessions.get(`tg_${paired.chatId}`);
        if (sess && !filtered.some((f) => f.id === sess.id)) {
          filtered.push(sess);
        }
      }
    }

    // Strictly return ONLY the user's own filtered sessions
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get a single Telegram session by ID or chatId
   */
  public getTelegramSession(sessionIdOrChatId: string): TelegramChatSession | null {
    const clean = String(sessionIdOrChatId);
    const idWithPrefix = clean.startsWith("tg_") ? clean : `tg_${clean}`;
    const rawChatId = clean.replace(/^tg_/, "");
    return this.telegramSessions.get(idWithPrefix) || this.telegramSessions.get(rawChatId) || null;
  }

  /**
   * Delete a Telegram conversation session
   */
  public async deleteTelegramSession(sessionIdOrChatId: string): Promise<boolean> {
    await this.ensureInitialized();
    const clean = String(sessionIdOrChatId);
    const idWithPrefix = clean.startsWith("tg_") ? clean : `tg_${clean}`;
    const rawChatId = clean.replace(/^tg_/, "");

    const deleted = this.telegramSessions.delete(idWithPrefix) || this.telegramSessions.delete(rawChatId);
    this.chatHistories.delete(rawChatId);
    this.chatHistories.delete(idWithPrefix);
    this.persistConversations();

    await ConversationRepository.delete(idWithPrefix).catch(() => null);
    await ConversationRepository.delete(rawChatId).catch(() => null);
    await this.flushPendingWrites();

    return deleted;
  }

  /**
   * Send a reply message from the web UI to the Telegram user
   */
  public async sendTelegramReplyFromWeb(chatId: string | number, text: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    const sChatId = String(chatId).replace(/^tg_/, "");
    const res = await this.sendMessage(sChatId, text);
    if (!res.success) {
      return { success: false, error: res.error || "فشل إرسال الرسالة إلى تيليجرام" };
    }

    const now = Date.now();
    const botMsg: TelegramChatMessage = {
      id: `tg_msg_web_${now}_${Math.random().toString(36).slice(2, 6)}`,
      role: "model",
      sender: "assistant",
      content: text,
      timestamp: now,
      source: "telegram",
    };

    const session = this.telegramSessions.get(`tg_${sChatId}`) || this.telegramSessions.get(sChatId);
    if (session) {
      session.messages.push(botMsg);
      session.updatedAt = now;
      this.persistConversations();
      await this.flushPendingWrites();
    }

    return { success: true };
  }


  /**
   * Create a new temporary pairing code for the web client
   */
  public createPairingCode(email?: string, userId?: string): { code: string; botUsername: string; deepLink: string } {
    // Generate high-entropy code: SOUF-XXXX-XXXX (8 characters entropy)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let part1 = "";
    let part2 = "";
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `SOUF-${part1}-${part2}`;

    this.pendingPairingCodes.set(code, {
      code,
      email: email || undefined,
      userId: userId || undefined,
      createdAt: Date.now(),
    });

    this.persistPendingPairingCodes();

    const botUser = this.config.botUsername || "SoufToolsBot";
    const deepLink = `https://t.me/${botUser}?start=${code}`;

    return {
      code,
      botUsername: botUser,
      deepLink,
    };
  }

  /**
   * Check if a pairing code was redeemed
   */
  public checkPairingCode(code: string): { isLinked: boolean; user?: TelegramPairedUser; botUsername?: string } {
    const normalized = code.trim().toUpperCase();
    for (const user of this.pairedUsers.values()) {
      // Find if any linked user matches
      if (this.pendingPairingCodes.get(normalized)?.email === user.email || this.pendingPairingCodes.get(normalized)?.userId === user.userId) {
        return { isLinked: true, user, botUsername: this.config.botUsername };
      }
    }

    // Check if code was directly linked to a chatId
    for (const user of this.pairedUsers.values()) {
      if ((user as any).pairingCode === normalized) {
        return { isLinked: true, user, botUsername: this.config.botUsername };
      }
    }

    return { isLinked: false, botUsername: this.config.botUsername };
  }

  /**
   * Link user using pairing code
   */
  public linkUserByCode(code: string, chatId: string | number, username?: string, firstName?: string): TelegramPairedUser | null {
    const cleanCode = code.trim().toUpperCase().replace("/START", "").replace("/LINK", "").trim();
    if (!cleanCode) return null;

    const pending = this.pendingPairingCodes.get(cleanCode);
    if (!pending) {
      // Strictly reject invalid, ungenerated, or expired codes
      return null;
    }

    const rawFirstName = firstName || undefined;
    const resolvedName = (rawFirstName && rawFirstName.toLowerCase() !== "souftoolsai" && !rawFirstName.includes("@") && rawFirstName !== "المستخدم") ? rawFirstName : "سفيان";

    const paired: TelegramPairedUser = {
      chatId: String(chatId),
      userId: pending.userId || (pending.email ? `user_${pending.email}` : `tg_${chatId}`),
      email: pending.email,
      firstName: resolvedName,
      username: username || undefined,
      linkedAt: Date.now(),
      ...({ pairingCode: cleanCode } as any),
    };

    this.pairedUsers.set(String(chatId), paired);
    this.pendingPairingCodes.delete(cleanCode);
    this.persistPendingPairingCodes();
    this.trackWrite(
      TelegramRepository.linkUser({
        chatId: String(chatId),
        userId: paired.userId || `tg_${chatId}`,
        email: paired.email || null,
        username: paired.username || null,
        firstName: paired.firstName || null,
        pairingCode: cleanCode,
      }).catch(() => null)
    );

    const existingSession = this.telegramSessions.get(`tg_${chatId}`);
    if (existingSession) {
      existingSession.pairedUserId = paired.userId;
      existingSession.pairedEmail = paired.email;
      this.persistConversations();
    }

    return paired;
  }

  /**
   * Unlink a user by chatId or code
   */
  public unlinkUser(chatIdOrCode: string | number): boolean {
    const key = String(chatIdOrCode);
    if (this.pairedUsers.has(key)) {
      this.pairedUsers.delete(key);
      this.trackWrite(TelegramRepository.unlinkUser(key).catch(() => false));
      return true;
    }

    // Try finding by code
    for (const [k, u] of this.pairedUsers.entries()) {
      if ((u as any).pairingCode === key) {
        this.pairedUsers.delete(k);
        this.trackWrite(TelegramRepository.unlinkUser(k).catch(() => false));
        return true;
      }
    }

    return false;
  }

  /**
   * Get paired user for a given chat ID
   */
  public getPairedUser(chatId: string | number): TelegramPairedUser | undefined {
    return this.pairedUsers.get(String(chatId));
  }

  public getAllPairedUsers(): TelegramPairedUser[] {
    return Array.from(this.pairedUsers.values());
  }

  private persistConfig() {
    this.trackWrite(this.saveConfigToTurso().catch(() => null));
  }

  public getConfig(): TelegramGatewayConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<TelegramGatewayConfig>): TelegramGatewayConfig {
    this.config = {
      ...this.config,
      ...partial,
    };
    this.persistConfig();

    if (this.config.botToken && !this.config.webhookActive && !this.isPolling) {
      this.startLongPolling();
    } else if (this.config.webhookActive && this.isPolling) {
      this.stopLongPolling();
    }

    return { ...this.config };
  }

  public getLogs(filterChatId?: string, limit = 150): TelegramActivityLog[] {
    let list = [...this.logs];
    if (filterChatId) {
      list = list.filter((l) => String(l.chatId) === String(filterChatId));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  public addLog(log: Omit<TelegramActivityLog, "id" | "timestamp">): TelegramActivityLog {
    const entry: TelegramActivityLog = {
      ...log,
      id: `tg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    this.logs.unshift(entry);
    if (this.logs.length > 150) {
      this.logs = this.logs.slice(0, 150);
    }
    return entry;
  }

  /**
   * Helper to download files (voice notes, audio, images) from Telegram servers
   */
  private async downloadTelegramFile(fileId: string): Promise<{ base64: string; mimeType: string } | null> {
    const token = this.config.botToken?.trim();
    if (!token) return null;
    try {
      const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
      const info = await infoRes.json().catch(() => ({}));
      if (!info.ok || !info.result?.file_path) return null;

      const fileUrl = `https://api.telegram.org/file/bot${token}/${info.result.file_path}`;
      const res = await fetch(fileUrl);
      if (!res.ok) return null;

      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const ext = path.extname(info.result.file_path).toLowerCase();
      let mimeType = "application/octet-stream";
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".webp") mimeType = "image/webp";
      else if (ext === ".oga" || ext === ".ogg") mimeType = "audio/ogg";
      else if (ext === ".mp3") mimeType = "audio/mp3";
      else if (ext === ".m4a") mimeType = "audio/mp4";

      return { base64, mimeType };
    } catch (e) {
      console.warn("Error downloading Telegram file:", e);
      return null;
    }
  }

  /**
   * Start Telegram Long Polling Background Service
   */
  public startLongPolling() {
    // Prevent long polling during static build phases
    const isBuildPhase =
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.NEXT_PHASE === "phase-export" ||
      process.env.npm_lifecycle_event === "build" ||
      process.env.NEXT_RUNTIME === "edge";
    if (isBuildPhase) {
      return;
    }

    const token = this.config.botToken?.trim();
    if (!token || this.config.webhookActive || this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.pollingAbortController = new AbortController();

    this.addLog({
      direction: "system",
      chatId: "System",
      content: "تم تشغيل خدمة السحب المباشر (Long Polling) لاستقبال رسائل تيليجرام فورياً في الخلفية.",
      messageType: "system",
      status: "delivered",
    });

    (async () => {
      while (this.isPolling && this.config.botToken?.trim() && !this.config.webhookActive) {
        try {
          const currentToken = this.config.botToken.trim();
          const url = `https://api.telegram.org/bot${currentToken}/getUpdates?offset=${this.lastUpdateId + 1}&limit=20&timeout=25`;
          
          const res = await fetch(url, {
            method: "GET",
            signal: this.pollingAbortController?.signal,
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            if (res.status === 409) {
              terminalLogger.gateway("telegram", "409 Conflict: Clearing conflicting webhook and switching to long polling...", "warn");
              try {
                await fetch(`https://api.telegram.org/bot${currentToken}/deleteWebhook?drop_pending_updates=false`, { method: "POST" });
              } catch {}
              await new Promise((r) => setTimeout(r, 2000));
            } else {
              terminalLogger.gateway("telegram", `Polling HTTP ${res.status}: ${errText.slice(0, 80)}`, "warn");
              await new Promise((r) => setTimeout(r, 4000));
            }
            continue;
          }

          const data = await res.json().catch(() => ({}));
          if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
            for (const update of data.result) {
              if (update.update_id) {
                this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
              }
              this.processInboundMessage(update).catch((err) => {
                console.error("Error processing polled update:", err);
              });
            }
          }
        } catch (err: any) {
          if (err?.name === "AbortError") {
            break;
          }
          console.warn("Telegram polling loop tick note:", err?.message || err);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      this.isPolling = false;
    })();
  }

  /**
   * Stop Telegram Long Polling
   */
  public stopLongPolling() {
    this.isPolling = false;
    if (this.pollingAbortController) {
      try {
        this.pollingAbortController.abort();
      } catch {}
      this.pollingAbortController = null;
    }
  }

  /**
   * Verify Bot Token with Telegram API (getMe)
   */
  public async verifyToken(tokenToTest?: string): Promise<{ success: boolean; bot?: TelegramBotInfo; error?: string }> {
    await this.ensureInitialized();
    const token = (tokenToTest || this.config.botToken).trim();
    if (!token) {
      return { success: false, error: "رمز البوت (Bot Token) فارغ. يرجى إدخال الرمز أولاً." };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      const data = await response.json();
      if (data.ok && data.result) {
        const bot: TelegramBotInfo = data.result;
        this.config.botToken = token;
        this.config.botUsername = bot.username || "";
        this.config.botDisplayName = bot.first_name || "SoufAI Bot";
        this.config.connectionStatus = "connected";
        this.config.lastConnectedAt = Date.now();
        this.config.lastError = null;

        this.addLog({
          direction: "system",
          chatId: "System",
          content: `تم التحقق من رمز البوت بنجاح: @${bot.username} (${bot.first_name}). البوت نشط وجاهز للرد الذكي.`,
          messageType: "system",
          status: "delivered",
        });

        this.persistConfig();

        // Start polling if webhook is not set
        if (!this.config.webhookActive) {
          this.startLongPolling();
        }

        return { success: true, bot };
      } else {
        const errDesc = data.description || "رمز البوت غير صالح أو مرفوض من تيليجرام.";
        this.config.connectionStatus = "error";
        this.config.lastError = errDesc;

        this.addLog({
          direction: "system",
          chatId: "System",
          content: `فشل التحقق من رمز البوت: ${errDesc}`,
          messageType: "system",
          status: "failed",
        });

        serverErrorManager.recordError({
          title: "فشل التحقق من رمز بوت تيليجرام (Telegram Token Rejected)",
          message: errDesc,
          category: "telegram",
          severity: "high",
          statusCode: response.status,
        });

        return { success: false, error: errDesc };
      }
    } catch (err: any) {
      const errMsg = err.message || "فشل الاتصال بخوادم تيليجرام الرسمية.";
      this.config.connectionStatus = "error";
      this.config.lastError = errMsg;

      serverErrorManager.recordError({
        title: "خطأ اتصال مع سيرفر تيليجرام (Telegram Connection Error)",
        message: errMsg,
        category: "telegram",
        severity: "medium",
        stackTrace: err?.stack,
      });

      return { success: false, error: errMsg };
    }
  }

  /**
   * Set Webhook for Telegram Bot
   */
  public async setWebhook(webhookUrl: string): Promise<{ success: boolean; description?: string; error?: string }> {
    await this.ensureInitialized();
    const token = this.config.botToken.trim();
    if (!token) {
      return { success: false, error: "يرجى ربط رمز البوت (Bot Token) أولاً قبل تفعيل الويب هوك." };
    }

    try {
      this.stopLongPolling();

      const payload: Record<string, any> = {
        url: webhookUrl,
        allowed_updates: ["message", "edited_message", "callback_query", "channel_post"],
      };

      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.ok) {
        this.config.webhookUrl = webhookUrl;
        this.config.webhookActive = true;
        this.persistConfig();
        this.addLog({
          direction: "system",
          chatId: "System",
          content: `تم تسجيل وتفعيل الويب هوك بنجاح على: ${webhookUrl}`,
          messageType: "system",
          status: "delivered",
        });
        return { success: true, description: data.description };
      } else {
        // Fallback to polling if webhook fails
        this.startLongPolling();
        return { success: false, error: data.description || "فشل تسجيل الويب هوك في تيليجرام" };
      }
    } catch (err: any) {
      this.startLongPolling();
      return { success: false, error: err.message || "حدث خطأ أثناء ضبط الويب هوك" };
    }
  }

  /**
   * Delete Webhook (Switch back to polling)
   */
  public async deleteWebhook(): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    const token = this.config.botToken.trim();
    if (!token) return { success: false, error: "رمز البوت غير موجود." };

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.ok) {
        this.config.webhookActive = false;
        this.persistConfig();
        this.addLog({
          direction: "system",
          chatId: "System",
          content: "تم إلغاء تفعيل الويب هوك (Delete Webhook). جاري تفعيل السحب المباشر Long Polling.",
          messageType: "system",
          status: "delivered",
        });

        this.startLongPolling();
        return { success: true };
      }
      return { success: false, error: data.description };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get Webhook Info from Telegram API
   */
  public async getWebhookInfo(): Promise<{ success: boolean; info?: any; error?: string }> {
    await this.ensureInitialized();
    const token = this.config.botToken.trim();
    if (!token) return { success: false, error: "رمز البوت غير متوفر." };

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const data = await response.json();
      if (data.ok) {
        return { success: true, info: data.result };
      }
      return { success: false, error: data.description || "فشل جلب معلومات الويب هوك" };
    } catch (err: any) {
      return { success: false, error: err.message || "فشل الاتصال بخوادم تيليجرام" };
    }
  }

  public getActiveBotToken(): string {
    let token = this.config.botToken ? this.config.botToken.trim() : "";
    if (!token && process.env.TELEGRAM_BOT_TOKEN) {
      token = process.env.TELEGRAM_BOT_TOKEN.trim();
      this.config.botToken = token;
    }
    return token;
  }

  /**
   * Send Photo to Telegram Chat
   */
  public async sendPhoto(chatId: string | number, photoUrl: string, caption?: string): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const token = this.getActiveBotToken();
    if (!token) return { success: false, error: "رمز البوت غير متوفر للإرسال." };

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption ? caption.slice(0, 1024) : undefined,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        this.config.totalMessagesSent += 1;
        this.addLog({
          direction: "outbound",
          chatId: String(chatId),
          content: `[صورة] ${caption || ""}`,
          messageType: "photo",
          status: "sent",
        });
        return { success: true, messageId: data.result.message_id };
      }
      return { success: false, error: data.description };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a Direct Telegram Message with chunking & markdown fallback
   */
  public async sendMessage(chatId: string | number, text: string, parseMode?: "HTML" | "Markdown"): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const token = this.getActiveBotToken();
    if (!token) {
      return { success: false, error: "رمز البوت (Bot Token) غير متوفر أو غير متصل بالإعدادات." };
    }

    if (!text || text.trim() === "") {
      return { success: false, error: "نص الرسالة فارغ." };
    }

    // Split long messages if exceeding Telegram limit of 4096 chars
    const MAX_LEN = 3900;
    const chunks: string[] = [];
    if (text.length <= MAX_LEN) {
      chunks.push(text);
    } else {
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_LEN) {
          chunks.push(remaining);
          break;
        }
        let splitIndex = remaining.lastIndexOf("\n", MAX_LEN);
        if (splitIndex === -1 || splitIndex < 1000) {
          splitIndex = MAX_LEN;
        }
        chunks.push(remaining.substring(0, splitIndex));
        remaining = remaining.substring(splitIndex).trim();
      }
    }

    let lastResult: any = { success: true };

    for (const chunk of chunks) {
      try {
        const payload: Record<string, any> = {
          chat_id: chatId,
          text: chunk,
        };
        if (parseMode) {
          payload.parse_mode = parseMode;
        }

        let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let data = await response.json().catch(() => ({}));

        // If failed due to formatting entities, retry cleanly as plain text
        if (!data.ok) {
          delete payload.parse_mode;
          response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          data = await response.json().catch(() => ({}));
        }

        if (data.ok && data.result) {
          this.config.totalMessagesSent += 1;
          lastResult = { success: true, messageId: data.result.message_id };
        } else {
          lastResult = { success: false, error: data.description || "فشل إرسال الرسالة من خوادم تيليجرام" };
        }
      } catch (err: any) {
        lastResult = { success: false, error: err.message || "خطأ اتصال أثناء إرسال الرسالة" };
      }
    }

    return lastResult;
  }

  /**
   * Send a Document / File to Telegram Chat
   */
  public async sendDocument(
    chatId: string | number,
    fileBuffer: Buffer,
    fileName: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const token = this.getActiveBotToken();
    if (!token) return { success: false, error: "رمز البوت غير متوفر." };

    try {
      const formData = new FormData();
      formData.append("chat_id", String(chatId));
      const blob = new Blob([new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength)] as BlobPart[]);
      formData.append("document", blob, fileName);
      if (caption) {
        formData.append("caption", caption.slice(0, 1024));
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (data.ok && data.result) {
        this.config.totalMessagesSent += 1;
        this.addLog({
          direction: "outbound",
          chatId: String(chatId),
          content: `[مستند] ${fileName} (${caption || ""})`,
          messageType: "document",
          status: "sent",
        });
        return { success: true, messageId: data.result.message_id };
      }
      return { success: false, error: data.description };
    } catch (err: any) {
      return { success: false, error: err?.message || "خطأ أثناء إرسال المستند إلى تيليجرام" };
    }
  }

  /**
   * Send a Direct Telegram Message with Interactive Inline Keyboard Buttons
   */
  public async sendMessageWithInlineKeyboard(
    chatId: string | number,
    text: string,
    inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>,
    parseMode: "HTML" | "Markdown" = "Markdown"
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const token = this.getActiveBotToken();
    if (!token) {
      return { success: false, error: "رمز البوت غير متوفر." };
    }

    try {
      const payload = {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      };

      let res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data = await res.json().catch(() => ({}));
      if (!data.ok) {
        // Retry without formatting if markdown parse fails
        delete (payload as any).parse_mode;
        res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        data = await res.json().catch(() => ({}));
      }

      if (data.ok && data.result) {
        this.config.totalMessagesSent += 1;
        return { success: true, messageId: data.result.message_id };
      }
      return { success: false, error: data.description };
    } catch (err: any) {
      return { success: false, error: err?.message || "خطأ أثناء إرسال أزرار تيليجرام" };
    }
  }

  /**
   * Answer a Telegram Callback Query to dismiss loading indicator
   */
  public async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    const token = this.getActiveBotToken();
    if (!token || !callbackQueryId) return false;
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || "تم الاستلام بنجاح",
          show_alert: false,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send Chat Action (e.g. typing)
   */
  public async sendChatAction(chatId: string | number, action: "typing" | "upload_photo" = "typing") {
    const token = this.getActiveBotToken();
    if (!token) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action }),
      });
    } catch {}
  }

  /**
   * AI-Powered and Deterministic Natural Language Scheduling Intent Parser
   * Supports Arabic, Moroccan Darija, French, English, Spanish, and any language seamlessly.
   */
  public async parseScheduleIntentWithAI(
    text: string,
    nowTimestamp: number
  ): Promise<{
    isScheduleIntent: boolean;
    title: string;
    type: "reminder" | "research" | "email" | "code" | "general_task";
    targetTimestamp: number;
    recurrence: "once" | "daily" | "weekly" | "workdays" | "monthly";
    prompt: string;
    friendlyTimeAr?: string;
    detectedLanguage?: string;
  }> {
    const now = nowTimestamp || Date.now();
    const clean = text.trim();

    // 1. FAST DETERMINISTIC REGEX CHECK
    const relativeMatch = clean.match(/(?:بعد|من دابا|عقب|in|dans)\s+(\d+)\s*(دقيقة|دقائق|د|ساعة|ساعات|س|يوم|أيام|أسبوع|اسبوع|min|mins|minute|minutes|hour|hours|h|day|days|semaine|semaines)/i);

    let recurrence: "once" | "daily" | "weekly" | "workdays" | "monthly" = "once";
    if (/(كل يوم|يوميا|يومياً|daily|every day|tous les jours|chaque jour|cada día)/i.test(clean)) recurrence = "daily";
    else if (/(كل أسبوع|أسبوعيا|أسبوعياً|weekly|every week|chaque semaine|cada semana)/i.test(clean)) recurrence = "weekly";
    else if (/(أيام العمل|workdays|weekdays|jours ouvrables)/i.test(clean)) recurrence = "workdays";
    else if (/(كل شهر|شهريا|شهرياً|monthly|every month|chaque mois|cada mes)/i.test(clean)) recurrence = "monthly";

    let taskType: "reminder" | "email" | "research" | "code" | "general_task" = "reminder";
    if (/(بريد|إيميل|ايميل|email|mail|courrier)/i.test(clean)) taskType = "email";
    else if (/(ابحث|بحث|أخبار|تقصي|search|cherche|trouve|لخص لي)/i.test(clean)) taskType = "research";
    else if (/(كود|برمجة|شغل كود|code|programme)/i.test(clean)) taskType = "code";
    else if (/(نفذ|مهمة|اكتب|صمم|task|fais|lance)/i.test(clean) && !/(تذكير|ذكرني|فكرني|دكرني|علمني|remind|rappelle)/i.test(clean)) taskType = "general_task";

    // 2. AI SEMANTIC EXTRACTION WITH GEMINI (SUPPORTS ALL DIALECTS & LANGUAGES)
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const refDate = new Date(now);
        const refTimeInfo = getCurrentTimeInfo("المغرب");

        const aiPrompt = `أنت محرك استخراج نوايا التذكير والجدولة الذكي.
حلل رسالة المستخدم بدقة مهما كانت لغته أو لهجته (عربية فصحى، دارجة مغربية أو جزائرية أو تونسية، خليجية، مصرية، فرنسية، إنجليزية، إسبانية، إلخ).

السياق الزمني الحالي:
- التاريخ والوقت (ISO): ${refDate.toISOString()}
- الوقت والتاريخ المحلي: ${refTimeInfo.formattedDateAr} الساعة ${refTimeInfo.localTime}
- التوقيت الزمني الحالي بالمللي ثانية: ${now}

رسالة المستخدم:
"${clean}"

قم بالاستخراج بدقة تامة وأجب فقط بصيغة JSON التالية بدون أي نصوص خارجية:
{
  "isScheduleIntent": true,
  "title": "عنوان موجز ونظيف وواضح لما يريده المستخدم بدون كلمات أمر مثل ذكرني أو فكرني أو remind me",
  "type": "reminder" | "research" | "email" | "code" | "general_task",
  "targetTimestamp": ${now + 900000},
  "recurrence": "once" | "daily" | "weekly" | "workdays" | "monthly",
  "prompt": "النص الكامل لما طلب المستخدم تنفيذه أو التذكير به",
  "friendlyTimeAr": "وصف لطيف وسلس للموعد بنفس لغة رسالة المستخدم (مثلاً: غداً الساعة 5:00 مساءً أو Demain à 17h00)",
  "detectedLanguage": "ar" | "fr" | "en" | "es" | "darija"
}`;

        const genRes = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: aiPrompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        if (genRes?.text) {
          const parsed = JSON.parse(genRes.text);
          if (parsed && typeof parsed.targetTimestamp === "number" && parsed.targetTimestamp > now - 120000) {
            return {
              isScheduleIntent: parsed.isScheduleIntent ?? true,
              title: parsed.title || clean,
              type: parsed.type || taskType,
              targetTimestamp: Math.max(now + 10000, Number(parsed.targetTimestamp)),
              recurrence: parsed.recurrence || recurrence,
              prompt: parsed.prompt || clean,
              friendlyTimeAr: parsed.friendlyTimeAr,
              detectedLanguage: parsed.detectedLanguage,
            };
          }
        }
      } catch (aiErr) {
        console.warn("[TelegramManager] AI Schedule Parser fallback to heuristic:", aiErr);
      }
    }

    // 3. DETERMINISTIC HEURISTIC FALLBACK
    let targetTimestamp = now + 15 * 60 * 1000;
    if (relativeMatch) {
      const num = parseInt(relativeMatch[1], 10) || 1;
      const unit = relativeMatch[2].toLowerCase();
      if (unit.includes("دقيق") || unit === "د" || unit.startsWith("min")) targetTimestamp = now + num * 60 * 1000;
      else if (unit.includes("ساع") || unit === "س" || unit.startsWith("hour") || unit === "h") targetTimestamp = now + num * 60 * 60 * 1000;
      else if (unit.includes("يوم") || unit.includes("أيام") || unit.startsWith("day") || unit.startsWith("jour")) targetTimestamp = now + num * 24 * 60 * 60 * 1000;
      else if (unit.includes("أسبوع") || unit.includes("اسبوع") || unit.startsWith("semaine") || unit.startsWith("week")) targetTimestamp = now + num * 7 * 24 * 60 * 60 * 1000;
    } else if (/(غدا|غداً|tomorrow|demain|mañana)/i.test(clean)) {
      const targetDate = new Date(now + 24 * 60 * 60 * 1000);
      const hourMatch = clean.match(/(?:الساعة|مع|at|à)\s*(\d{1,2})(?::|h)?(\d{2})?\s*(صباحا|صباحاً|مساء|مساءً|دالعشية|am|pm)?/i);
      if (hourMatch) {
        let h = parseInt(hourMatch[1], 10);
        const m = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
        const period = hourMatch[3] || "";
        if ((period.includes("مساء") || period.includes("عشية") || period === "pm") && h < 12) h += 12;
        if ((period.includes("صباح") || period === "am") && h === 12) h = 0;
        targetDate.setHours(h, m, 0, 0);
      } else {
        targetDate.setHours(9, 0, 0, 0);
      }
      targetTimestamp = targetDate.getTime();
    }

    const cleanTitle = clean
      .replace(/^(فكرني أن|فكرني بـ|فكرني ب|فكرني|ذكرني أن|ذكرني بـ|ذكرني ب|ذكرني|جدول لي|جدول|تذكير بـ|تذكير ب|نبهني بـ|نبهني|remind me to|remind me about|rappelle moi de|rappelle moi)\s*/i, "")
      .replace(/^(بعد \d+\s*(?:دقيقة|دقائق|ساعة|ساعات|يوم|أيام)|من دابا \d+\s*(?:دقيقة|ساعة)|in \d+\s*(?:mins|hours)|dans \d+\s*(?:min|heures)|غدا|غداً|tomorrow|demain)\s*/i, "")
      .trim() || clean;

    return {
      isScheduleIntent: true,
      title: cleanTitle,
      type: taskType,
      targetTimestamp,
      recurrence,
      prompt: clean,
    };
  }

  /**
   * Process Inbound Telegram Message & Generate AI Response
   */
  public async processInboundMessage(update: any): Promise<{ handled: boolean; replyText?: string }> {
    await this.ensureInitialized();
    const message =
      update.message ||
      update.edited_message ||
      update.channel_post ||
      update.edited_channel_post ||
      update.business_message ||
      update.callback_query?.message;

    if (!message) return { handled: false };

    const chatId = message.chat?.id || update.callback_query?.from?.id;
    const text = (update.callback_query?.data || message.text || message.caption || "").trim();
    const sender =
      message.from?.first_name ||
      message.chat?.first_name ||
      message.from?.username ||
      "مستخدم تيليجرام";
    const username = message.from?.username;

    if (!chatId) return { handled: false };

    // Security & Privacy Check 1: Group & Channel Isolation
    // The assistant operates strictly in 1-on-1 private conversations.
    // If sent in a group, supergroup, or channel, ignore to prevent public chat leaks and unauthorized triggering.
    const chatType = message.chat?.type;
    if (chatType && chatType !== "private") {
      return { handled: true };
    }

    // Security Check 2: Allowed Chat IDs Whitelist (if configured)
    if (
      this.config.allowedChatIds &&
      this.config.allowedChatIds.length > 0 &&
      !this.config.allowedChatIds.includes(String(chatId))
    ) {
      return { handled: true };
    }

    // Security Check 3: Rate Limiting & DoS Protection (max 5 requests per 60 seconds per chat)
    const now = Date.now();
    const chatKey = String(chatId);
    const recentTimestamps = (this.rateLimits.get(chatKey) || []).filter((t) => now - t < 60000);
    if (recentTimestamps.length >= 5) {
      if (recentTimestamps.length === 5) {
        recentTimestamps.push(now);
        this.rateLimits.set(chatKey, recentTimestamps);
        try {
          await this.sendMessage(
            chatId,
            "⏳ **عذراً، لقد تجاوزت الحد المسموح به من الرسائل (5 رسائل في الدقيقة).**\nيرجى الانتظار دقيقة واحدة لحماية الخدمة ومتابعة المحادثة."
          );
        } catch {}
      }
      return { handled: true };
    }
    recentTimestamps.push(now);
    this.rateLimits.set(chatKey, recentTimestamps);

    const pairedUser = this.getPairedUser(chatId);
    const userIdentifier = pairedUser?.userId || (pairedUser?.email ? `user_${pairedUser.email}` : `tg_${chatId}`);

    // 0. Handle Interactive Button Callbacks
    if (update.callback_query) {
      const cbId = update.callback_query.id;
      const cbData = update.callback_query.data || "";
      await this.answerCallbackQuery(cbId, "تم استلام الإجراء بنجاح");

      // IDOR Authorization Guard for Task Action Callbacks
      if (cbData.startsWith("task_")) {
        const taskId = cbData
          .replace("task_done_", "")
          .replace("task_snooze_15_", "")
          .replace("task_snooze_60_", "")
          .replace("task_run_now_", "")
          .replace("task_delete_", "");

        if (taskId && taskId !== "list_my_tasks") {
          const targetTask = await ScheduledTaskRepository.getTaskById(taskId);
          if (!targetTask) {
            await this.sendMessage(chatId, "⚠️ **لم يتم العثور على المهمة المطلوبة أو تم حذفها مسبقاً.**");
            return { handled: true };
          }
          const isOwner = targetTask.userId === userIdentifier || targetTask.chatId === String(chatId);
          const isAdmin = pairedUser?.email ? isUserAdmin(pairedUser.email) : false;
          if (!isOwner && !isAdmin) {
            await this.sendMessage(chatId, "⛔ **غير مصرح لك بالتحكم في هذه المهمة.**");
            return { handled: true };
          }
        }
      }

      if (cbData.startsWith("task_done_")) {
        const taskId = cbData.replace("task_done_", "");
        await ScheduledTaskRepository.updateTaskStatus(taskId, "completed", { doneViaTelegram: true });
        await this.sendMessage(chatId, "✅ **تم تعليم المهمة كمكتملة بنجاح!** بارك الله في إنجازك 🌟");
        return { handled: true };
      } else if (cbData.startsWith("task_snooze_15_")) {
        const taskId = cbData.replace("task_snooze_15_", "");
        const nextTime = Date.now() + 15 * 60 * 1000;
        await ScheduledTaskRepository.rescheduleRecurringTask(taskId, nextTime, new Date(nextTime).toISOString());
        await this.sendMessage(chatId, "⏰ **تم تأجيل التذكير لمدة 15 دقيقة بنجاح!** سأذكرك في الموعد الجديد.");
        return { handled: true };
      } else if (cbData.startsWith("task_snooze_60_")) {
        const taskId = cbData.replace("task_snooze_60_", "");
        const nextTime = Date.now() + 60 * 60 * 1000;
        await ScheduledTaskRepository.rescheduleRecurringTask(taskId, nextTime, new Date(nextTime).toISOString());
        await this.sendMessage(chatId, "⏳ **تم تأجيل التذكير لمدة ساعة واحدة بنجاح!** سأذكرك في الموعد الجديد.");
        return { handled: true };
      } else if (cbData.startsWith("task_run_now_")) {
        const taskId = cbData.replace("task_run_now_", "");
        await this.sendMessage(chatId, "🚀 **جاري تشغيل المهمة المجدولة الآن فوراً...**");
        try {
          const { ServerTaskRunner } = await import("@/lib/scheduler/serverTaskRunner");
          const runRes = await ServerTaskRunner.executeSingleTaskById(taskId);
          if (runRes.success) {
            await this.sendMessage(chatId, `✨ **تم تنفيذ المهمة بنجاح:**\n\n${runRes.message}`);
          } else {
            await this.sendMessage(chatId, `⚠️ **تعذر التنفيذ:** ${runRes.message}`);
          }
        } catch (e: any) {
          await this.sendMessage(chatId, `⚠️ **خطأ أثناء تشغيل المهمة:** ${e?.message || "خطأ غير متوقع"}`);
        }
        return { handled: true };
      } else if (cbData.startsWith("task_delete_")) {
        const taskId = cbData.replace("task_delete_", "");
        await ScheduledTaskRepository.deleteTask(taskId);
        await this.sendMessage(chatId, "🗑️ **تم حذف المهمة المجدولة من قاعدة البيانات بنجاح.**");
        return { handled: true };
      } else if (cbData === "list_my_tasks") {
        const tasks = await ScheduledTaskRepository.listTasksByUser(userIdentifier, "pending", 10);
        if (!tasks || tasks.length === 0) {
          await this.sendMessage(chatId, "⏰ **لا توجد مهام مجدولة نشطة حالياً في حسابك.**");
        } else {
          let msg = `📋 **قائمة المهام المجدولة النشطة (${tasks.length}):**\n\n`;
          for (let i = 0; i < tasks.length; i++) {
            const t = tasks[i];
            const diffMs = t.targetTimestamp - Date.now();
            const diffMins = Math.max(0, Math.round(diffMs / 60000));
            const timeLabel = diffMins > 60 ? `${Math.floor(diffMins / 60)} ساعة و ${diffMins % 60} دقيقة` : `${diffMins} دقيقة`;
            const recurLabel = t.recurrence !== "once" ? ` (تكرار: ${t.recurrence})` : "";
            msg += `${i + 1}. 📌 **${t.title}**\n   ⏰ الموعد: بعد ${timeLabel}${recurLabel}\n   🆔 المعرف: \`${t.id}\`\n\n`;
          }
          msg += `💡 للتحكم بمهمة، يمكنك استخدام الأوامر:\n• \`/cancel <معرف المهمة>\` للإلغاء\n• \`/runnow <معرف المهمة>\` للتنفيذ الفوري`;
          await this.sendMessage(chatId, msg);
        }
        return { handled: true };
      }
    }

    this.config.totalMessagesReceived += 1;

    // Check media presence (Voice message, Audio, Photo)
    const attachments: any[] = [];
    let mediaPromptText = text;

    if (message.voice || message.audio) {
      const audioObj = message.voice || message.audio;
      const downloaded = await this.downloadTelegramFile(audioObj.file_id);
      if (downloaded) {
        attachments.push({
          type: "audio",
          mimeType: downloaded.mimeType,
          data: downloaded.base64,
        });
        if (!mediaPromptText) {
          mediaPromptText = "استمع إلى هذا التسجيل الصوتي من المستخدم وأجب على ما جاء فيه باللغة العربية الفصحى بدقة ولباقة ووضوح.";
        }
      }
    } else if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      const bestPhoto = message.photo[message.photo.length - 1];
      const downloaded = await this.downloadTelegramFile(bestPhoto.file_id);
      if (downloaded) {
        attachments.push({
          type: "image",
          mimeType: downloaded.mimeType,
          data: downloaded.base64,
        });
        if (!mediaPromptText) {
          mediaPromptText = "قم بتحليل هذه الصورة واشرح محتواها وقدم الإجابة المفيدة عما تتضمنه بدقة.";
        }
      }
    }

    // Log inbound message
    this.addLog({
      direction: "inbound",
      chatId: String(chatId),
      username,
      senderName: sender,
      content: text || (attachments.length > 0 ? (attachments[0].type === "audio" ? "[تسجيل صوتي]" : "[صورة مرفقة]") : "[مرفق / وسائط]"),
      messageType: text.startsWith("/") ? "command" : attachments.length > 0 ? (attachments[0].type === "audio" ? "audio" : "photo") : "text",
      status: "received",
    });

    // Check if auto-reply is disabled
    if (!this.config.autoAiReply) {
      return { handled: true };
    }

    // Adaptive Learning trigger on every text interaction
    if (text && text.length > 2 && !text.startsWith("/")) {
      AdaptiveLearningEngine.analyzeAndLearn(userIdentifier, text, "telegram").catch(() => {});
    }

    const lowerText = text.toLowerCase();
    const rawTrimmed = text.trim();
    const cleanRawText = (text || mediaPromptText || "").trim();

    // ----------------------------------------------------
    // 0.1 ADVANCED SCHEDULING & TASK COMMANDS
    // ----------------------------------------------------
    if (
      lowerText === "/tasks" ||
      lowerText === "/schedule" ||
      lowerText === "/scheduled" ||
      lowerText === "مهامي" ||
      lowerText === "المهام المجدولة" ||
      lowerText === "مهامي المجدولة"
    ) {
      const tasks = await ScheduledTaskRepository.listTasksByUser(userIdentifier, "pending", 15);
      if (!tasks || tasks.length === 0) {
        const noTasksMsg = "⏰ **ليس لديك أي تذكيرات أو مواعيد معلقة حالياً.**\n\n💡 يمكنك إرسال أي طلب تذكير بالصوت أو النص مثل:\n• *«فكرني من دابا 20 دقيقة نعيط لمحمد»*\n• *«ذكرني غداً الساعة 9 صباحاً بموعد الطبيب»*\n• *«كل يوم الساعة 8 صباحاً لخص لي أهم الأخبار»*\n• *«Remind me in 30 minutes to take a break»*";
        await this.sendMessage(chatId, noTasksMsg);
        return { handled: true, replyText: noTasksMsg };
      }

      let tasksListText = `📋 **تذكيراتك ومواعيدك القادمة (${tasks.length}):**\n\n`;
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const diffMs = t.targetTimestamp - Date.now();
        const diffMins = Math.max(0, Math.round(diffMs / 60000));
        const timeLabel = diffMins > 60 ? `${Math.floor(diffMins / 60)} ساعة و ${diffMins % 60} دقيقة` : `${diffMins} دقيقة`;
        const recurLabel = t.recurrence !== "once" ? ` (يتكرر: ${t.recurrence})` : "";
        tasksListText += `${i + 1}. 📌 **${t.title}**\n   ⏰ الموعد: بعد ${timeLabel}${recurLabel}\n\n`;
      }
      await this.sendMessage(chatId, tasksListText);
      return { handled: true, replyText: tasksListText };
    }

    if (lowerText.startsWith("/cancel ") || lowerText.startsWith("/canceltask ")) {
      const taskIdToCancel = rawTrimmed.replace(/^\/(?:cancel|canceltask)\s+/i, "").trim();
      if (taskIdToCancel) {
        const targetTask = await ScheduledTaskRepository.getTaskById(taskIdToCancel);
        if (!targetTask) {
          await this.sendMessage(chatId, "⚠️ **لم يتم العثور على التذكير المطلوب أو قد تم حذفه مسبقاً.**");
          return { handled: true };
        }

        const isAdmin = pairedUser?.email ? isUserAdmin(pairedUser.email) : false;
        const isOwner = targetTask.userId === userIdentifier || targetTask.chatId === String(chatId);
        if (!isOwner && !isAdmin) {
          await this.sendMessage(chatId, "⛔ **غير مصرح لك بإلغاء هذا التذكير.**");
          return { handled: true };
        }

        await ScheduledTaskRepository.cancelTask(taskIdToCancel);
        const cancelMsg = `✅ **تم إلغاء التذكير بنجاح.**`;
        await this.sendMessage(chatId, cancelMsg);
        return { handled: true, replyText: cancelMsg };
      }
    }

    if (lowerText.startsWith("/runnow ") || lowerText.startsWith("/execute ")) {
      const taskIdToRun = rawTrimmed.replace(/^\/(?:runnow|execute)\s+/i, "").trim();
      if (taskIdToRun) {
        const targetTask = await ScheduledTaskRepository.getTaskById(taskIdToRun);
        if (!targetTask) {
          await this.sendMessage(chatId, "⚠️ **لم يتم العثور على المهمة المطلوبة أو قد تم حذفها مسبقاً.**");
          return { handled: true };
        }

        const isAdmin = pairedUser?.email ? isUserAdmin(pairedUser.email) : false;
        const isOwner = targetTask.userId === userIdentifier || targetTask.chatId === String(chatId);
        if (!isOwner && !isAdmin) {
          await this.sendMessage(chatId, "⛔ **غير مصرح لك بتشغيل هذه المهمة.**");
          return { handled: true };
        }

        await this.sendMessage(chatId, `🚀 **جاري تشغيل المطلوب الآن...**`);
        try {
          const { ServerTaskRunner } = await import("@/lib/scheduler/serverTaskRunner");
          const runRes = await ServerTaskRunner.executeSingleTaskById(taskIdToRun);
          const replyText = runRes.success
            ? `✨ **تم التنفيذ بنجاح:**\n\n${runRes.message}`
            : `⚠️ **تعذر التنفيذ:** ${runRes.message}`;
          await this.sendMessage(chatId, replyText);
          return { handled: true, replyText };
        } catch (e: any) {
          const errMsg = `⚠️ **تعذر التنفيذ:** ${e?.message || "حدث خطأ غير متوقع"}`;
          await this.sendMessage(chatId, errMsg);
          return { handled: true, replyText: errMsg };
        }
      }
    }

    if (lowerText === "/learned" || lowerText === "ماذا تعلمت عني" || lowerText === "عاداتي" || lowerText === "تفضيلاتي") {
      const habitSummary = await UserLearningRepository.getUserHabitSummary(userIdentifier);
      const suggestions = await AdaptiveLearningEngine.getProactiveSuggestions(userIdentifier);

      let replyMsg = `🧠 **ما تعلمته لمساعدتك وتخصيص تجربتك:**\n`;
      if (habitSummary) {
        replyMsg += habitSummary + "\n\n";
      } else {
        replyMsg += "\n• أتعلم تدريجياً من حواراتنا لتقديم إجابات وتذكيرات تناسب اهتماماتك تماماً.\n\n";
      }

      if (suggestions.length > 0) {
        replyMsg += `💡 **اقتراحات مفيدة لك:**\n${suggestions.map((s) => `• ${s}`).join("\n")}`;
      }

      await this.sendMessage(chatId, replyMsg);
      return { handled: true, replyText: replyMsg };
    }

    // ----------------------------------------------------
    // 0.2 ADVANCED NATURAL LANGUAGE & AI SCHEDULING INTERCEPTOR
    // ----------------------------------------------------
    const isScheduleIntentHeuristic = /(فكرني|دكرني|علمني|ذكرني|جدول لي|جدولة|تذكير|سجل مهمة|سجل موعد|نبهني|موعد|remind me|schedule|set a reminder|alert me|rappelle moi|fais moi penser)/i.test(text);
    if (isScheduleIntentHeuristic && !lowerText.startsWith("/")) {
      const now = Date.now();
      let scheduleInfo = await this.parseScheduleIntentWithAI(text, now);

      if (scheduleInfo && scheduleInfo.isScheduleIntent && scheduleInfo.targetTimestamp > now - 60000) {
        const taskRecord = await ScheduledTaskRepository.createTask({
          userId: userIdentifier,
          chatId: String(chatId),
          channel: "telegram",
          title: scheduleInfo.title || "تذكير",
          type: scheduleInfo.type || "reminder",
          prompt: scheduleInfo.prompt || text,
          targetTimestamp: scheduleInfo.targetTimestamp,
          targetDateIso: new Date(scheduleInfo.targetTimestamp).toISOString(),
          recurrence: scheduleInfo.recurrence || "once",
          autoExecute: true,
        });

        const targetDate = new Date(scheduleInfo.targetTimestamp);
        const timeStr = targetDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
        const dateStr = targetDate.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        const diffMins = Math.max(1, Math.round((scheduleInfo.targetTimestamp - Date.now()) / 60000));
        const friendlyDiff = diffMins >= 60 ? `${Math.floor(diffMins / 60)} ساعة و ${diffMins % 60} دقيقة` : `${diffMins} دقيقة`;

        let confirmMsg = "";
        const lang = scheduleInfo.detectedLanguage || "ar";

        if (lang === "fr") {
          confirmMsg = `🔔 **C'est noté avec plaisir !**\n\n📌 **Rappel :** ${scheduleInfo.title}\n📅 **Date & Heure :** ${scheduleInfo.friendlyTimeAr || `${dateStr} à ${timeStr}`} (dans ${friendlyDiff})\n${scheduleInfo.recurrence !== "once" ? `🔄 **Répétition :** ${scheduleInfo.recurrence}\n` : ""}\nJe vous enverrai une notification directement ici dès que le moment sera venu ✨`;
        } else if (lang === "en") {
          confirmMsg = `🔔 **Got it! Reminder set successfully.**\n\n📌 **Task:** ${scheduleInfo.title}\n📅 **Time:** ${scheduleInfo.friendlyTimeAr || `${dateStr} at ${timeStr}`} (in ~${friendlyDiff})\n${scheduleInfo.recurrence !== "once" ? `🔄 **Recurrence :** ${scheduleInfo.recurrence}\n` : ""}\nI will notify you right here on time ✨`;
        } else {
          confirmMsg = `🔔 **تم يا غالي، سأذكرك في الموعد المحدد!**\n\n📌 **الموضوع:** ${scheduleInfo.title}\n📅 **الموعد:** ${scheduleInfo.friendlyTimeAr || `${dateStr} الساعة ${timeStr}`} (بعد حوالي ${friendlyDiff})\n${scheduleInfo.recurrence !== "once" ? `🔄 **التكرار:** ${scheduleInfo.recurrence === "daily" ? "يومياً" : scheduleInfo.recurrence === "weekly" ? "أسبوعياً" : scheduleInfo.recurrence}\n` : ""}\nسأرسل لك إشعاراً وتذكيراً مباشراً هنا فور حلول الوقت 🌟`;
        }

        const inlineKeyboard = [
          [
            { text: "⏰ تأجيل 15 دقيقة", callback_data: `task_snooze_15_${taskRecord.id}` },
            { text: "⏳ تأجيل ساعة", callback_data: `task_snooze_60_${taskRecord.id}` },
          ],
          [
            { text: "📋 عرض تذكيراتي", callback_data: `list_my_tasks` },
            { text: "🗑️ إلغاء التذكير", callback_data: `task_delete_${taskRecord.id}` },
          ],
        ];

        await this.sendMessageWithInlineKeyboard(chatId, confirmMsg, inlineKeyboard);
        return { handled: true, replyText: confirmMsg };
      }
    }

    // Handle user pairing verification /start SOUF-XXXX or /link SOUF-XXXX or raw code
    if (
      lowerText.startsWith("/start ") ||
      lowerText.startsWith("/link ") ||
      lowerText.startsWith("/connect ") ||
      /^SOUF-[A-Z0-9]{4,8}$/i.test(rawTrimmed)
    ) {
      let codeToTest = rawTrimmed;
      if (lowerText.startsWith("/start ")) codeToTest = rawTrimmed.slice(7).trim();
      else if (lowerText.startsWith("/link ")) codeToTest = rawTrimmed.slice(6).trim();
      else if (lowerText.startsWith("/connect ")) codeToTest = rawTrimmed.slice(9).trim();

      if (codeToTest && /^SOUF-[A-Z0-9]{4,8}$/i.test(codeToTest)) {
        const paired = this.linkUserByCode(codeToTest, chatId, username, sender);
        if (paired) {
          const successMsg = `🎉 **تم ربط حسابك في منصة SoufAI بنجاح!**\n\nأهلاً بك يا **${sender}**${paired.email ? ` (${paired.email})` : ""}!\n\n🧠 **القدرات المفعلة الآن:**\n• مزامنة الذاكرة الشخصية والسياق الخاص بك تلقائياً.\n• إمكانية السؤال والطلب مباشرة عبر تيليجرام كأنك داخل المنصة.\n• حفظ الملاحظات وتحديث المعرفة بمجرد إرسالها.\n\nجرّب سؤالي الآن عن أي شيء أو أرسل استفسارك وسأجيبك فوراً!`;
          await this.sendMessage(chatId, successMsg);
          return { handled: true, replyText: successMsg };
        }
      }
    }

    if (lowerText === "/unlink" || lowerText === "/disconnect") {
      this.unlinkUser(chatId);
      const unlinkMsg = "🔒 **تم إلغاء ربط حسابك في المنصة عن هذا البوت.**\nيمكنك إعادة الربط في أي وقت من خلال قائمة الأدوات في المنصة.";
      await this.sendMessage(chatId, unlinkMsg);
      return { handled: true, replyText: unlinkMsg };
    }

    // Handle Gmail integration commands
    if (
      lowerText === "/gmail" ||
      lowerText === "/link_gmail" ||
      lowerText === "/connect_gmail" ||
      lowerText === "/email"
    ) {
      const gmailToken = this.getGmailToken(chatId);
      const gmailDetails = this.getGmailDetails(chatId);
      const baseUrl = this.getBaseUrl();
      const serviceKey = this.createServiceKey(chatId, "GMAIL");
      const connectUrl = `${baseUrl}/ar/telegram/gmail-connect?chatId=${chatId}&key=${serviceKey}`;

      if (!gmailToken) {
        const notConnectedMsg = `📧 **تفعيل وإذن الوصول إلى بريد Gmail عبر بوت تيليجرام (SoufAI)**

يتطلب الوصول إلى بريدك الإلكتروني منح إذن رسمي وآمن عبر Google للمنصة.

يمكنك منح الإذن والربط الفوري بإحدى الطريقتين:

🔗 **1️⃣ الرابط المباشر (الموصى به):**
[اضغط هنا لمنح أذونات Gmail والربط بنقرة واحدة](${connectUrl})
*(ستفتح لك نافذة Google الرسمية للموافقة على أذونات قراءة وإرسال البريد بأمان)*

🔑 **2️⃣ كود الربط عبر حسابك في المنصة:**
كود الربط الخاص بك: \`${serviceKey}\` (أو Chat ID: \`${chatId}\`)
*(سجّل الدخول إلى منصة SoufAI -> الإعدادات -> التكاملات وامنح الإذن بضغطة زر)*

✨ **القدرات التي ستُفعل فوراً بعد الموافقة:**
• قراءة وفحص الرسائل الواردة وتلخيصها فورياً.
• البحث عن أي إيميل محدد أو مستند مرسل.
• كتابة وإرسال الردود بالذكاء الاصطناعي بصوتك أو نصك!`;
        await this.sendMessage(chatId, notConnectedMsg);
        return { handled: true, replyText: notConnectedMsg };
      } else {
        const connectedMsg = `📧 **حساب Gmail مفوض ومرتبط بنجاح!** (${gmailDetails?.email || "متصل"})\n\n💡 **الأوامر والأسئلة المتاحة:**\n• أرسل *"فحص الجيميل"* لقراءة الرسائل الواردة\n• أرسل *"ابحث في الإيميل عن [كلمة البحث]"*\n• أرسل *"إرسال بريد إلكتروني إلى [البريد]"*\n• \`/gmail_disconnect\` لإلغاء تفويض وربط بريد Gmail`;
        await this.sendMessage(chatId, connectedMsg);
        return { handled: true, replyText: connectedMsg };
      }
    }

    if (lowerText === "/gmail_disconnect" || lowerText === "/disconnect_gmail") {
      this.disconnectGmail(chatId);
      const msg = "🔒 **تم إلغاء ربط وتفويض حساب Gmail بنجاح.**\nيمكنك إعادة التفويض في أي وقت باستخدام الأمر `/gmail`.";
      await this.sendMessage(chatId, msg);
      return { handled: true, replyText: msg };
    }

    // Intercept Gmail natural language queries when Gmail is NOT connected
    const isGmailIntent = /(جيميل|جميل|بريد|إيميل|ايميل|الرسائل الواردة|صندوق البريد|فحص الجيميل|اقرأ إيميلي|ارسل رسالة بريد|ارسل ايميل|ارسل إيميل|رابط حسابه|ربط الجيميل|gmail|email|inbox)/i.test(text);
    const existingGmailToken = this.getGmailToken(chatId);

    if (isGmailIntent && !existingGmailToken) {
      const baseUrl = this.getBaseUrl();
      const serviceKey = this.createServiceKey(chatId, "GMAIL");
      const connectUrl = `${baseUrl}/ar/telegram/gmail-connect?chatId=${chatId}&key=${serviceKey}`;
      const suggestMsg = `📧 **بريد Gmail بحاجة إلى منح إذن الوصول!**\n\nللإجابة على طلبك بخصوص البريد الإلكتروني، يرجى منح إذن Google الآمن بأي من الطريقتين:\n\n🔗 [اضغط هنا لمنح إذن Gmail والربط الفوري](${connectUrl})\n🔑 أو ادخل كود الربط \`${serviceKey}\` داخل إعدادات حسابك في منصة SoufAI.\n\nبمجرد الموافقة على الأذونات، أعد إرسال طلبك وسأنفذه فوراً! 🚀`;
      await this.sendMessage(chatId, suggestMsg);
      return { handled: true, replyText: suggestMsg };
    }

    // Handle Google Drive integration commands
    if (
      lowerText === "/drive" ||
      lowerText === "/link_drive" ||
      lowerText === "/connect_drive" ||
      lowerText === "/gdrive" ||
      lowerText === "/docs"
    ) {
      const driveToken = this.getDriveToken(chatId);
      const driveDetails = this.getDriveDetails(chatId);
      const baseUrl = this.getBaseUrl();
      const serviceKey = this.createServiceKey(chatId, "DRIVE");
      const connectUrl = `${baseUrl}/ar/telegram/drive-connect?chatId=${chatId}&key=${serviceKey}`;

      if (!driveToken) {
        const notConnectedMsg = `📁 **تفعيل وإذن الوصول إلى Google Drive عبر بوت تيليجرام (SoufAI)**

يتطلب الوصول إلى مستنداتك وملفاتك منح إذن رسمي وآمن عبر Google للمنصة.

يمكنك منح الإذن والربط الفوري بإحدى الطريقتين:

🔗 **1️⃣ الرابط المباشر (الموصى به):**
[اضغط هنا لمنح أذونات Google Drive والربط بنقرة واحدة](${connectUrl})
*(ستفتح لك نافذة Google الرسمية للموافقة على أذونات قراءة المستندات والملفات بأمان)*

🔑 **2️⃣ كود الربط عبر حسابك في المنصة:**
كود الربط الخاص بك: \`${serviceKey}\` (أو Chat ID: \`${chatId}\`)
*(سجّل الدخول إلى منصة SoufAI -> الإعدادات -> التكاملات وامنح الإذن بضغطة زر)*

✨ **القدرات التي ستُفعل فوراً بعد الموافقة:**
• قراءة وتحليل ملفاتك ومستنداتك على Google Drive.
• المزامنة المباشرة لأي ملف أو Google Doc مع نظام الذاكرة الشخصية.
• البحث والاستعلام الذكي عن أي معلومة داخل ملفاتك بصوتك أو نصك!`;
        await this.sendMessage(chatId, notConnectedMsg);
        return { handled: true, replyText: notConnectedMsg };
      } else {
        const connectedMsg = `📁 **حساب Google Drive مفوض ومرتبط بنجاح!** (${driveDetails?.email || "متصل"})\n\n💡 **الأوامر والأسئلة المتاحة:**\n• أرسل *"فحص مستندات درايف"* لعرض الملفات الأخيرة\n• أرسل *"ابحث في درايف عن [كلمة البحث]"*\n• أرسل أي رابط **Google Docs** وستتم قراءته وحفظه في ذاكرتك\n• \`/drive_disconnect\` لإلغاء تفويض وربط Google Drive`;
        await this.sendMessage(chatId, connectedMsg);
        return { handled: true, replyText: connectedMsg };
      }
    }

    if (lowerText === "/drive_disconnect" || lowerText === "/disconnect_drive") {
      this.disconnectDrive(chatId);
      const msg = "🔒 **تم إلغاء ربط وتفويض حساب Google Drive بنجاح.**\nيمكنك إعادة التفويض في أي وقت باستخدام الأمر `/drive`.";
      await this.sendMessage(chatId, msg);
      return { handled: true, replyText: msg };
    }

    // Intercept Drive natural language queries when Drive is NOT connected
    const isDriveIntent = /(درایف|درايف|دريف|مستندات|مستنداتي|ملفاتي|ملف درايف|google drive|gdrive|google doc|docs\.google|drive\.google)/i.test(text);
    const existingDriveToken = this.getDriveToken(chatId);

    if (isDriveIntent && !existingDriveToken && !lowerText.startsWith("/")) {
      const baseUrl = this.getBaseUrl();
      const serviceKey = this.createServiceKey(chatId, "DRIVE");
      const connectUrl = `${baseUrl}/ar/telegram/drive-connect?chatId=${chatId}&key=${serviceKey}`;
      const suggestMsg = `📁 **حساب Google Drive بحاجة إلى منح إذن الوصول!**\n\nللإجابة على طلبك وقراءة مستنداتك أو ربطها بالذاكرة الشخصية، يرجى منح إذن Google الآمن بأي من الطريقتين:\n\n🔗 [اضغط هنا لمنح إذن Google Drive والربط الفوري](${connectUrl})\n🔑 أو ادخل كود الربط \`${serviceKey}\` داخل إعدادات حسابك في منصة SoufAI.\n\nبمجرد الموافقة على الأذونات، أعد إرسال سؤالك وسأنفذ طلبك فوراً! 🚀`;
      await this.sendMessage(chatId, suggestMsg);
      return { handled: true, replyText: suggestMsg };
    }

    // Handle standard commands
    if (lowerText === "/start" || lowerText.startsWith("/start ") || lowerText.startsWith("/start@")) {
      const paired = this.getPairedUser(chatId);
      const welcome = this.config.welcomeMessage || "مرحباً بك! أنا مساعد SoufAI الذكي عبر تيليجرام. أرسل لي أي سؤال أو فكرة وسأجيبك فوراً.";
      const linkStatus = paired
        ? `\n\n👤 **حسابك مرتبط:** ${paired.firstName || sender} (${paired.email || "مستخدم المنصة"})\n🧠 الذاكرة الشخصية نشطة وتتذكر تفضيلاتك.`
        : `\n\n💡 **ملاحظة:** لربط هذا البوت بذاكرتك الشخصية وحسابك في المنصة، افتح قائمة الأدوات في منصة SoufAI واضغط على "تكامل بوت تيليجرام".`;
      const quickHelp = `\n\n💡 **القدرات المتاحة:**\n• أرسل أي سؤال أو فكرة نصية وسأجيبك فوراً.\n• أرسل **تسجيلاً صوتياً** وسأستمع إليه وأرد عليك بدقة.\n• أرسل **صورة** وسأقوم بقراءتها وتحليلها.\n• \`/clear\` لمسح سياق المحادثة وبدء جلسة جديدة.\n• \`/status\` لعرض حالة البوت ونموذج الذكاء الاصطناعي النشط.`;
      const fullWelcome = `${welcome}${linkStatus}${quickHelp}`;
      await this.sendMessage(chatId, fullWelcome);
      this.recordTelegramTurn(chatId, sender, username, "/start", fullWelcome, paired);
      return { handled: true, replyText: fullWelcome };
    }

    if (lowerText === "/help" || lowerText.startsWith("/help ") || lowerText.startsWith("/help@")) {
      const paired = this.getPairedUser(chatId);
      const helpMsg = `🤖 **دليل مساعد SoufAI عبر تيليجرام:**\n\n1️⃣ **الاستفسارات والدردشة:** اطرح سؤالك أو موضوعك بأي أسلوب وسأجيبك بالعربية الفصحى بدقة واحترافية.\n2️⃣ **البرمجة والتطوير:** أرسل كوداً لتصحيحه، شرحه، أو كتابة دوال جديدة.\n3️⃣ **الرسائل الصوتية:** يمكنك التحدث صوتياً وسأفهم صوتك وأجيبك كتابياً.\n4️⃣ **تحليل الصور:** أرسل صورة أو رسم بياني مع سؤالك لتحليله.\n5️⃣ **الذاكرة:** أرسل (تذكر أن...) وسأحفظ المعلومة في ذاكرتك تلقائياً.\n\n🔄 **إعادة التعيين:** استخدم \`/clear\` لمسح سياق المحادثة والبدء من جديد.`;
      await this.sendMessage(chatId, helpMsg);
      this.recordTelegramTurn(chatId, sender, username, "/help", helpMsg, paired);
      return { handled: true, replyText: helpMsg };
    }

    if (lowerText === "/clear" || lowerText === "/reset") {
      const paired = this.getPairedUser(chatId);
      this.chatHistories.delete(chatId);
      const clearMsg = "🔄 تم مسح ذاكرة وسياق المحادثة السابقة بنجاح. يمكنك الآن بدء موضوع جديد!";
      await this.sendMessage(chatId, clearMsg);
      this.recordTelegramTurn(chatId, sender, username, "/clear", clearMsg, paired);
      return { handled: true, replyText: clearMsg };
    }

    if (lowerText === "/status") {
      const paired = this.getPairedUser(chatId);
      const statusMsg = `⚡ **حالة بوابة SoufAI تيليجرام:**\n• البوت: @${this.config.botUsername || "متصل"}\n• النموذج النشط: \`${this.config.defaultModel || "spark"}\`\n• نمط الاتصال: ${this.config.webhookActive ? "ويب هوك نشط (Webhook)" : "سحب مباشر (Long Polling)"}\n• الحساب المرتبط: ${paired ? `✅ مرتبط (${paired.firstName || sender})` : "غير مرتبط (عام)"}\n• الرسائل المستلمة: ${this.config.totalMessagesReceived}\n• الرسائل المرسلة: ${this.config.totalMessagesSent}\n• النظام: متصل وجاهز للرد 🟢`;
      await this.sendMessage(chatId, statusMsg);
      this.recordTelegramTurn(chatId, sender, username, "/status", statusMsg, paired);
      return { handled: true, replyText: statusMsg };
    }

    // Indicate typing to the user on Telegram
    if (this.config.sendTypingAction) {
      this.sendChatAction(chatId, "typing");
    }

    // Retrieve conversation history for context
    const history = this.chatHistories.get(chatId) || [];

    // Check paired user identity and personal memories using Unified Memory Engine
    let userMemoryContext = "";
    const effectiveUserId = pairedUser?.userId || (pairedUser?.email ? `user_${pairedUser.email}` : `tg_${chatId}`);

    try {
      const memoryResult = await buildMemoryContext({
        userId: effectiveUserId,
        prompt: cleanRawText || text,
      });

      if (memoryResult.contextBlock) {
        userMemoryContext = `\n\n${memoryResult.contextBlock}`;
      }

      // Auto-persist new candidate memories extracted from Telegram natural chat
      if (memoryResult.candidateNewMemory && memoryResult.candidateNewMemory.content) {
        try {
          await saveUserMemory(effectiveUserId, {
            type: memoryResult.candidateNewMemory.type,
            content: memoryResult.candidateNewMemory.content,
            userName: memoryResult.candidateNewMemory.userName || (pairedUser?.firstName !== "souftoolsai" ? pairedUser?.firstName : undefined),
            importance: memoryResult.candidateNewMemory.importance,
            confidence: memoryResult.candidateNewMemory.confidence,
            source: "telegram" as any,
          });
        } catch {}
      }
    } catch (memErr) {
      console.warn("Could not retrieve unified memory for Telegram chat:", memErr);
    }

    // Explicit memory saving command in Telegram ("تذكر أن...", "احفظ عندك أن...", "اسمي...")
    const tgMemoryIntentMatch = cleanRawText.match(/^(?:تذكر أن|احفظ عندك أن|سجل عندك أن|لا تنسى أن|تذكر دائماً أن|remember that)\s*(.+)/i);
    if (tgMemoryIntentMatch && effectiveUserId) {
      const factToRemember = tgMemoryIntentMatch[1].trim();
      if (factToRemember) {
        try {
          await saveUserMemory(effectiveUserId, {
            type: "knowledge",
            content: factToRemember,
            source: "telegram" as any,
            userName: "سفيان",
            importance: 0.9,
          });
        } catch {}
      }
    }

    // If user has connected Google Drive token, process Drive search or link sync directly
    let driveContextText = "";
    if (existingDriveToken) {
      try {
        const userIdentifier = pairedUser?.userId || (pairedUser?.email ? `user_${pairedUser.email}` : `tg_${chatId}`);
        const isDriveSearchQuery = /(فحص مستندات|درايف|ابحث في درايف|اقرأ ملف|ملفاتي في درايف|search drive|list drive|drive files)/i.test(text);
        const docUrlMatch = text.match(/https?:\/\/(docs|drive)\.google\.com\/[^\s]+/i);

        if (docUrlMatch) {
          // Sync specific Google Doc/Drive URL to Memory
          const driveUrl = docUrlMatch[0];
          const fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (fileIdMatch && fileIdMatch[1]) {
            const fileId = fileIdMatch[1];
            const content = await GoogleDriveService.getFileContent(existingDriveToken, fileId, "application/vnd.google-apps.document");
            const syncRes = await GoogleDriveService.syncDocumentToMemory(userIdentifier, `Document_${fileId}`, content, driveUrl);
            driveContextText = `\n\n[محتوى المستند المعالج من Google Drive (${driveUrl})]:\n${content.slice(0, 4000)}\n(تمت مزامنة ${syncRes.syncedCount} مفاهيم ومعارف جديدة مع الذاكرة الشخصية بنجاح).`;
          }
        } else if (isDriveSearchQuery) {
          // Perform Drive search & retrieve recent files
          const files = await GoogleDriveService.searchFiles(existingDriveToken, "", 5);
          if (files && files.length > 0) {
            const fileListFormatted = files.map((f, idx) => `${idx + 1}. 📄 **${f.name}** (${f.mimeType.split(".").pop()}) ${f.webViewLink ? `[فتح](${f.webViewLink})` : ""}`).join("\n");
            driveContextText = `\n\n[ملفات ومستندات Google Drive الأخيرة الخاصة بالمستخدم]:\n${fileListFormatted}\nإذا طلب المستخدم تحليل أحدها أو التعمق فيه أجب بناءً على ذلك.`;
          } else {
            driveContextText = `\n\n[ملفات Google Drive]: لم يتم العثور على ملفات حديثة في المجلد الرئيسي.`;
          }
        }
      } catch (driveErr) {
        console.warn("Google Drive processing error in Telegram:", driveErr);
      }
    }

    // Generate response using SoufAI Multi-Provider Engine & Internal Inference Fallback
    const startTime = Date.now();
    let reply = "";
    let providerUsed = "souf-engine";
    let modelUsed = this.config.defaultModel || "gemini-3.7-flash";

    // ----------------------------------------------------
    // 1. DIRECT REAL-TIME TIME & DATE TOOL EXECUTION
    // ----------------------------------------------------
    const isTimeOrDateIntent = /(كم الساعة|الساعة كم|الوقت في|توقيت|الساعة الآن|ما هو الوقت|ما الوقت|الوقت الحالي|تاريخ اليوم|ما هو تاريخ اليوم|ما تاريخ اليوم|تاريخ اليوم كم|كم التاريخ|أي يوم اليوم|ما هو اليوم اليوم|فرق التوقيت|فارق التوقيت|تحويل الوقت|time in|current time|what time|today's date)/i.test(cleanRawText);

    if (isTimeOrDateIntent && !reply) {
      try {
        if (this.config.sendTypingAction) {
          this.sendChatAction(chatId, "typing");
        }

        // Check if it's a timezone conversion query (e.g. فرق التوقيت بين X و Y or تحويل الوقت من X إلى Y)
        const convertMatch = cleanRawText.match(/(?:فرق التوقيت بين|فارق التوقيت بين|تحويل الوقت من|تحويل التوقيت من)\s+([^\sو]+(?:\s+[^\sو]+)?)\s+(?:و|إلى|الى)\s+([^\s?؟]+(?:\s+[^\s?؟]+)?)/i);
        if (convertMatch && convertMatch[1] && convertMatch[2]) {
          const fromLoc = convertMatch[1].trim();
          const toLoc = convertMatch[2].trim();
          const timeMatch = cleanRawText.match(/(\d{1,2}:\d{2})/);
          const timeToConvert = timeMatch ? timeMatch[1] : "12:00";
          const convRes = convertTimeInfo(fromLoc, toLoc, timeToConvert);
          if (convRes.success) {
            reply = `🌐 **تحويل التوقيت وفارق الساعات:**\n\n• **من:** ${convRes.fromLocationLabel} ${convRes.fromFlag || ""} (\`${convRes.originalTime}\` - UTC ${convRes.fromUtcOffset})\n• **إلى:** ${convRes.toLocationLabel} ${convRes.toFlag || ""} (\`${convRes.convertedTimeShort}\` - UTC ${convRes.toUtcOffset})\n• **التاريخ واليوم في الوجهة:** ${convRes.convertedDayOfWeekAr} (${convRes.convertedDate})\n\n💡 *تم احتساب الفارق والتوقيت الصيفي/الشتوي بدقة عبر محرك التوقيت العالمي IANA.*`;
            providerUsed = "souf-time-tool";
          }
        }

        if (!reply) {
          // Extract location name if present
          let targetLocation = "";
          const locMatch = cleanRawText.match(/(?:في|بـ|بمدينة|بدولة|بمنطقة)\s+([^\s?؟]+(?:\s+[^\s?؟]+)?)/i);
          if (locMatch && locMatch[1]) {
            targetLocation = locMatch[1].replace(/[?؟.]/g, "").trim();
          }

          const timeInfo = getCurrentTimeInfo(targetLocation || "المغرب");
          if (timeInfo.isAmbiguous && timeInfo.suggestedCities && timeInfo.suggestedCities.length > 0) {
            const suggestions = timeInfo.suggestedCities.map((c) => `• \`${c.query}\``).join("\n");
            reply = `🕒 **${timeInfo.questionPrompt || "يرجى تحديد المدينة أو الولاية:"}**\n\nنظراً لأن الدولة تتضمن عدة مناطق زمنية مختلفة، يمكنك سؤالي عن إحدى المدن التالية:\n${suggestions}`;
            providerUsed = "souf-time-tool";
          } else {
            const locLabel = timeInfo.cityName || targetLocation || "المغرب";
            reply = `🕒 **الوقت والتاريخ اللحظي (${locLabel}) ${timeInfo.flagEmoji || ""}**:\n\n• ⏰ **الوقت الحالي:** \`${timeInfo.localTime}\` (${timeInfo.localTimeShort})\n• 📅 **التاريخ:** ${timeInfo.formattedDateAr} (${timeInfo.localDate})\n• 🗓️ **اليوم:** ${timeInfo.dayOfWeekAr}\n• 🌍 **المنطقة الزمنية:** \`${timeInfo.timezone}\` (${timeInfo.utcOffset})${timeInfo.isDST ? " (التوقيت الصيفي نشط)" : ""}`;
            providerUsed = "souf-time-tool";
          }
        }
      } catch (timeErr) {
        console.warn("Direct Telegram time resolution error:", timeErr);
      }
    }

    // ----------------------------------------------------
    // 2. DIRECT AI IMAGE GENERATION TOOL EXECUTION
    // ----------------------------------------------------
    const isImageGenIntent = /(?:^|\s)(?:ارسم|ارسم لي|ولد صورة|ولّد صورة|انشئ صورة|أنشئ صورة|صمم صورة|توليد صورة|صورة لـ|draw|generate image|create image|paint)\s+(.+)/i.test(cleanRawText);

    if (isImageGenIntent && !reply) {
      const match = cleanRawText.match(/(?:ارسم|ارسم لي|ولد صورة|ولّد صورة|انشئ صورة|أنشئ صورة|صمم صورة|توليد صورة|صورة لـ|draw|generate image|create image|paint)\s+(.+)/i);
      const rawPrompt = match ? match[1].trim() : cleanRawText;

      if (rawPrompt.length >= 3) {
        try {
          if (this.config.sendTypingAction) {
            this.sendChatAction(chatId, "upload_photo");
          }

          // Translate/enhance prompt to high quality English for diffusion engines
          let englishPrompt = rawPrompt;
          try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (apiKey) {
              const ai = new GoogleGenAI({ apiKey });
              const transRes = await ai.models.generateContent({
                model: "gemini-3.7-flash",
                contents: `Translate and expand this image prompt into a detailed, photorealistic, artistic English prompt for image generation (only return the prompt text without quotes or explanations):\n"${rawPrompt}"`,
              });
              if (transRes?.text && transRes.text.trim()) {
                englishPrompt = transRes.text.trim();
              }
            }
          } catch {}

          const imgRes = await generateImageViaManager(englishPrompt, {
            width: 1024,
            height: 1024,
          });

          if (imgRes && imgRes.success && imgRes.imageUrl) {
            const caption = `🎨 **تم توليد الصورة الفنية بالذكاء الاصطناعي بنجاح!**\n\n📝 **الوصف:** ${rawPrompt}\n⚡ **المزود:** ${imgRes.providerUsed}`;
            await this.sendPhoto(chatId, imgRes.imageUrl, caption);
            reply = `🎨 **تم إنشاء الصورة وإرسالها إلى المحادثة بنجاح!**\n\nالوصف المطلوب: "${rawPrompt}"\nإذا أردت تعديل أي تفاصيل أو توليد صورة أخرى، أخبرني فوراً!`;
            providerUsed = "souf-image-generator";
          }
        } catch (imgErr) {
          console.warn("Direct Telegram image generation error:", imgErr);
        }
      }
    }

    // ----------------------------------------------------
    // 3. DIRECT PRECISION CALCULATOR TOOL EXECUTION
    // ----------------------------------------------------
    const isMathIntent = /^(?:احسب|كم يساوي|ما ناتج|حساب|احسب لي|كم ناتج|calculate)\s+([0-9+\-*/().,% ^×÷Math.sqrtMath.pow]+)$/i.test(cleanRawText) ||
      /^[0-9+\-*/().,% ^×÷]+$/.test(cleanRawText);

    if (isMathIntent && !reply) {
      const expr = cleanRawText.replace(/^(?:احسب|كم يساوي|ما ناتج|حساب|احسب لي|كم ناتج|calculate)\s+/i, "").trim();
      if (expr && expr.length >= 1) {
        try {
          const calcTool = globalToolRegistry.getTool("calculator");
          if (calcTool) {
            const calcRes = await calcTool.execute({ expression: expr }, { taskId: `calc_${chatId}`, origin: "telegram" });
            if (calcRes && calcRes.success && calcRes.data) {
              reply = `🧮 **نتيجة الحساب الرياضي الدقيق:**\n\n• **المعادلة:** \`${expr}\`\n• **الناتج النهائي:** **${calcRes.data.formatted}**\n\n💡 *تم احتساب النتيجة بدقة عبر أداة الحاسبة الرياضية.*`;
              providerUsed = "souf-calculator-tool";
            }
          }
        } catch (calcErr) {
          console.warn("Direct Telegram calculator execution error:", calcErr);
        }
      }
    }

    // ----------------------------------------------------
    // 4. DIRECT WEB PAGE READER TOOL (open_page)
    // ----------------------------------------------------
    let openPageContext = "";
    const urlMatches = cleanRawText.match(/https?:\/\/[^\s]+/gi);
    if (urlMatches && urlMatches.length > 0 && !reply) {
      const nonDocUrl = urlMatches.find((u: string) => !u.includes("docs.google.com") && !u.includes("drive.google.com"));
      if (nonDocUrl) {
        try {
          if (this.config.sendTypingAction) {
            this.sendChatAction(chatId, "typing");
          }
          const pageTool = globalToolRegistry.getTool("open_page");
          if (pageTool) {
            const pageRes = await pageTool.execute({ url: nonDocUrl }, { taskId: `page_${chatId}`, origin: "telegram" });
            if (pageRes && pageRes.success && pageRes.contextNote) {
              openPageContext = `\n\n${pageRes.contextNote}\nيرجى تلخيص أو الإجابة على استفسار المستخدم استناداً إلى هذا المحتوى الفعلي للرابط.`;
            }
          }
        } catch (pageErr) {
          console.warn("Direct Telegram open_page execution error:", pageErr);
        }
      }
    }

    // ----------------------------------------------------
    // 5. LIVE WEB INTELLIGENCE RETRIEVAL
    // ----------------------------------------------------
    let liveWebContext = "";
    const isExplicitSearch = /^(ابحث عن|ابحث في الويب عن|ابحث لي عن|ابحث لي في النت عن|بحث عن|سوي بحث عن|سيرش عن|search for|google|ابحث)\s+/i.test(cleanRawText);
    const hasSearchKeywords = /(أخبار|مباريات|دوري|نتائج|ترتيب الدوري|أسعار|طقس اليوم|من فاز|أحدث|آخر أخبار|souftools|منصة souf|كورة|كرة القدم|رياضة|أبرز الأحداث)/i.test(cleanRawText);

    if ((isExplicitSearch || hasSearchKeywords) && !reply) {
      const cleanSearchQuery = cleanRawText
        .replace(/^(ابحث عن|ابحث في الويب عن|ابحث لي عن|ابحث لي في النت عن|بحث عن|سوي بحث عن|سيرش عن|search for|google|ابحث)\s+/i, "")
        .trim() || cleanRawText;

      try {
        if (this.config.sendTypingAction) {
          this.sendChatAction(chatId, "typing");
        }
        const searchRes = await executeRawSearchQuery(cleanSearchQuery);
        if (searchRes && searchRes.results && searchRes.results.length > 0) {
          const formatted = searchRes.results
            .slice(0, 5)
            .map((r, idx) => `${idx + 1}. [${r.title}](${r.url})\n   ${r.snippet}`)
            .join("\n\n");
          liveWebContext = `\n\n[نتائج البحث الحي المباشر من الإنترنت الحقيقي (${searchRes.providerUsed}) حول "${cleanSearchQuery}"]:\n${formatted}\n\n⚠️ تعليمات أمان وموثوقية إلزامية:\n1. استند حصراً إلى هذه النتائج الحقيقية الموثقة أعلاه في صياغة الإجابة للمستخدم (${sender}).\n2. اذكر المصادر وروابطها بنسق ماركداون واضح ومباشر مثل: [عنوان المصدر](الرابط).\n3. ممنوع منعاً باتاً كتابة عبارات وهمية مثل "*(جاري البحث في الويب...)*" أو محاكاة عملية البحث كتابياً، ولا تسأله "هل تريد أن أبحث لك؟" لأنك تملك النتائج الحقيقية الآن، بل أجب فوراً بالحقائق.`;
        } else {
          liveWebContext = `\n\n[حالة البحث في الويب عن "${cleanSearchQuery}"]:\nتم إجراء بحث حقيقي في محركات البحث العامة ولم تظهر نتائج خارجية منشورة حديثاً مطابقة لهذا الاستعلام بالكامل. إذا سألك المستخدم، أجب بوضوح بما تعرفه أو وضح أنه لم تتوفر نتائج خارجية منشورة دون ادعاء أو كتابة "*(جاري البحث...)*".`;
        }
      } catch (searchErr) {
        console.warn("Telegram real web search execution error:", searchErr);
      }
    }

    // ----------------------------------------------------
    // 6. MULTI-STEP REAL AUTONOMOUS AGENT RUNTIME EXECUTION
    // ----------------------------------------------------
    let generatedTelegramFiles: Array<{ buffer: Buffer; fileName: string; caption?: string }> = [];
    let generatedTelegramImages: Array<{ photoUrl: string; caption?: string }> = [];

    if (!reply) {
      try {
        const agentModel = (this.config.defaultModel || "core") as any;
        const agentRes = await runAgentRuntime({
          modelId: agentModel,
          prompt: mediaPromptText,
          rawPrompt: cleanRawText,
          channel: "telegram",
          gmailToken: existingGmailToken || undefined,
          userId: pairedUser?.userId || (pairedUser?.email ? `user_${pairedUser.email}` : `tg_${chatId}`),
          maxStepsTier: "balanced",
          webSearchEnabled: true,
          activeTools: [
            ...(existingGmailToken ? ["gmail_search", "gmail_read", "gmail_summarize", "gmail_send", "gmail_draft"] : []),
            "web_search",
            "open_page",
            "souf_file",
            "coding",
            "calculator",
            "generate_image",
            "analyze_image",
            "get_current_time",
            "convert_time",
            "retrieve_memory",
            "save_user_memory",
            "update_user_memory",
            "delete_user_memory",
            "get_user_profile",
            "task_create",
            "task_list",
          ],
        });

        if (agentRes && agentRes.text && agentRes.text.trim()) {
          reply = agentRes.text.trim();
          providerUsed = agentRes.providerUsed || "souf-agent-runtime";
          modelUsed = agentRes.modelUsed || this.config.defaultModel || "gemini-3.7-flash";

          // Extract any real documents/images created by tools
          const observations = agentRes.state?.observations || [];
          for (const obs of observations) {
            if (obs.tool === "souf_file" && obs.result?.success) {
              const fileData = obs.result.data;
              if (fileData?.content && fileData?.name) {
                const buffer = Buffer.from(fileData.content, typeof fileData.content === "string" ? "utf-8" : undefined);
                generatedTelegramFiles.push({ buffer, fileName: fileData.name, caption: `ملف منشأ: ${fileData.name}` });
              }
            } else if (obs.tool === "generate_image" && obs.result?.success) {
              const imgData = obs.result.data;
              const rawImg = imgData?.imageUrl || imgData?.data || (typeof obs.result.data === "string" ? obs.result.data : null);
              if (rawImg && typeof rawImg === "string") {
                generatedTelegramImages.push({ photoUrl: rawImg, caption: imgData?.prompt || "صورة منشأة بواسطة SoufAI" });
              }
            }
          }
        }
      } catch (agentErr) {
        console.warn("Agent Runtime execution warning in Telegram, falling back to router:", agentErr);
      }
    }

    // ----------------------------------------------------
    // 7. ROUTED PROMPT / GEMINI WITH FULL REAL-TIME CONTEXT
    // ----------------------------------------------------
    if (!reply) {
      const nowObj = new Date();
      const liveTimeInfo = getCurrentTimeInfo("المغرب");
      const realTimeHeader = `\n[السياق الزمني الحقيقي اللحظي للخادم]:\n- التاريخ اليوم: ${liveTimeInfo.formattedDateAr} (${liveTimeInfo.localDate})\n- اليوم: ${liveTimeInfo.dayOfWeekAr}\n- الوقت الحالي: ${liveTimeInfo.localTime} (${liveTimeInfo.timezone})\n- التوقيت العالمي UTC: ${nowObj.toISOString()}`;

      const antiFakeInstruction = `\n\n[قواعد صارمة ضد المحاكاة والتمثيل الوهمي (Anti-Simulation Rules)]:\n- ممنوع منعاً باتاً كتابة عبارات وهمية تمثل خطوات كأنها نظام مثل "*(جاري البحث في الويب...)*" أو "دعني أبحث لك..." في نص الرد النهائي.\n- إذا كان السؤال عن أحداث جارية أو كروية أو بحث، أجب فوراً ومباشرة بالمعلومات والحقائق دون تأجيل أو سؤال المستخدم إن كان يريد أن تبحث له.\n- إذا لم تتوفر لديك المعلومة أو نتائج البحث، اعترف بذلك بأمانة واقترح صياغة أدق بدلاً من ادعاء البحث.`;

      const hasWebMessages = history.some((h) => h.content && h.content.includes("[رسالة من المنصة]"));
      const webContinuityNote = hasWebMessages
        ? `\n\n[استمرارية المنصة والتبادل الموحد (Omnichannel Continuity)]:\n- ملاحظة مهمة: هذا المستخدم يتواصل معك أيضاً عبر منصة الويب الرئيسية (SoufAI Web Platform)، وسجل المحادثة يتضمن رسائل متبادلة من هناك تم تمييزها بـ [رسالة من المنصة].\n- أنت نفس الوكيل الموحد المشترك، وتعرف تماماً كل ما قيل وناقشتموه هناك وتتابع معه بدون أي انقطاع.`
        : "";

      const sysInstruction = `${this.config.systemPrompt || "أنت مساعد ذكي يمثل منصة SoufAI."}\nأنت تتحدث مع المستخدم (${sender}) عبر تطبيق تيليجرام. أجب دائماً باللغة العربية الفصحى وبشكل مفيد وواضح وودود ومباشر دون مقدمات طويلة غير مفيدة.${realTimeHeader}${userMemoryContext}${driveContextText}${openPageContext}${liveWebContext}${webContinuityNote}${antiFakeInstruction}`;

      try {
        const selectedModelId = (this.config.defaultModel || "spark") as any;

        const routedResult = await executeRoutedPrompt({
          modelId: selectedModelId,
          prompt: `رسالة المستخدم (${sender}): ${mediaPromptText}`,
          systemInstruction: sysInstruction,
          temperature: this.config.temperature || 0.7,
          attachments: attachments.length > 0 ? attachments : undefined,
          messages: history.map((h) => ({
            role: h.role === "model" ? "assistant" : "user",
            content: h.content,
          })),
        });

        if (
          routedResult &&
          routedResult.text &&
          routedResult.text.trim() &&
          !routedResult.text.includes("ضغطاً مرتفعاً") &&
          !routedResult.text.includes("يرجى التأكد من إضافة وتفعيل")
        ) {
          reply = routedResult.text.trim();
          if (routedResult.providerUsed) providerUsed = routedResult.providerUsed;
          if (routedResult.modelUsed) modelUsed = routedResult.modelUsed;
        } else {
          // Direct Infallible Server-Side Inference Fallback via Gemini 3.7 Flash
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const directParts: any[] = [];
            for (const att of attachments) {
              directParts.push({
                inlineData: {
                  mimeType: att.mimeType,
                  data: att.data,
                },
              });
            }
            directParts.push({ text: `رسالة المستخدم (${sender}): ${mediaPromptText}` });

            const genRes = await ai.models.generateContent({
              model: "gemini-3.7-flash",
              contents: directParts,
              config: {
                systemInstruction: sysInstruction,
                temperature: this.config.temperature || 0.7,
              },
            });

            if (genRes?.text && genRes.text.trim()) {
              reply = genRes.text.trim();
              providerUsed = "souf-direct-engine";
              modelUsed = "gemini-3.7-flash";
            }
          }
        }

        if (!reply) {
          reply = `أهلاً بك يا ${sender}! تم استلام رسالتك بنجاح. أنا في خدمتك عبر منصة SoufAI، كيف يمكنني مساعدتك أكثر؟`;
        }
      } catch (err: any) {
        console.error("Telegram AI Routing Error:", err);
        // Fallback directly to GoogleGenAI
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const genRes = await ai.models.generateContent({
              model: "gemini-3.7-flash",
              contents: `رسالة المستخدم (${sender}): ${mediaPromptText}`,
              config: {
                systemInstruction: "أنت مساعد SoufAI الذكي عبر تيليجرام. أجب بلباقة وفائدة باللغة العربية الفصحى.",
              },
            });
            if (genRes?.text) {
              reply = genRes.text.trim();
              providerUsed = "souf-direct-recovery";
              modelUsed = "gemini-3.7-flash";
            }
          }
        } catch (geminiErr: any) {
          console.error("Direct Recovery Error:", geminiErr);
          reply = `مرحباً ${sender}! تم استلام رسالتك. نواجه ضغطاً مرتفعاً على خوادم المعالجة حالياً، يرجى التفضل بإعادة إرسال رسالتك بعد قليل.`;
        }
      }
    }

    // Strip any hallucinated mock action phrases or simulation strings
    if (reply) {
      reply = reply
        .replace(/\*\((?:جاري البحث|البحث في الويب)[^)]*\)\*/gi, "")
        .replace(/\(جاري البحث في الويب[^)]*\)/gi, "")
        .replace(/^دعني أجري بحثاً مباشراً في الويب[^\n]*\n?/gm, "")
        .replace(/^دعني أبحث لك في الويب[^\n]*\n?/gm, "")
        .trim();
    }

    // Save turn to chat history
    if (reply) {
      history.push({ role: "user", content: mediaPromptText || "[صوت أو وسائط]" });
      history.push({ role: "model", content: reply });
      if (history.length > 14) {
        this.chatHistories.set(chatId, history.slice(-14));
      } else {
        this.chatHistories.set(chatId, history);
      }
    }

    const latency = Date.now() - startTime;
    const sendResult = await this.sendMessage(chatId, reply);

    // Send any generated documents / files to Telegram chat
    for (const doc of generatedTelegramFiles) {
      try {
        await this.sendDocument(chatId, doc.buffer, doc.fileName, doc.caption);
      } catch (docErr) {
        console.warn("Error sending generated document to Telegram:", docErr);
      }
    }

    // Send any generated images to Telegram chat
    for (const img of generatedTelegramImages) {
      try {
        await this.sendPhoto(chatId, img.photoUrl, img.caption);
      } catch (imgErr) {
        console.warn("Error sending generated photo to Telegram:", imgErr);
      }
    }

    // Persist conversation turn into Telegram conversations for sidebar & cloud sync
    this.recordTelegramTurn(chatId, sender, username, mediaPromptText || "[صوت أو وسائط]", reply, pairedUser);

    if (sendResult.success) {
      this.addLog({
        direction: "outbound",
        chatId: String(chatId),
        content: reply.length > 100 ? reply.substring(0, 100) + "..." : reply,
        messageType: "text",
        status: "sent",
        modelUsed: `${modelUsed} (${providerUsed})`,
        latencyMs: latency,
      });
    } else {
      this.config.lastError = sendResult.error || "فشل إرسال الرد إلى تيليجرام";
      this.addLog({
        direction: "outbound",
        chatId: String(chatId),
        content: `فشل الإرسال: ${sendResult.error || "خطأ غير محدد"}`,
        messageType: "text",
        status: "failed",
        modelUsed: `${modelUsed} (${providerUsed})`,
        latencyMs: latency,
      });

      serverErrorManager.recordError({
        title: "فشل إرسال رد تيليجرام (Telegram Outbound Failed)",
        message: `Chat ID: ${chatId}, الخطأ: ${sendResult.error || "رمز البوت غير صالح أو المحادثة محظورة"}`,
        category: "telegram",
        severity: "medium",
      });
    }

    return { handled: true, replyText: reply };
  }
}

// Global Singleton for the Next.js Server Instance
const globalForTelegram = global as unknown as { telegramManager: TelegramManager };
export const telegramManager = globalForTelegram.telegramManager || new TelegramManager();
if (process.env.NODE_ENV !== "production") globalForTelegram.telegramManager = telegramManager;

