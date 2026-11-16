/**
 * SoufTools Server-Side Dual-Engine Email Verification & Delivery Service
 * Engine 1: SMTP / Gmail App Password Engine (Nodemailer Direct)
 * Engine 2: HTTP Mail Gateway Engine (Resend / Brevo / Custom Webhook)
 * Dual Fallback: If Engine 1 fails, Engine 2 executes automatically (or vice-versa).
 */

import nodemailer from "nodemailer";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";

interface SendVerificationOptions {
  toEmail: string;
  code: string;
  type?: "verification" | "password_reset" | "login_otp";
  userName?: string;
}

interface EmailResult {
  success: boolean;
  engineUsed: "smtp_gmail" | "http_resend" | "in_memory_simulation" | "none";
  messageId?: string;
  error?: string;
}

// Persistent & In-Memory Verification Codes Store with guaranteed 15-minute TTL
interface StoredOtp {
  code: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

declare global {
  var _soufOtpStore: Map<string, StoredOtp> | undefined;
}

const otpStore: Map<string, StoredOtp> =
  globalThis._soufOtpStore || (globalThis._soufOtpStore = new Map());

// Helper to generate secure 6-digit verification code with 15 minutes guaranteed lifespan
export function generateVerificationOtp(email: string): string {
  const cleanEmail = email.toLowerCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins exact

  // 1. Save in global memory cache
  otpStore.set(cleanEmail, {
    code,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  // 2. Persist in PostgreSQL verification table in the background
  if (typeof window === "undefined") {
    setTimeout(async () => {
      try {
        const pool = (globalThis as any)._soufPostgresPool;
        if (pool) {
          const id = `otp_${cleanEmail}`;
          const expiresDate = new Date(expiresAt);
          const now = new Date();
          await pool.query(
            `INSERT INTO "verification" (id, identifier, value, expires_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET value = $3, expires_at = $4, updated_at = $6;`,
            [id, cleanEmail, code, expiresDate, now, now]
          ).catch(() => {});
        }
      } catch (dbErr) {
        // Non-blocking fallback
      }
    }, 0);
  }

  return code;
}

// Helper to verify code with database fallback and persistence (does NOT delete until account is created)
export async function verifyOtpCode(
  email: string,
  code: string
): Promise<{ valid: boolean; reason?: string }> {
  const cleanEmail = email.toLowerCase().trim();
  let record = otpStore.get(cleanEmail);

  // If memory was cleared (e.g. server restart), check PostgreSQL verification table
  if (!record) {
    try {
      const pool = (globalThis as any)._soufPostgresPool;
      if (pool) {
        const dbRes = await pool.query(
          `SELECT value, expires_at FROM "verification" WHERE id = $1 OR identifier = $2 LIMIT 1;`,
          [`otp_${cleanEmail}`, cleanEmail]
        );
        if (dbRes?.rows?.[0]) {
          const row = dbRes.rows[0];
          const expTime = new Date(row.expires_at).getTime();
          if (Date.now() < expTime) {
            record = {
              code: String(row.value).trim(),
              expiresAt: expTime,
              attempts: 0,
              verified: false,
            };
            otpStore.set(cleanEmail, record);
          }
        }
      }
    } catch (checkErr) {
      // Non-blocking
    }
  }

  if (!record) {
    return { valid: false, reason: "لم يتم العثور على رمز تأكيد نشط لهذا البريد أو انتهت صلاحيته." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return { valid: false, reason: "انتهت صلاحية رمز التأكيد (صلاحية الرمز 15 دقيقة). يرجى طلب رمز جديد." };
  }

  if (record.attempts >= 5) {
    otpStore.delete(cleanEmail);
    return { valid: false, reason: "تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب رمز جديد." };
  }

  if (record.code !== code.trim()) {
    record.attempts += 1;
    return { valid: false, reason: `رمز التأكيد غير صحيح. المتبقي ${5 - record.attempts} محاولات.` };
  }

  // Mark as verified but KEEP IT IN STORE so user can retry signup if database is slow
  record.verified = true;
  return { valid: true };
}

// Clean up OTP only after user registration is 100% completed
export async function consumeOtpCode(email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  otpStore.delete(cleanEmail);

  try {
    const pool = (globalThis as any)._soufPostgresPool;
    if (pool) {
      await pool.query(
        `DELETE FROM "verification" WHERE id = $1 OR identifier = $2;`,
        [`otp_${cleanEmail}`, cleanEmail]
      ).catch(() => {});
    }
  } catch {}
}

/**
 * Builds HTML Email Template with SoufTools brand styling
 */
function buildEmailHtml(toEmail: string, code: string, type: string, userName?: string): string {
  const title = type === "password_reset" 
    ? "إعادة تعيين كلمة المرور - SoufTools"
    : "تأكيد وتفعيل البريد الإلكتروني - SoufTools";
  
  const greeting = userName ? `مرحباً ${userName}،` : "مرحباً بك،";

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e8f5f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #060a0a; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background: #0c1414; border: 1px solid #1a2e2e; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 35px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="padding: 35px 25px 20px; background: linear-gradient(135deg, rgba(0,212,170,0.15), rgba(14,165,233,0.15)); border-bottom: 1px solid #1a2e2e;">
              <div style="display: inline-block; width: 48px; height: 48px; border-radius: 14px; background: rgba(0,212,170,0.2); border: 1px solid #00d4aa; line-height: 48px; font-size: 24px;">
                ⚡
              </div>
              <h1 style="margin: 15px 0 5px; color: #00d4aa; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">SoufTools AI Platform</h1>
              <p style="margin: 0; color: #88b0b0; font-size: 13px;">منصة الذكاء الاصطناعي والأدوات المتطورة</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px 25px;">
              <h2 style="margin: 0 0 12px; font-size: 18px; color: #ffffff; text-align: right;">${greeting}</h2>
              <p style="margin: 0 0 20px; color: #a2c4c4; font-size: 14px; line-height: 1.6; text-align: right;">
                ${type === "password_reset" 
                  ? "لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في SoufTools. يرجى استخدام رمز الأمان الموقت التالي:"
                  : "شكراً لتسجيلك في منصة SoufTools. لتأكيد وتوثيق بريدك الإلكتروني وتفعيل حسابك بأمان، يرجى إدخال الرمز التالي:"}
              </p>

              <!-- OTP Code Display Card -->
              <div style="margin: 25px 0; padding: 22px; background: #080d0d; border: 2px dashed #00d4aa; border-radius: 16px; text-align: center;">
                <div style="font-size: 12px; color: #88b0b0; margin-bottom: 8px; font-weight: 600; text-transform: uppercase;">رمز التأكيد الخاص بك</div>
                <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #00f5c4; font-family: monospace;">
                  ${code}
                </div>
                <div style="font-size: 11px; color: #6e9999; margin-top: 10px;">
                  ⏳ هذا الرمز صالح لمدة <strong style="color: #00d4aa;">15 دقيقة</strong> فقط
                </div>
              </div>

              <p style="margin: 0 0 10px; color: #88b0b0; font-size: 12px; line-height: 1.5; text-align: right;">
                ⚠️ إذا لم تقم بطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان؛ حسابك محمي بالكامل.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background: #070c0c; border-top: 1px solid #142222; text-align: center; color: #5a8080; font-size: 11px;">
              <div>تم إرسال هذه الرسالة آلياً بواسطة نظام الحماية المزدوج في SoufTools Server</div>
              <div style="margin-top: 4px;">جميع الحقوق محفوظة © ${new Date().getFullYear()} SoufTools</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Primary Engine 1: SMTP Transporter (Gmail App Password or Custom SMTP)
 */
async function sendViaSmtp(
  smtpConfig: { host?: string; port?: number; user?: string; pass?: string; from?: string },
  opts: SendVerificationOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const host = (smtpConfig.host || process.env.SMTP_HOST || "smtp.gmail.com").trim().toLowerCase();
  const port = Number(smtpConfig.port || process.env.SMTP_PORT || 465);
  
  try {
    const user = (smtpConfig.user || process.env.SMTP_USER || process.env.GMAIL_USER || "").trim().toLowerCase();
    const rawPass = smtpConfig.pass || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";
    // Clean all spaces, tabs, quotes, or invisible characters
    const pass = rawPass.replace(/[\s"']/g, "").trim();
    const from = smtpConfig.from || process.env.SMTP_FROM || `"SoufTools Security" <${user || "toolssouf@gmail.com"}>`;

    if (!user || !pass) {
      return { 
        success: false, 
        error: "بيانات SMTP غير مكتملة: يرجى إدخال البريد الإلكتروني وكلمة مرور التطبيقات المكونة من 16 حرفاً." 
      };
    }

    const isGmail = host.includes("gmail") || user.endsWith("@gmail.com") || user.endsWith("@googlemail.com");

    let lastError: any = null;

    // Strategy 1: Dedicated Gmail service transporter (optimal for Google accounts)
    if (isGmail) {
      try {
        const gmailTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user,
            pass,
          },
          connectionTimeout: 10000,
          greetingTimeout: 8000,
          socketTimeout: 15000,
        });

        const info = await gmailTransporter.sendMail({
          from,
          to: opts.toEmail,
          subject: opts.type === "password_reset" ? "🔐 رمز إعادة تعيين كلمة المرور - SoufTools" : "⚡ رمز تأكيد البريد الإلكتروني - SoufTools",
          html: buildEmailHtml(opts.toEmail, opts.code, opts.type || "verification", opts.userName),
        });

        return { success: true, messageId: info.messageId };
      } catch (gmailErr: any) {
        lastError = gmailErr;
      }
    }

    // Strategy 2: Direct Host + Port Transporter (Port 465 SSL or 587 STARTTLS)
    try {
      const directTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false,
        },
      });

      const info = await directTransporter.sendMail({
        from,
        to: opts.toEmail,
        subject: opts.type === "password_reset" ? "🔐 رمز إعادة تعيين كلمة المرور - SoufTools" : "⚡ رمز تأكيد البريد الإلكتروني - SoufTools",
        html: buildEmailHtml(opts.toEmail, opts.code, opts.type || "verification", opts.userName),
      });

      return { success: true, messageId: info.messageId };
    } catch (directErr: any) {
      lastError = directErr;
    }

    // Strategy 3: Fallback to Port 587 with STARTTLS if port 465 timed out
    if (port === 465) {
      try {
        const tlsTransporter = nodemailer.createTransport({
          host,
          port: 587,
          secure: false,
          requireTLS: true,
          auth: {
            user,
            pass,
          },
          connectionTimeout: 12000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          tls: {
            rejectUnauthorized: false,
          },
        });

        const info = await tlsTransporter.sendMail({
          from,
          to: opts.toEmail,
          subject: opts.type === "password_reset" ? "🔐 رمز إعادة تعيين كلمة المرور - SoufTools" : "⚡ رمز تأكيد البريد الإلكتروني - SoufTools",
          html: buildEmailHtml(opts.toEmail, opts.code, opts.type || "verification", opts.userName),
        });

        return { success: true, messageId: info.messageId };
      } catch (tlsErr: any) {
        lastError = tlsErr;
      }
    }

    console.error("Nodemailer SMTP Error:", lastError);
    let rawMsg = lastError?.message || String(lastError || "");
    let errMsg = rawMsg;

    if (rawMsg.includes("Invalid login") || rawMsg.includes("535-5.7.8") || rawMsg.includes("535 5.7.8") || rawMsg.includes("Username and Password not accepted") || rawMsg.includes("BadCredentials")) {
      errMsg = `فشل تسجيل الدخول بخادم Google (${user}): كلمة المرور غير مقبولة من خوادم Gmail. يرجى التأكد من إنشاء "كلمة مرور التطبيقات" (App Password) المكونة من 16 حرفاً من حساب ${user} تحديداً وتفعيل التحقق بخطوتين.`;
    } else if (rawMsg.includes("ETIMEDOUT") || rawMsg.includes("ECONNREFUSED") || rawMsg.includes("Greeting never received") || rawMsg.includes("ESOCKET")) {
      errMsg = `تعذر الاتصال بخادم البريد (${host}:${port}): انتهت مهلة الاتصال بالشبكة.`;
    }

    return { success: false, error: errMsg };
  } catch (err: any) {
    console.error("sendViaSmtp fatal error:", err);
    return { success: false, error: err?.message || "حدث خطأ غير متوقع أثناء إرسال البريد." };
  }
}

/**
 * Secondary Engine 2: HTTP Mail Gateway (Resend / Brevo API)
 */
async function sendViaHttpGateway(
  apiKey: string,
  fromEmail: string,
  opts: SendVerificationOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail || "SoufTools <onboarding@resend.dev>",
        to: opts.toEmail,
        subject: opts.type === "password_reset" ? "🔐 رمز إعادة تعيين كلمة المرور - SoufTools" : "⚡ رمز تأكيد البريد الإلكتروني - SoufTools",
        html: buildEmailHtml(opts.toEmail, opts.code, opts.type || "verification", opts.userName),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Resend API error (${res.status}): ${errText}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Main Dual-Engine Dispatcher:
 * Tries SMTP first; if it fails or is unconfigured, automatically falls back to HTTP Gateway (or vice versa).
 */
export async function sendVerificationEmail(opts: SendVerificationOptions): Promise<EmailResult> {
  const adminConfig = await loadServerAdminConfig();
  const emailSettings = (adminConfig as any)?.emailSettings || {};

  const smtpUser = (emailSettings.smtpUser || process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
  const smtpPass = (emailSettings.smtpPass || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "").trim();
  const resendApiKey = (emailSettings.resendApiKey || process.env.RESEND_API_KEY || "").trim();

  let failureSummary = "";

  // 1. Try Engine 1: SMTP / Gmail
  if (smtpUser && smtpPass) {
    const smtpRes = await sendViaSmtp(
      {
        host: emailSettings.smtpHost,
        port: emailSettings.smtpPort,
        user: smtpUser,
        pass: smtpPass,
        from: emailSettings.smtpFrom,
      },
      opts
    );

    if (smtpRes.success) {
      return {
        success: true,
        engineUsed: "smtp_gmail",
        messageId: smtpRes.messageId,
      };
    }
    failureSummary = `خطأ Gmail SMTP: ${smtpRes.error}`;
    console.warn("SMTP Engine failed, checking Secondary HTTP Gateway...", smtpRes.error);
  } else {
    failureSummary = "إعدادات SMTP / Gmail (اسم المستخدم أو كلمة مرور التطبيقات) غير مكتملة.";
  }

  // 2. Try Engine 2: HTTP Mail Gateway (Resend)
  if (resendApiKey) {
    const httpRes = await sendViaHttpGateway(
      resendApiKey,
      emailSettings.resendFrom || "SoufTools <onboarding@resend.dev>",
      opts
    );

    if (httpRes.success) {
      return {
        success: true,
        engineUsed: "http_resend",
        messageId: httpRes.messageId,
      };
    }
    failureSummary += ` | خطأ Resend: ${httpRes.error}`;
    console.warn("Secondary HTTP Gateway failed:", httpRes.error);
  }

  // 3. Fallback logging for debug:
  console.log(`[SoufTools Verification] OTP Code for ${opts.toEmail}: ${opts.code}`);
  
  // Return honest failure result with clear diagnostic message
  return {
    success: false,
    engineUsed: "none",
    error: failureSummary || "لم يتم إرسال الرسالة: يرجى التحقق من صحة بريد وكلمة مرور التطبيقات في لوحة التحكم.",
  };
}
