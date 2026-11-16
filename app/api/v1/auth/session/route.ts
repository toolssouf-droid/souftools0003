/**
 * SoufTools Session Route Handler
 * Manages cryptographically verified Turso-backed sessions, Firebase ID token verification,
 * and atomic server session clearing.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_SIG_COOKIE_NAME,
  attachVerifiedSessionCookies,
  createVerifiedServerSession,
  resolveAuthUser,
  verifyAuthCookieToken,
} from "@/lib/auth/serverAuth";
import { getSessionFromRequestHeaders } from "@/lib/auth/betterAuth";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { UserRepository, UserSessionRepository } from "@/lib/db";

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedCerts && cachedCerts.expiresAt > Date.now()) {
    return cachedCerts.certs;
  }
  const res = await fetch(FIREBASE_CERTS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public keys (${res.status})`);
  }
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600_000;
  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ uid: string; email: string; name?: string; emailVerified: boolean } | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

    if (header?.alg !== "RS256" || !header?.kid) return null;

    const certs = await getFirebasePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuf = Buffer.from(sigB64, "base64url");
    if (!verifier.verify(certPem, sigBuf)) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== "number" || payload.iat > nowSec + 300) return null;

    const expectedProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
    if (expectedProject && payload.aud !== expectedProject) return null;

    const uid = String(payload.sub || payload.user_id || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    if (!uid || !email) return null;

    return {
      uid,
      email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }
    return NextResponse.json({ authenticated: true, user }, { status: 200 });
  } catch {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, uid, displayName, idToken } = body;

    let verifiedEmail: string | null = null;
    let verifiedUid: string | null = null;
    let verifiedName: string | undefined = typeof displayName === "string" ? displayName : undefined;
    let allowAdminRole = false;

    // 1. Verify via Firebase ID Token if provided
    if (typeof idToken === "string" && idToken.trim().length > 20) {
      const fbClaims = await verifyFirebaseIdToken(idToken.trim());
      if (!fbClaims) {
        return NextResponse.json(
          { status: "unauthorized", error: "Invalid or expired Firebase ID token" },
          { status: 401 }
        );
      }
      if (email && String(email).trim().toLowerCase() !== fbClaims.email) {
        return NextResponse.json(
          { status: "forbidden", error: "Email mismatch with verified token" },
          { status: 403 }
        );
      }
      verifiedEmail = fbClaims.email;
      verifiedUid = fbClaims.uid;
      verifiedName = verifiedName || fbClaims.name;
      allowAdminRole = fbClaims.emailVerified && isUserAdmin(fbClaims.email);
    } else {
      // 2. Otherwise require an already authenticated Better Auth or signed server session
      const betterSession = await getSessionFromRequestHeaders(req.headers).catch(() => null);
      if (betterSession?.user?.email) {
        verifiedEmail = String(betterSession.user.email).trim().toLowerCase();
        verifiedUid = String(betterSession.user.id);
        verifiedName = verifiedName || betterSession.user.name || undefined;
        allowAdminRole = isUserAdmin(verifiedEmail);
      } else {
        const existingUser = await resolveAuthUser(req);
        if (existingUser) {
          verifiedEmail = existingUser.email;
          verifiedUid = existingUser.id;
          verifiedName = verifiedName || existingUser.name || undefined;
          allowAdminRole = existingUser.role === "super_admin";
        }
      }
    }

    if (!verifiedEmail || !verifiedUid) {
      return NextResponse.json(
        { status: "unauthorized", error: "Authentication token required to establish session" },
        { status: 401 }
      );
    }

    const role: "user" | "super_admin" = allowAdminRole ? "super_admin" : "user";
    const dbUser = await UserRepository.upsertUser({
      id: verifiedUid,
      email: verifiedEmail,
      displayName: verifiedName || verifiedEmail.split("@")[0],
      role,
    });

    const effectiveRole: "user" | "admin" | "super_admin" =
      allowAdminRole || dbUser.role === "super_admin"
        ? "super_admin"
        : dbUser.role === "admin"
        ? "admin"
        : "user";

    const session = await createVerifiedServerSession({
      req,
      userId: dbUser.id,
      email: dbUser.email,
      role: effectiveRole,
    });

    const response = NextResponse.json({
      status: "synced",
      email: dbUser.email,
      uid: dbUser.id,
      role: effectiveRole,
    });

    attachVerifiedSessionCookies(response, {
      req,
      signedCookie: session.signedCookie,
      userId: dbUser.id,
      email: dbUser.email,
      role: effectiveRole,
    });

    return response;
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const signedToken = req.cookies.get(AUTH_SIG_COOKIE_NAME)?.value;
    const payload = verifyAuthCookieToken(signedToken);
    if (payload?.sid) {
      await UserSessionRepository.revokeByToken(payload.sid).catch(() => false);
    }

    const response = NextResponse.json({ status: "signed_out" }, { status: 200 });

    const cookiesToPurge = [
      AUTH_SIG_COOKIE_NAME,
      "souftools_session",
      "souftools_uid",
      "better-auth.session_token",
      "better-auth.session_data",
      "better-auth.csrf_token",
      "better-auth.state",
      "__Secure-better-auth.session_token",
    ];

    for (const cookieName of cookiesToPurge) {
      response.cookies.set(cookieName, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        sameSite: "lax",
        httpOnly: cookieName === AUTH_SIG_COOKIE_NAME,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ status: "signed_out" }, { status: 200 });
  }
}
