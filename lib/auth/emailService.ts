/**
 * SoufTools Server-Side Dual-Engine Email Verification & Delivery Service
 * Engine 1: SMTP / Gmail App Password Engine (Nodemailer Direct)
 * Engine 2: HTTP Mail Gateway Engine (Resend / Brevo / Custom Webhook)
 * Dual Fallback: If Engine 1 fails, Engine 2 executes automatically (or vice-versa).
 */

import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";

type EmailMessageType = "verification" | "password_reset" | "email_verification_link" | "password_reset_link";

interface SendVerificationOptions {
  toEmail: string;
  code?: string;
  type?: EmailMessageType | "login_otp";
  userName?: string;
  actionUrl?: string;
}

interface EmailResult {
  success: boolean;
  engineUsed: "smtp_gmail" | "http_resend" | "in_memory_simulation" | "none";
  messageId?: string;
  error?: string;
}

export function generateVerificationOtp(_email: string): string {
  return String(randomInt(100000, 1000000));
}

/**
 * Builds HTML Email Template with SoufTools brand styling
 */
function buildEmailHtml(
  toEmail: string,
  code: string,
  type: string,
  userName?: string,
  actionUrl?: string
): string {
  const isPasswordReset = type === "password_reset" || type === "password_reset_link";
  const isActionLink = type === "password_reset_link" || type === "email_verification_link";
  const title = isPasswordReset ? "إعادة تعيين كلمة المرور - SoufTools" : "تأكيد وتفعيل البريد الإلكتروني - SoufTools";
  const greeting = userName ? `مرحباً ${escapeHtml(userName)}،` : "مرحباً بك،";
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : "";

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
                ${isActionLink
                  ? isPasswordReset
                    ? "استخدم الرابط الآمن أدناه لاختيار كلمة مرور جديدة. ينتهي الرابط خلال ساعة."
                    : "أكد عنوان بريدك الإلكتروني عبر الرابط أدناه لإكمال إنشاء حسابك."
                  : isPasswordReset
                    ? "لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في SoufTools. استخدم رمز الأمان المؤقت التالي:"
                    : "شكراً لتسجيلك في منصة SoufTools. أدخل الرمز التالي لتأكيد بريدك الإلكتروني:"}
              </p>

              ${isActionLink
                ? `<div style="margin: 25px 0; text-align: center;">
                    <a href="${safeActionUrl}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#00d4aa;color:#07110f;text-decoration:none;font-weight:700;">
                      ${isPasswordReset ? "إعادة تعيين كلمة المرور" : "تأكيد البريد الإلكتروني"}
                    </a>
                  </div>
                  <p style="color:#88b0b0;font-size:12px;line-height:1.6;word-break:break-all;">إذا لم يعمل الزر، افتح هذا الرابط:<br>${safeActionUrl}</p>`
                : `<div style="margin: 25px 0; padding: 22px; background: #080d0d; border: 2px dashed #00d4aa; border-radius: 16px; text-align: center;">
                    <div style="font-size: 12px; color: #88b0b0; margin-bottom: 8px; font-weight: 600; text-transform: uppercase;">رمز التأكيد الخاص بك</div>
                    <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #00f5c4; font-family: monospace;">${escapeHtml(code)}</div>
                    <div style="font-size: 11px; color: #6e9999; margin-top: 10px;">⏳ هذا الرمز صالح لمدة <strong style="color: #00d4aa;">15 دقيقة</strong> فقط</div>
                  </div>`}

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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function getEmailSubject(type?: string): string {
  if (type === "password_reset" || type === "password_reset_link") {
    return type === "password_reset_link"
      ? "🔐 إعادة تعيين كلمة المرور - SoufTools"
      : "🔐 رمز إعادة تعيين كلمة المرور - SoufTools";
  }
  if (type === "email_verification_link") return "⚡ تأكيد البريد الإلكتروني - SoufTools";
  return "⚡ رمز تأكيد البريد الإلكتروني - SoufTools";
}

export function validateAuthActionUrl(value: string): string {
  const url = new URL(value);
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw new Error("Invalid authentication action URL");
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Authentication action URLs must use HTTPS in production");
  }

  const configuredBaseUrl =
    process.env.APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (!configuredBaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Set APP_URL or BETTER_AUTH_URL before sending authentication emails");
    }
    return url.toString();
  }

  const normalizedBaseUrl = /^https?:\/\//i.test(configuredBaseUrl)
    ? configuredBaseUrl
    : `https://${configuredBaseUrl}`;
  const configuredUrl = new URL(normalizedBaseUrl);
  if (
    (configuredUrl.protocol !== "https:" && configuredUrl.protocol !== "http:") ||
    configuredUrl.username ||
    configuredUrl.password ||
    url.origin !== configuredUrl.origin
  ) {
    throw new Error("Authentication action URL does not match the configured application origin");
  }

  return url.toString();
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
          subject: getEmailSubject(opts.type),
          html: buildEmailHtml(opts.toEmail, opts.code || "", opts.type || "verification", opts.userName, opts.actionUrl),
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
        subject: getEmailSubject(opts.type),
        html: buildEmailHtml(opts.toEmail, opts.code || "", opts.type || "verification", opts.userName, opts.actionUrl),
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
          subject: getEmailSubject(opts.type),
          html: buildEmailHtml(opts.toEmail, opts.code || "", opts.type || "verification", opts.userName, opts.actionUrl),
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
        subject: getEmailSubject(opts.type),
        html: buildEmailHtml(opts.toEmail, opts.code || "", opts.type || "verification", opts.userName, opts.actionUrl),
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
async function dispatchEmail(opts: SendVerificationOptions): Promise<EmailResult> {
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

  return {
    success: false,
    engineUsed: "none",
    error: failureSummary || "لم يتم إرسال الرسالة: يرجى التحقق من صحة بريد وكلمة مرور التطبيقات في لوحة التحكم.",
  };
}

export async function sendVerificationEmail(opts: SendVerificationOptions): Promise<EmailResult> {
  return dispatchEmail(opts);
}

export async function sendAuthActionEmail(
  opts: Omit<SendVerificationOptions, "code"> & { actionUrl: string; type: "email_verification_link" | "password_reset_link" }
): Promise<EmailResult> {
  return dispatchEmail({
    ...opts,
    actionUrl: validateAuthActionUrl(opts.actionUrl),
  });
}
