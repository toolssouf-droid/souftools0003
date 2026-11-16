/**
 * Real WhatsApp Web & Meta Cloud API Persistent Daemon Service
 * Powered by @whiskeysockets/baileys WebSocket connection & Meta Graph API
 */

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { whatsappManager } from "./whatsappManager";
import { GoogleGenAI } from "@google/genai";
import { executeRoutedPrompt } from "@/lib/router";
import { serverErrorManager } from "@/lib/errors/errorManager";
import { ScheduledTaskRepository, WhatsAppAuthRepository, UserLearningRepository, MemoryRepository } from "@/lib/db";
import { parseNaturalDateToTimestamp } from "@/lib/agent/tools/taskTools";
import { useTursoAuthState, clearTursoAuthSession } from "./postgresAuthState";
import { buildMemoryContext } from "@/lib/memory/contextBuilder";
import { saveUserMemory, getUserProfileKnowledge } from "@/lib/memory/memoryService";
import { runAgentRuntime } from "@/lib/agent/agentRuntime";

const AUTH_DIR = path.join(process.cwd(), ".wa_auth_session");

// Global in-memory rate limiter per phone number (max 5 messages per 60s)
const userRateLimits = new Map<string, number[]>();

// Global persistent socket reference across Next.js requests
const globalForBaileys = globalThis as unknown as {
  __baileysSocket?: WASocket | null;
  __baileysInitPromise?: Promise<any> | null;
  __baileysReconnectTimeout?: NodeJS.Timeout | null;
  __botSentMessageIds?: Set<string>;
};

if (!globalForBaileys.__botSentMessageIds) {
  globalForBaileys.__botSentMessageIds = new Set<string>();
}
const botSentMessageIds = globalForBaileys.__botSentMessageIds;

let activeSocket: WASocket | null = globalForBaileys.__baileysSocket || null;

/**
 * Clears saved Baileys auth session state from Turso (and cleans up any legacy directory)
 */
export async function clearAuthSession(): Promise<void> {
  try {
    if (globalForBaileys.__baileysReconnectTimeout) {
      clearTimeout(globalForBaileys.__baileysReconnectTimeout);
      globalForBaileys.__baileysReconnectTimeout = null;
    }
    if (activeSocket) {
      try {
        activeSocket.ev.removeAllListeners("connection.update");
        activeSocket.ev.removeAllListeners("creds.update");
        activeSocket.ev.removeAllListeners("messages.upsert");
        activeSocket.end(undefined);
      } catch {
        // ignore socket closing errors
      }
      activeSocket = null;
      globalForBaileys.__baileysSocket = null;
    }
    await clearTursoAuthSession("default", AUTH_DIR).catch((err) => {
      console.warn("clearTursoAuthSession error:", err);
    });
  } catch (err) {
    console.error("Error clearing WhatsApp auth session:", err);
  }
}

/**
 * Automatically restores WhatsApp session if saved credentials exist in Turso or on disk
 */
export async function initWhatsAppAutoRestore() {
  if (
    typeof window === "undefined" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    Boolean(process.env.TURSO_DATABASE_URL)
  ) {
    try {
      const hasDbSession = await WhatsAppAuthRepository.hasSession("default");
      const credsPath = path.join(AUTH_DIR, "creds.json");
      const hasDiskSession = fs.existsSync(credsPath);

      if ((hasDbSession || hasDiskSession) && !activeSocket && !globalForBaileys.__baileysSocket) {
        console.log("[WhatsApp] Auto-restoring WhatsApp session from persistent Turso storage...");
        startBaileysSession("qr").catch((err) => {
          console.warn("Auto-restore WhatsApp session note:", err?.message || err);
        });
      }
    } catch (err) {
      console.warn("Auto-restore check note:", err);
    }
  }
}

/**
 * Recursively unpacks and extracts textual content from any WhatsApp message wrapper:
 * - Direct conversation
 * - extendedTextMessage (formatted text, links, quotes)
 * - ephemeralMessage (Disappearing Messages)
 * - viewOnceMessage / viewOnceMessageV2 / viewOnceMessageV2Extension
 * - documentWithCaptionMessage
 * - imageMessage / videoMessage (captions)
 * - templateButtonReplyMessage / buttonsResponseMessage / listResponseMessage
 * - editedMessage / protocolMessage
 */
export function extractWhatsAppMessageText(msgContent: any): string {
  if (!msgContent) return "";
  if (typeof msgContent === "string") return msgContent.trim();

  // 1. Direct text
  if (typeof msgContent.conversation === "string" && msgContent.conversation.trim()) {
    return msgContent.conversation.trim();
  }

  // 2. Extended text (links, formatted, replies)
  if (typeof msgContent.extendedTextMessage?.text === "string" && msgContent.extendedTextMessage.text.trim()) {
    return msgContent.extendedTextMessage.text.trim();
  }

  // 3. Ephemeral Message (Disappearing Messages) - RECURSIVE
  if (msgContent.ephemeralMessage?.message) {
    const text = extractWhatsAppMessageText(msgContent.ephemeralMessage.message);
    if (text) return text;
  }

  // 4. View Once Messages
  if (msgContent.viewOnceMessage?.message) {
    const text = extractWhatsAppMessageText(msgContent.viewOnceMessage.message);
    if (text) return text;
  }
  if (msgContent.viewOnceMessageV2?.message) {
    const text = extractWhatsAppMessageText(msgContent.viewOnceMessageV2.message);
    if (text) return text;
  }
  if (msgContent.viewOnceMessageV2Extension?.message) {
    const text = extractWhatsAppMessageText(msgContent.viewOnceMessageV2Extension.message);
    if (text) return text;
  }

  // 5. Document with Caption / Media Captions
  if (msgContent.documentWithCaptionMessage?.message) {
    const text = extractWhatsAppMessageText(msgContent.documentWithCaptionMessage.message);
    if (text) return text;
  }
  if (typeof msgContent.imageMessage?.caption === "string" && msgContent.imageMessage.caption.trim()) {
    return msgContent.imageMessage.caption.trim();
  }
  if (typeof msgContent.videoMessage?.caption === "string" && msgContent.videoMessage.caption.trim()) {
    return msgContent.videoMessage.caption.trim();
  }
  if (typeof msgContent.documentMessage?.caption === "string" && msgContent.documentMessage.caption.trim()) {
    return msgContent.documentMessage.caption.trim();
  }

  // 6. Interactive / Button / List Responses
  if (typeof msgContent.buttonsResponseMessage?.selectedButtonId === "string") {
    return msgContent.buttonsResponseMessage.selectedDisplayText || msgContent.buttonsResponseMessage.selectedButtonId;
  }
  if (typeof msgContent.templateButtonReplyMessage?.selectedId === "string") {
    return msgContent.templateButtonReplyMessage.selectedDisplayText || msgContent.templateButtonReplyMessage.selectedId;
  }
  if (typeof msgContent.listResponseMessage?.singleSelectReply?.selectedRowId === "string") {
    return msgContent.listResponseMessage.title || msgContent.listResponseMessage.singleSelectReply.selectedRowId;
  }

  // 7. Edited messages & Protocol wrappers
  if (msgContent.editedMessage?.message) {
    const text = extractWhatsAppMessageText(msgContent.editedMessage.message);
    if (text) return text;
  }
  if (msgContent.protocolMessage?.editedMessage) {
    const text = extractWhatsAppMessageText(msgContent.protocolMessage.editedMessage);
    if (text) return text;
  }

  return "";
}

export function sanitizePhoneNumberForPairing(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  // If starts with 00, replace with nothing
  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }
  // If user entered Moroccan number starting with 06 or 07 without country code:
  if (digits.startsWith("06") || digits.startsWith("07")) {
    digits = "212" + digits.substring(1);
  }
  // If user entered Saudi number starting with 05 without country code:
  if (digits.startsWith("05")) {
    digits = "966" + digits.substring(1);
  }
  // If user entered Egyptian number starting with 01 without country code:
  if (digits.startsWith("01")) {
    digits = "20" + digits.substring(1);
  }
  return digits;
}

/**
 * Initializes real Baileys WhatsApp Web persistent socket connection
 */
export async function startBaileysSession(
  mode: "qr" | "code",
  phoneNumber?: string
): Promise<{ qrDataUrl?: string; pairingCode?: string; success: boolean; message?: string }> {
  // If already connected and authenticated, return success immediately
  if (activeSocket && whatsappManager.getConfig().connectionStatus === "connected") {
    return { success: true, message: "جلسة واتساب متصلة ونشطة بالفعل" };
  }

  // If reconnect timer is pending, clear it
  if (globalForBaileys.__baileysReconnectTimeout) {
    clearTimeout(globalForBaileys.__baileysReconnectTimeout);
    globalForBaileys.__baileysReconnectTimeout = null;
  }

  whatsappManager.prepareConnecting(mode, phoneNumber);

  return new Promise(async (resolve) => {
    let isResolved = false;

    const finish = (result: { qrDataUrl?: string; pairingCode?: string; success: boolean; message?: string }) => {
      if (!isResolved) {
        isResolved = true;
        resolve(result);
      }
    };

    try {
      const { state, saveCreds } = await useTursoAuthState("default", AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
      }));

      const logger = pino({ level: "silent" });

      // If there's an existing socket that was closed or stuck, clean it up
      if (activeSocket) {
        try {
          activeSocket.ev.removeAllListeners("connection.update");
          activeSocket.ev.removeAllListeners("creds.update");
          activeSocket.ev.removeAllListeners("messages.upsert");
          activeSocket.end(undefined);
        } catch {}
        activeSocket = null;
      }

      // Authentic Browser Tuple for WhatsApp Multi-Device Protocol
      const browserConfig: [string, string, string] = ["Ubuntu", "Chrome", "124.0.0.0"];

      const sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: browserConfig,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      activeSocket = sock;
      globalForBaileys.__baileysSocket = sock;

      sock.ev.on("creds.update", saveCreds);

      // Handle pairing code request if in code mode and phone number is provided
      if (mode === "code" && phoneNumber && !sock.authState.creds.registered) {
        const cleanDigits = sanitizePhoneNumberForPairing(phoneNumber);
        if (cleanDigits.length >= 8) {
          setTimeout(async () => {
            try {
              if (sock && !sock.authState.creds.registered) {
                const code = await sock.requestPairingCode(cleanDigits);
                if (code) {
                  let formattedCode = code;
                  if (code.length === 8 && !code.includes("-")) {
                    formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;
                  }

                  whatsappManager.updateConfig({
                    pairingCode: formattedCode,
                    connectionStatus: "waiting_scan",
                    pairingMethod: "code",
                    agentPhoneNumber: `+${cleanDigits}`,
                  });

                  whatsappManager.addLog({
                    direction: "system",
                    phone: `+${cleanDigits}`,
                    content: `تم استلام رمز الاقتران المباشر (${formattedCode}) من خوادم واتساب. أدخل الرمز في تطبيق الهاتف الآن.`,
                    status: "delivered",
                    automated: true,
                  });

                  finish({ pairingCode: formattedCode, success: true });
                }
              }
            } catch (err: any) {
              console.error("Baileys requestPairingCode error:", err?.message || err);
              whatsappManager.updateConfig({
                connectionStatus: "disconnected",
                pairingCode: null,
              });
              whatsappManager.addLog({
                direction: "system",
                phone: `+${cleanDigits}`,
                content: `تعذر طلب رمز الاقتران: ${err?.message || "خطأ في الاتصال بخوادم واتساب"}`,
                status: "failed",
                automated: true,
              });
              finish({ success: false, message: err?.message || "فشل طلب رمز الاقتران من خوادم واتساب" });
            }
          }, 2000);
        }
      }

      // Handle real connection status updates
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // When WhatsApp servers emit a fresh QR Code
        if (qr && mode === "qr") {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              errorCorrectionLevel: "M",
              margin: 2,
              width: 280,
              color: {
                dark: "#000000",
                light: "#ffffff",
              },
            });

            whatsappManager.updateConfig({
              qrCodeData: qrDataUrl,
              qrExpiresAt: Date.now() + 50000,
              connectionStatus: "waiting_scan",
              pairingMethod: "qr",
            });

            whatsappManager.addLog({
              direction: "system",
              phone: "WhatsApp Web",
              content: "تم توليد رمز QR مشفر أصلي من خوادم واتساب الرسمية. يرجى المسح من الهاتف.",
              status: "delivered",
              automated: true,
            });

            finish({ qrDataUrl, success: true });
          } catch (e) {
            console.error("Failed to render authentic QR string to Data URL:", e);
          }
        }

        // When connection is successfully established
        if (connection === "open") {
          const userJid = sock.user?.id || "";
          const connectedPhone = userJid.split(":")[0] || userJid.split("@")[0] || "Connected Device";
          const formattedNumber = connectedPhone.startsWith("+") ? connectedPhone : `+${connectedPhone}`;

          whatsappManager.updateConfig({
            connectionStatus: "connected",
            connectedNumber: formattedNumber,
            agentPhoneNumber: formattedNumber,
            lastConnectedAt: Date.now(),
            qrCodeData: null,
            pairingCode: null,
            qrExpiresAt: null,
          });

          whatsappManager.addLog({
            direction: "system",
            phone: formattedNumber,
            content: `تم تأكيد الاتصال بنجاح بخوادم واتساب للرقم (${formattedNumber}). البوابة متصلة وجاهزة للرد الذكي.`,
            status: "delivered",
            automated: true,
          });

          finish({ success: true });
        }

        // When connection is closed or disconnected
        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const disconnectMessage = (lastDisconnect?.error as any)?.message || `رمز الحالة: ${statusCode || "غير محدد"}`;

          console.warn("Baileys Socket closed:", statusCode, disconnectMessage);

          if (statusCode === DisconnectReason.loggedOut) {
            serverErrorManager.recordError({
              title: "تم تسجيل خروج واتساب من الهاتف (WhatsApp Logged Out)",
              message: "تم إلغاء اقتران الهاتف بالمنصة من تطبيق واتساب.",
              category: "whatsapp",
              severity: "high",
              statusCode: statusCode,
            });
            clearAuthSession();
            whatsappManager.updateConfig({
              connectionStatus: "disconnected",
              connectedNumber: null,
              qrCodeData: null,
              pairingCode: null,
            });
            finish({ success: false, message: "تم تسجيل الخروج من تطبيق واتساب" });
            return;
          }

          // Handle automatic reconnection for non-logout disconnects
          const shouldReconnect =
            statusCode === DisconnectReason.restartRequired ||
            statusCode === DisconnectReason.connectionLost ||
            statusCode === DisconnectReason.timedOut ||
            statusCode === 515 ||
            statusCode === 428;

          if (shouldReconnect) {
            whatsappManager.addLog({
              direction: "system",
              phone: "Gateway",
              content: `جاري إعادة محاولة الاتصال التلقائي بمقبس واتساب (${disconnectMessage})...`,
              status: "delivered",
              automated: true,
            });

            globalForBaileys.__baileysReconnectTimeout = setTimeout(() => {
              startBaileysSession(mode, phoneNumber).catch((err) => {
                console.error("Auto-reconnect error:", err);
              });
            }, 3000);
          } else {
            whatsappManager.updateConfig({
              connectionStatus: "disconnected",
              qrCodeData: null,
              pairingCode: null,
            });
            finish({ success: false, message: disconnectMessage });
          }
        }
      });

      // Handle incoming messages for AI auto-reply and natural language scheduling
      sock.ev.on("messages.upsert", async (m) => {
        try {
          if (!m.messages || m.messages.length === 0) return;
          for (const msg of m.messages) {
            const senderJid = msg.key.remoteJid || "";
            const messageContent = extractWhatsAppMessageText(msg.message);

            if (!senderJid || !messageContent) continue;

            // Security & Privacy Isolation: ONLY process individual peer chats.
            // Strict filter against group chats (@g.us), status broadcasts (@broadcast), and newsletters (@newsletter)
            if (
              senderJid.endsWith("@g.us") ||
              senderJid.endsWith("@broadcast") ||
              senderJid.endsWith("@newsletter")
            ) {
              continue;
            }

            // Skip messages sent by the bot itself to prevent infinite loops
            if (msg.key.id && botSentMessageIds.has(msg.key.id)) {
              continue;
            }

            // Check if this message is a self-chat test from the connected user's own phone
            const connectedUserJid = sock.user?.id || "";
            const connectedUserDigits = connectedUserJid.split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
            const remoteUserDigits = senderJid.split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
            const isSelfChat = Boolean(connectedUserDigits && remoteUserDigits && connectedUserDigits === remoteUserDigits);

            // If it is from the linked phone, only proceed if the user is testing via self-chat
            if (msg.key.fromMe && !isSelfChat) {
              continue;
            }

            // Normalize JID: Clean device indices (:1, :2) so message is addressed properly
            const cleanUserPart = senderJid.split("@")[0].split(":")[0];
            const isLid = senderJid.includes("@lid");
            const targetReplyJid = isLid ? `${cleanUserPart}@lid` : `${cleanUserPart}@s.whatsapp.net`;
            const cleanPhoneDigits = cleanUserPart.replace(/[^0-9]/g, "");
            const senderPhone = cleanPhoneDigits.length >= 7 ? `+${cleanPhoneDigits}` : cleanUserPart;

            // Security Check: Rate Limiting & DoS Protection (max 5 requests per 60 seconds per phone)
            const now = Date.now();
            const recentTimestamps = (userRateLimits.get(senderPhone) || []).filter((t) => now - t < 60000);
            if (recentTimestamps.length >= 5) {
              if (recentTimestamps.length === 5) {
                recentTimestamps.push(now);
                userRateLimits.set(senderPhone, recentTimestamps);
                try {
                  await sock.sendMessage(targetReplyJid, {
                    text: "⏳ عذراً، لقد تجاوزت الحد المسموح به من الرسائل في الدقيقة (5 رسائل كحد أقصى). يرجى الانتظار دقيقة واحدة لحماية الخدمة والاستمرار.",
                  });
                } catch {}
              }
              continue;
            }
            recentTimestamps.push(now);
            userRateLimits.set(senderPhone, recentTimestamps);

            // Log incoming message (Isolated per phone number)
            whatsappManager.addLog({
              direction: "inbound",
              phone: senderPhone,
              content: messageContent,
              status: "received",
              automated: false,
            });

            // Auto AI Reply & Proactive Scheduling if enabled
            const config = whatsappManager.getConfig();
            if (config.autoAiReply) {
              try {
                let replyText = "";
                const cleanMsg = messageContent.trim();
                const pairedUser = await whatsappManager.getPairedUser(senderPhone);

                // 0. SMART USER ACCOUNT PAIRING INTERCEPTOR FOR WHATSAPP
                const cleanUpper = cleanMsg.toUpperCase();
                const pairRegex = /(?:ربط|link|connect|اقتران)\s*(?:بـ|ب|حسابي)?\s*([a-zA-Z0-9_-]{4,15})/i;
                const pairMatch = cleanMsg.match(pairRegex);
                const codeCandidate = pairMatch ? pairMatch[1].toUpperCase() : (cleanUpper.startsWith("WA-") ? cleanUpper : "");

                if (codeCandidate) {
                  const newlyPaired = await whatsappManager.linkUserByCode(codeCandidate, senderPhone, msg.pushName || "");
                  if (newlyPaired) {
                    replyText = `🎉 *أهلاً بك يا ${newlyPaired.firstName || "عزيزي"}!*\n\n✅ *تم ربط حسابك في منصة SoufAI بنجاح!* \n📧 *البريد المرتبط:* \`${newlyPaired.email || "حسابك الشخصي"}\`\n\n🧠 أصبحت ذاكرتك الشخصية وسياقك متصلين معي هنا على واتساب. يمكنك الآن:\n• تذكيرك بمهامك ومواعيدك ومزامنتها على الويب.\n• استرجاع ومتابعة معلوماتك وأعمالك السابقة.\n• سؤالي عن أي شيء في أي وقت وسأجيبك متذكراً تفضيلاتك 🌟`;
                  }
                }

                const isScheduleIntent = /(فكرني|دكرني|علمني|ذكرني|جدول لي|جدولة|تذكير|سجل مهمة|سجل موعد|نبهني|موعد|remind me|schedule|set a reminder|alert me|rappelle moi|fais moi penser)/i.test(cleanMsg);

                // 1. SMART SCHEDULING INTERCEPTOR FOR WHATSAPP
                if (!replyText && isScheduleIntent) {
                  try {
                    let scheduleTitle = cleanMsg
                      .replace(/^(فكرني أن|فكرني بـ|فكرني ب|فكرني|ذكرني أن|ذكرني بـ|ذكرني ب|ذكرني|جدول لي|جدول|تذكير بـ|تذكير ب|نبهني بـ|نبهني|remind me to|remind me about|rappelle moi de|rappelle moi)\s*/i, "")
                      .trim() || cleanMsg;

                    let { timestamp, formatted, recurrence } = parseNaturalDateToTimestamp(cleanMsg);
                    let detectedLang = "ar";

                    // Use Gemini for fine-grained multi-language dialect understanding if key is available
                    if (process.env.GEMINI_API_KEY) {
                      try {
                        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                        const aiSchedulePrompt = `أنت محرك ذكي لاستخراج مواعيد التذكير عبر واتساب.
حلل رسالة المستخدم: "${cleanMsg}"
التوقيت الحالي: ${new Date().toISOString()} (Epoch: ${Date.now()})

أجب فقط بصيغة JSON:
{
  "title": "موضوع التذكير بنص نظيف ومختصر بدون أوامر",
  "targetTimestamp": ${Date.now() + 15 * 60 * 1000},
  "recurrence": "once" | "daily" | "weekly" | "workdays" | "monthly",
  "friendlyTime": "وصف الموعد بلطافة بنفس لغة المستخدم",
  "lang": "ar" | "fr" | "en" | "es" | "darija"
}`;
                        const aiRes = await ai.models.generateContent({
                          model: "gemini-3.7-flash",
                          contents: aiSchedulePrompt,
                          config: { responseMimeType: "application/json", temperature: 0.1 },
                        });

                        if (aiRes?.text) {
                          const parsed = JSON.parse(aiRes.text);
                          if (parsed && typeof parsed.targetTimestamp === "number" && parsed.targetTimestamp > Date.now() - 60000) {
                            timestamp = parsed.targetTimestamp;
                            if (parsed.title) scheduleTitle = parsed.title;
                            if (parsed.recurrence) recurrence = parsed.recurrence;
                            if (parsed.friendlyTime) formatted = parsed.friendlyTime;
                            if (parsed.lang) detectedLang = parsed.lang;
                          }
                        }
                      } catch {}
                    }

                    // Save to database associated with authenticated user if paired
                    const effectiveUserId = pairedUser?.userId || senderPhone;
                    await ScheduledTaskRepository.createTask({
                      userId: effectiveUserId,
                      chatId: senderPhone,
                      channel: "whatsapp",
                      title: scheduleTitle,
                      type: "reminder",
                      prompt: cleanMsg,
                      targetTimestamp: timestamp,
                      targetDateIso: new Date(timestamp).toISOString(),
                      recurrence,
                      autoExecute: true,
                    });

                    const diffMins = Math.max(1, Math.round((timestamp - Date.now()) / 60000));
                    const friendlyDiff = diffMins >= 60 ? `${Math.floor(diffMins / 60)} ساعة و ${diffMins % 60} دقيقة` : `${diffMins} دقيقة`;

                    if (detectedLang === "fr") {
                      replyText = `🔔 *C'est noté avec plaisir !*\n\n📌 *Rappel :* ${scheduleTitle}\n📅 *Moment :* ${formatted} (dans ~${friendlyDiff})\n${recurrence !== "once" ? `🔄 *Répétition :* ${recurrence}\n` : ""}\nJe vous enverrai un message ici sur WhatsApp à l'heure exacte ✨`;
                    } else if (detectedLang === "en") {
                      replyText = `🔔 *Got it! Reminder set successfully.*\n\n📌 *Task :* ${scheduleTitle}\n📅 *Time :* ${formatted} (in ~${friendlyDiff})\n${recurrence !== "once" ? `🔄 *Recurrence :* ${recurrence}\n` : ""}\nI will send you a message here on WhatsApp when the time comes ✨`;
                    } else {
                      replyText = `🔔 *تم يا غالي، سأذكرك في الموعد المحدد!* \n\n📌 *الموضوع :* ${scheduleTitle}\n📅 *الموعد :* ${formatted} (بعد حوالي ${friendlyDiff})\n${recurrence !== "once" ? `🔄 *التكرار :* ${recurrence === "daily" ? "يومياً" : recurrence === "weekly" ? "أسبوعياً" : recurrence}\n` : ""}\nسأرسل لك تذكيراً مباشراً هنا على واتساب فور حلول الوقت 🌟`;
                    }
                  } catch (schErr) {
                    console.error("WhatsApp schedule handling note:", schErr);
                  }
                }

                // 2. STANDARD AI CONVERSATION IF NOT A SCHEDULE REQUEST
                if (!replyText) {
                  let userContextAddition = "";
                  const scopedWaId = `wa_${senderPhone.replace(/[^0-9a-zA-Z_-]/g, "") || "peer"}`;
                  const effectiveUserId =
                    pairedUser?.userId ||
                    (pairedUser?.email ? `user_${pairedUser.email}` : scopedWaId);

                  // 1. Unified Long-Term Memory Engine Context Injection
                  try {
                    const memoryResult = await buildMemoryContext({
                      userId: effectiveUserId,
                      prompt: cleanMsg,
                    });

                    if (memoryResult.contextBlock) {
                      userContextAddition += `\n\n${memoryResult.contextBlock}`;
                    }

                    // Auto-persist new candidate memories extracted from natural chat
                    if (memoryResult.candidateNewMemory && memoryResult.candidateNewMemory.content) {
                      try {
                        await saveUserMemory(effectiveUserId, {
                          type: memoryResult.candidateNewMemory.type,
                          content: memoryResult.candidateNewMemory.content,
                          userName: memoryResult.candidateNewMemory.userName,
                          importance: memoryResult.candidateNewMemory.importance,
                          confidence: memoryResult.candidateNewMemory.confidence,
                          source: "whatsapp" as any,
                        });
                      } catch {}
                    }
                  } catch (memErr) {
                    console.warn("Unified memory context builder note in WhatsApp:", memErr);
                  }

                  // 2. Explicit Memory Saving Command ("تذكر أن...", "احفظ عندك أن...")
                  const memoryIntentMatch = cleanMsg.match(/^(?:تذكر أن|احفظ عندك أن|سجل عندك أن|لا تنسى أن|تذكر دائماً أن|remember that)\s*(.+)/i);
                  if (memoryIntentMatch) {
                    const factToRemember = memoryIntentMatch[1].trim();
                    if (factToRemember) {
                      try {
                        await saveUserMemory(effectiveUserId, {
                          type: "knowledge",
                          content: factToRemember,
                          source: "whatsapp" as any,
                          userName: "سفيان",
                          importance: 0.9,
                        });
                        replyText = `🧠 *تم حفظ هذه المعلومة في ذاكرتك الدائمة بنجاح!* ✨\n\n📌 *المحفوظ:* "${factToRemember}"\n\nسأتذكرها دائماً خلال محادثاتنا هنا على واتساب وفي المنصة وتيليجرام.`;
                      } catch (memErr) {
                        console.warn("Failed saving WhatsApp memory:", memErr);
                      }
                    }
                  }

                  // 3. User Learning Patterns Injection
                  if (pairedUser?.userId) {
                    try {
                      const patterns = await UserLearningRepository.listPatternsByUser(pairedUser.userId);
                      if (patterns && patterns.length > 0) {
                        userContextAddition += `\n[تفضيلات وذاكرة المستخدم المستفادة:\n${patterns.slice(0, 5).map((p: any) => `- ${p.key}: ${p.value}`).join("\n")}]`;
                      }
                    } catch {}
                  }

                  const sysInstruction = `${config.systemPrompt || "أنت مساعد ذكي ودود يمثل منصة SoufAI."}${userContextAddition}\nأنت تتحدث مع مستخدم عبر واتساب. أجب بلغة المستخدم أو لهجته بلباقة وفائدة واختصار ودون أي مصطلحات تقنية عن سيرفرات أو قواعد بيانات. خاطب المستخدم باسمه الشخصي الطبيعي دائماً.`;
                  const targetModelId = config.preferredModelId || "core";

                  let generatedFilesToSend: Array<{ buffer: Buffer; fileName: string; mimetype: string }> = [];
                  let generatedImagesToSend: Array<{ buffer: Buffer; caption?: string }> = [];

                  // 1. Multi-Step Real Autonomous Agent Execution
                  try {
                    const agentRes = await runAgentRuntime({
                      modelId: targetModelId,
                      prompt: `${sysInstruction}\n\nرسالة المستخدم عبر واتساب:\n"${messageContent}"`,
                      rawPrompt: cleanMsg,
                      channel: "whatsapp",
                      userId: effectiveUserId,
                      maxStepsTier: "balanced",
                      webSearchEnabled: true,
                      activeTools: [
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
                      replyText = agentRes.text.trim();

                      // Inspect observations for generated files or images
                      const observations = agentRes.state?.observations || [];
                      for (const obs of observations) {
                        if (obs.tool === "souf_file" && obs.result?.success) {
                          const fileData = obs.result.data;
                          if (fileData?.content && fileData?.name) {
                            const buffer = Buffer.from(fileData.content, typeof fileData.content === "string" ? "utf-8" : undefined);
                            const mime = fileData.mimeType || (fileData.name.endsWith(".pdf") ? "application/pdf" : fileData.name.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain");
                            generatedFilesToSend.push({ buffer, fileName: fileData.name, mimetype: mime });
                          }
                        } else if (obs.tool === "generate_image" && obs.result?.success) {
                          const imgData = obs.result.data;
                          const rawImg = imgData?.imageUrl || imgData?.data || (typeof obs.result.data === "string" ? obs.result.data : null);
                          if (rawImg && typeof rawImg === "string") {
                            const cleanB64 = rawImg.includes(";base64,") ? rawImg.split(";base64,")[1] : rawImg;
                            if (cleanB64.length > 100) {
                              generatedImagesToSend.push({ buffer: Buffer.from(cleanB64, "base64"), caption: imgData?.prompt || "صورة منشأة بواسطة SoufAI" });
                            }
                          }
                        }
                      }
                    }
                  } catch (agentErr) {
                    console.warn("Agent Runtime execution note on WhatsApp:", agentErr);
                  }

                  // 2. Fallback to Routed Prompt if Agent did not produce replyText
                  if (!replyText) {
                    try {
                      const routedRes = await executeRoutedPrompt({
                        modelId: targetModelId as any,
                        prompt: `رسالة المستخدم عبر واتساب:\n"${messageContent}"\n\nأجب بإجابة دقيقة ومفيدة وودية:`,
                        systemInstruction: sysInstruction,
                      });

                      if (routedRes?.text && !routedRes.text.includes("يرجى التأكد من إضافة وتفعيل مفاتيح الذكاء") && !routedRes.text.includes("نواجه حالياً ضغطاً")) {
                        replyText = routedRes.text.trim();
                      }
                    } catch (rErr) {
                      console.warn("Routed prompt note on WhatsApp:", rErr);
                    }
                  }

                  // 3. High-Reliability Fallback using server-side Gemini API
                  if ((!replyText || replyText.includes("نواجه حالياً ضغطاً")) && process.env.GEMINI_API_KEY) {
                    try {
                      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                      const gen = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: `رسالة المستخدم عبر واتساب:\n"${messageContent}"`,
                        config: {
                          systemInstruction: sysInstruction,
                          temperature: 0.7,
                        },
                      });
                      if (gen?.text && gen.text.trim()) {
                        replyText = gen.text.trim();
                      }
                    } catch (gErr) {
                      console.warn("Direct Gemini fallback note on WhatsApp:", gErr);
                    }
                  }

                  if (!replyText) {
                    replyText = "أهلاً بك! تم استلام رسالتك بنجاح، كيف يمكنني مساعدتك أكثر اليوم؟";
                  }

                  // Send any generated documents/images via Baileys socket first
                  for (const doc of generatedFilesToSend) {
                    try {
                      await sock.sendMessage(targetReplyJid, {
                        document: doc.buffer,
                        fileName: doc.fileName,
                        mimetype: doc.mimetype,
                      });
                    } catch (docSendErr) {
                      console.warn("Failed sending generated document to WhatsApp:", docSendErr);
                    }
                  }

                  for (const img of generatedImagesToSend) {
                    try {
                      await sock.sendMessage(targetReplyJid, {
                        image: img.buffer,
                        caption: img.caption,
                      });
                    } catch (imgSendErr) {
                      console.warn("Failed sending generated image to WhatsApp:", imgSendErr);
                    }
                  }
                }

                let sentMsg: any = null;
                try {
                  sentMsg = await sock.sendMessage(targetReplyJid, { text: replyText }, { quoted: msg });
                } catch {
                  sentMsg = await sock.sendMessage(targetReplyJid, { text: replyText });
                }

                if (sentMsg?.key?.id) {
                  botSentMessageIds.add(sentMsg.key.id);
                  if (botSentMessageIds.size > 1000) {
                    const first = botSentMessageIds.values().next().value;
                    if (first) botSentMessageIds.delete(first);
                  }
                }

                whatsappManager.addLog({
                  direction: "outbound",
                  phone: senderPhone,
                  content: replyText,
                  status: "sent",
                  automated: true,
                });
              } catch (aiErr: any) {
                console.error("WhatsApp AI Auto-Reply Error:", aiErr);
                serverErrorManager.recordError({
                  title: "تعثر الرد الذكي التلقائي لواتساب (WhatsApp AI Auto-Reply Failed)",
                  message: aiErr?.message || "فشل توليد رد الذكاء الاصطناعي على رسالة الواتساب الواردة.",
                  category: "whatsapp",
                  severity: "medium",
                  stackTrace: aiErr?.stack,
                });
              }
            }
          }
        } catch (err) {
          console.error("Error handling incoming WhatsApp message:", err);
        }
      });

      // Timeout for the initial handshake promise (10 seconds)
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          const currentConfig = whatsappManager.getConfig();
          resolve({
            qrDataUrl: currentConfig.qrCodeData || undefined,
            pairingCode: currentConfig.pairingCode || undefined,
            success: true,
            message: "جاري استكمال الاتصال بخوادم واتساب في الخلفية...",
          });
        }
      }, 10000);
    } catch (err: any) {
      console.error("Fatal Baileys Session Error:", err);
      whatsappManager.updateConfig({ connectionStatus: "disconnected" });
      finish({ success: false, message: err?.message || "فشل تهيئة جلسة واتساب" });
    }
  });
}

/**
 * Sends a real outbound WhatsApp message using Baileys socket or Meta Cloud API
 */
export async function sendRealWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; messageId: string; error?: string }> {
  const cleanPhone = to.replace(/[^0-9]/g, "");
  if (!cleanPhone) {
    return { success: false, messageId: "", error: "رقم الهاتف المستهدف غير صحيح" };
  }

  // 1. Try Baileys Active Socket first
  if (activeSocket && whatsappManager.getConfig().connectionStatus === "connected") {
    try {
      const jid = `${cleanPhone}@s.whatsapp.net`;
      const sent = await activeSocket.sendMessage(jid, { text: message });
      const messageId = sent?.key?.id || `baileys_${Date.now()}`;
      if (sent?.key?.id) {
        botSentMessageIds.add(sent.key.id);
      }

      whatsappManager.addLog({
        direction: "outbound",
        phone: `+${cleanPhone}`,
        content: message,
        status: "sent",
        automated: false,
      });

      return { success: true, messageId };
    } catch (err: any) {
      console.error("Baileys Socket Send Error:", err);
      serverErrorManager.recordError({
        title: "فشل إرسال رسالة واتساب عبر المقبس (Baileys Socket Send Error)",
        message: err?.message || "تعذر إرسال رسالة الواتساب الصادرة عبر جلسة المقبس النشطة.",
        category: "whatsapp",
        severity: "medium",
        stackTrace: err?.stack,
      });
    }
  }

  // 2. Try Meta WhatsApp Cloud API if env variables present
  const cloudToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (cloudToken && phoneId) {
    try {
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      });

      const metaData = await metaRes.json();
      if (metaRes.ok && metaData.messages?.[0]?.id) {
        const messageId = metaData.messages[0].id;

        whatsappManager.addLog({
          direction: "outbound",
          phone: `+${cleanPhone}`,
          content: message,
          status: "sent",
          automated: false,
        });

        return { success: true, messageId };
      } else {
        console.error("Meta Cloud API Error:", metaData);
        serverErrorManager.recordError({
          title: "خطأ Meta WhatsApp Cloud API",
          message: JSON.stringify(metaData?.error || metaData),
          category: "whatsapp",
          severity: "high",
          statusCode: metaRes.status,
        });
      }
    } catch (err: any) {
      console.error("Meta API Request Failed:", err);
      serverErrorManager.recordError({
        title: "تعذر الاتصال بـ Meta WhatsApp Cloud API",
        message: err?.message || "فشل الاتصال بـ Graph API لواتساب.",
        category: "whatsapp",
        severity: "medium",
        stackTrace: err?.stack,
      });
    }
  }

  return { success: false, messageId: "", error: "لا يوجد اتصال نشط بواتساب حالياً لإرسال الرسالة." };
}
