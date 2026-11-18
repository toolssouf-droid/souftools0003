/**
 * Better Auth API Handler Route for Next.js App Router
 * Handles /api/auth/[...all] requests (sign-in, sign-up, sign-out, session, oauth callbacks)
 */

import { getAuthInstance, getOriginFromHeaders } from "@/lib/auth/betterAuth";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@/lib/db";
import { checkRateLimit } from "@/lib/security/rateLimiter";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function guardSensitiveAuthPost(req: NextRequest): Promise<NextResponse | null> {
  const path = req.nextUrl.pathname;
  const action = path.endsWith("/sign-up/email")
    ? "sign-up"
    : path.endsWith("/sign-in/email")
    ? "sign-in"
    : path.endsWith("/request-password-reset")
    ? "password-reset"
    : null;
  if (!action) return null;

  const payload = await req.clone().json().catch(() => null);
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`auth:${action}:ip:${ip}`, action === "sign-in" ? 8 : 4, 4);
  const emailLimit = email
    ? checkRateLimit(`auth:${action}:email:${email}`, action === "sign-in" ? 8 : 3, 3)
    : null;

  if (!ipLimit.allowed || (emailLimit && !emailLimit.allowed)) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, emailLimit?.retryAfterSeconds || 0);
    return NextResponse.json(
      { error: "تم تجاوز عدد المحاولات. يرجى الانتظار ثم المحاولة مجدداً.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (action === "sign-up" && email) {
    const existingUser = await UserRepository.getByEmail(email);
    if (existingUser) {
      return NextResponse.json({
        status: true,
        message: "إذا كان هذا البريد مؤهلاً للتسجيل، فستصلك رسالة التحقق.",
      });
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const config = await loadServerAdminConfig();
    const authP = config?.authProviders || {};

    const googleId = process.env.GOOGLE_CLIENT_ID || authP.googleClientId;
    const googleSecret = process.env.GOOGLE_CLIENT_SECRET || authP.googleClientSecret;

    const githubId = process.env.GITHUB_CLIENT_ID || authP.githubClientId;
    const githubSecret = process.env.GITHUB_CLIENT_SECRET || authP.githubClientSecret;

    if (req.nextUrl.pathname.endsWith("/providers")) {
      return NextResponse.json({
        google: Boolean(googleId && googleSecret),
        github: Boolean(githubId && githubSecret),
        email: true,
      });
    }

    const origin = getOriginFromHeaders(req.headers);

    const currentAuth = getAuthInstance(origin);
    const handler = toNextJsHandler(currentAuth);
    if (handler?.GET) {
      return await handler.GET(req);
    }
  } catch (err: any) {
    console.warn("Auth GET handler error:", err);
    return NextResponse.json({ error: err?.message || "Auth error" }, { status: 500 });
  }

  return NextResponse.json({ status: "auth_idle" });
}

export async function POST(req: NextRequest) {
  try {
    const guardedResponse = await guardSensitiveAuthPost(req);
    if (guardedResponse) return guardedResponse;

    await loadServerAdminConfig();

    const origin = getOriginFromHeaders(req.headers);

    const currentAuth = getAuthInstance(origin);
    const handler = toNextJsHandler(currentAuth);
    if (handler?.POST) {
      return await handler.POST(req);
    }
  } catch (err: any) {
    console.warn("Auth POST handler error:", err);
    return NextResponse.json({ error: err?.message || "Auth error" }, { status: 500 });
  }

  return NextResponse.json({ status: "auth_idle" });
}
