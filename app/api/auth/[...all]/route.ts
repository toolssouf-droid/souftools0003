/**
 * Better Auth API Handler Route for Next.js App Router
 * Handles /api/auth/[...all] requests (sign-in, sign-up, sign-out, session, oauth callbacks)
 */

import { getAuthInstance, getOriginFromHeaders } from "@/lib/auth/betterAuth";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

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
