/**
 * SoufTools Better Auth Server Configuration
 * Configures Better Auth with Turso (libSQL/SQLite) Drizzle adapter, email/password, social OAuth (Google, GitHub),
 * RBAC roles, rate-limiting, and secure cookies.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import crypto from "crypto";
import { getDb, isDbConnected } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getInMemoryAdminConfig } from "@/lib/adminConfigStore";
import { emailOTP } from "better-auth/plugins";
import {
  getAuthBaseUrl,
  sendAuthActionEmail,
  sendVerificationEmail,
} from "@/lib/auth/emailService";

function getAuthCredentials() {
  const inMem = getInMemoryAdminConfig()?.authProviders || {};

  const googleClientId = (
    process.env.GOOGLE_CLIENT_ID ||
    inMem.googleClientId ||
    ""
  ).trim();

  const googleClientSecret = (
    process.env.GOOGLE_CLIENT_SECRET ||
    inMem.googleClientSecret ||
    ""
  ).trim();

  const githubClientId = (
    process.env.GITHUB_CLIENT_ID ||
    inMem.githubClientId ||
    ""
  ).trim();

  const githubClientSecret = (
    process.env.GITHUB_CLIENT_SECRET ||
    inMem.githubClientSecret ||
    ""
  ).trim();

  return {
    googleClientId,
    googleClientSecret,
    githubClientId,
    githubClientSecret,
  };
}

export function createAuthInstance(customBaseUrl?: string) {
  if (!isDbConnected()) {
    return {
      api: {
        getSession: async () => null,
      },
      handler: async () =>
        new Response(
          JSON.stringify({
            error: "Database is not configured for authentication",
            code: "DB_NOT_CONFIGURED",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        ),
    } as any;
  }

  try {
    const creds = getAuthCredentials();
    const appUrl = customBaseUrl || getAuthBaseUrl();

    const hasGoogle = Boolean(creds.googleClientId && creds.googleClientSecret);
    const hasGithub = Boolean(creds.githubClientId && creds.githubClientSecret);

    const authSecret =
      process.env.BETTER_AUTH_SECRET ||
      process.env.SESSION_SECRET;
    if (!authSecret || authSecret.trim().length < 32) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Production authentication secret is missing or too short");
      }
      throw new Error("BETTER_AUTH_SECRET or SESSION_SECRET must contain at least 32 characters");
    }

    return betterAuth({
      secret: authSecret,
      baseURL: appUrl,
      advanced: {
        useSecureCookies: process.env.NODE_ENV === "production",
        defaultCookieAttributes: {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
        },
      },

      trustedOrigins: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.*",
        "http://192.168.*:*",
        "http://10.*",
        "http://10.*:*",
        "http://172.*",
        "http://172.*:*",
        "http://*:3000",
        "https://*.run.app",
        "https://*.google.com",
        "https://*.aistudio.google.com",
        "https://*.vercel.app",
        "https://*.netlify.app",
        appUrl,
        ...(process.env.APP_URL ? [process.env.APP_URL] : []),
        ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
      ],

      database: drizzleAdapter(getDb(), {
        provider: "sqlite",
        schema: {
          user: schema.users,
          session: schema.userSessions,
          account: schema.accounts,
          verification: schema.verifications,
        },
      }),

      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        minPasswordLength: 6,
        autoSignIn: false,
        resetPasswordTokenExpiresIn: 60 * 60,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => {
          const result = await sendAuthActionEmail({
            toEmail: user.email,
            userName: user.name || undefined,
            type: "password_reset_link",
            actionUrl: url,
          });
          if (!result.success) {
            throw new Error(result.error || "Failed to send password reset email");
          }
        },
      },

      emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
      },

      plugins: [
        emailOTP({
          otpLength: 6,
          expiresIn: 15 * 60,
          allowedAttempts: 3,
          storeOTP: "hashed",
          overrideDefaultEmailVerification: true,
          rateLimit: { window: 60, max: 3 },
          sendVerificationOTP: async ({ email, otp, type }) => {
            const result = await sendVerificationEmail({
              toEmail: email,
              code: otp,
              type: type === "forget-password" ? "password_reset" : "verification",
            });
            if (!result.success) {
              throw new Error(result.error || "Failed to send verification code");
            }
          },
        }),
      ],

      socialProviders: {
        google: {
          clientId: creds.googleClientId,
          clientSecret: creds.googleClientSecret,
          enabled: hasGoogle,
        },
        github: {
          clientId: creds.githubClientId,
          clientSecret: creds.githubClientSecret,
          enabled: hasGithub,
        },
      },

      session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days
        updateAge: 60 * 60 * 24, // 1 day
        cookieCache: {
          enabled: false,
        },
      },

      user: {
        additionalFields: {
          role: {
            type: "string",
            defaultValue: "user",
            required: true,
            input: false,
          },
          storageUsedBytes: {
            type: "number",
            defaultValue: 0,
          },
          storageLimitBytes: {
            type: "number",
            defaultValue: 157286400, // 150MB
          },
        },
      },

      rateLimit: {
        window: 60,
        max: 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Better Auth initialization notice: ${message}`);
    return {
      api: {
        getSession: async () => null,
      },
      handler: async () =>
        new Response(
          JSON.stringify({
            error: "Auth not configured",
            code: "AUTH_INIT_FAILED",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        ),
    } as any;
  }
}

// Cached instances by baseUrl
const authInstancesCache = new Map<string, any>();

export function getAuthInstance(customBaseUrl?: string) {
  const key = customBaseUrl || "default";
  const existing = authInstancesCache.get(key);
  if (existing) {
    return existing;
  }
  const created = createAuthInstance(customBaseUrl);
  if (isDbConnected()) {
    authInstancesCache.set(key, created);
  }
  return created;
}

export function getOriginFromHeaders(headers: Headers): string | undefined {
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!host) return undefined;
  const cleanHost = host.split(",")[0].trim();
  const protoHeader = headers.get("x-forwarded-proto");
  const forwardedProto = protoHeader?.split(",")[0].trim().toLowerCase();
  let hostname: string;
  try {
    hostname = new URL(`http://${cleanHost}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  const isLocalHost = isLocalHostname(hostname);
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : isLocalHost
      ? "http"
      : "https";
  return `${proto}://${cleanHost}`;
}

function isLocalHostname(hostname: string): boolean {
  const ipv4 = hostname.split(".").map(Number);
  const isPrivateIpv4 =
    ipv4.length === 4 &&
    ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (ipv4[0] === 10 ||
      ipv4[0] === 127 ||
      (ipv4[0] === 192 && ipv4[1] === 168) ||
      (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
      (ipv4[0] === 169 && ipv4[1] === 254));
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    isPrivateIpv4
  );
}

export function shouldUseSecureCookies(headers: Headers): boolean {
  const origin = getOriginFromHeaders(headers);
  if (!origin) return true;

  try {
    const url = new URL(origin);
    return url.protocol === "https:" || !isLocalHostname(url.hostname.toLowerCase());
  } catch {
    return true;
  }
}

export async function getSessionFromRequestHeaders(headers: Headers) {
  const origin = getOriginFromHeaders(headers);
  if (origin) {
    try {
      const originAuth = getAuthInstance(origin);
      if (typeof originAuth?.api?.getSession === "function") {
        const session = await originAuth.api.getSession({ headers });
        if (session?.user) return session;
      }
    } catch {}
  }
  try {
    if (typeof auth?.api?.getSession === "function") {
      return await auth.api.getSession({ headers });
    }
  } catch {}
  return null;
}

// Proxied singleton that delegates to the active auth instance
export const auth = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getAuthInstance();
    const val = instance[prop];
    return typeof val === "function" ? val.bind(instance) : val;
  },
});

export type Auth = typeof auth;
