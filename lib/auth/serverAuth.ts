/**
 * SoufTools Server Authentication & RBAC Layer
 * Authenticates requests using Better Auth server sessions, HMAC-signed HttpOnly
 * Turso-backed sessions, or verified master admin credentials.
 * Never trusts unverified x-user-email / x-user-id / unsigned client cookies.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestHeaders, shouldUseSecureCookies } from "@/lib/auth/betterAuth";
import { UserRepository, UserSessionRepository, AuditRepository } from "@/lib/db";
import { ADMIN_EMAILS, isUserAdmin, verifyAdminMasterPassword } from "@/lib/auth/adminRoles";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  role: "user" | "admin" | "super_admin";
  storageUsedBytes: number;
  storageLimitBytes: number;
}

export const AUTH_SIG_COOKIE_NAME = "souftools_auth_sig";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSessionSigningSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.ENCRYPTION_SECRET ||
    process.env.MASTER_ENCRYPTION_KEY;
  if (!secret || secret.trim().length < 32) {
    throw new Error("Authentication signing secret is missing or too short");
  }
  return secret.trim();
}

export interface SignedSessionPayload {
  sid: string;
  uid: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  exp: number;
}

export function signAuthCookieToken(payload: SignedSessionPayload): string {
  const secret = getSessionSigningSecret();
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyAuthCookieToken(rawToken?: string | null): SignedSessionPayload | null {
  if (!rawToken || typeof rawToken !== "string") return null;
  const parts = rawToken.trim().split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  try {
    const secret = getSessionSigningSecret();
    const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig, "utf8");
    const expBuf = Buffer.from(expectedSig, "utf8");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || !parsed.sid || !parsed.uid || !parsed.email) {
      return null;
    }
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) {
      return null;
    }
    return parsed as SignedSessionPayload;
  } catch {
    return null;
  }
}

export async function createVerifiedServerSession(params: {
  req?: NextRequest;
  userId: string;
  email: string;
  role: "user" | "admin" | "super_admin";
}): Promise<{ sessionId: string; signedCookie: string; expiresAt: Date }> {
  const sessionId = `sess_${crypto.randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await UserSessionRepository.createSession({
    id: sessionId,
    token: sessionId,
    userId: params.userId,
    expiresAt,
    ipAddress: params.req?.headers.get("x-forwarded-for") || null,
    userAgent: params.req?.headers.get("user-agent") || null,
  });

  const signedCookie = signAuthCookieToken({
    sid: sessionId,
    uid: params.userId,
    email: params.email.toLowerCase().trim(),
    role: params.role,
    exp: expiresAt.getTime(),
  });

  return { sessionId, signedCookie, expiresAt };
}

export function attachVerifiedSessionCookies(
  response: NextResponse,
  params: {
    req: NextRequest;
    signedCookie: string;
    userId: string;
    email: string;
    role: "user" | "admin" | "super_admin";
    maxAgeSeconds?: number;
  }
) {
  const maxAge = params.maxAgeSeconds ?? SESSION_TTL_SECONDS;
  const isAdmin = params.role === "super_admin" || params.role === "admin";

  response.cookies.set(AUTH_SIG_COOKIE_NAME, params.signedCookie, {
    path: "/",
    maxAge,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && shouldUseSecureCookies(params.req.headers),
  });

  const displayPayload = JSON.stringify({
    email: params.email.toLowerCase().trim(),
    userId: params.userId,
    uid: params.userId,
    isAdmin,
    role: params.role,
    time: Date.now(),
  });

  response.cookies.set("souftools_session", displayPayload, {
    path: "/",
    maxAge,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && shouldUseSecureCookies(params.req.headers),
  });
}

function normalizeRole(role?: string | null, email?: string | null): "user" | "admin" | "super_admin" {
  if (role === "super_admin" && isUserAdmin(email)) return "super_admin";
  if (role === "admin") return "admin";
  return "user";
}

export async function resolveAuthUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    // 1. Better Auth cryptographically verified session (matching request origin)
    const session = await getSessionFromRequestHeaders(req.headers).catch(() => null);

    if (session?.user) {
      const user = session.user as any;
      const cleanEmail = (user.email || "").toLowerCase().trim();
      const role = normalizeRole(user.role, cleanEmail);

      return {
        id: user.id,
        email: cleanEmail,
        name: user.name || null,
        role,
        storageUsedBytes: user.storageUsedBytes || 0,
        storageLimitBytes: user.storageLimitBytes || 150 * 1024 * 1024,
      };
    }

    // 2. HMAC-signed HttpOnly session cookie validated against Turso userSessions table
    const signedToken = req.cookies.get(AUTH_SIG_COOKIE_NAME)?.value;
    if (signedToken) {
      const payload = verifyAuthCookieToken(signedToken);
      if (payload) {
        const dbSession = await UserSessionRepository.findValidSessionByToken(payload.sid);
        if (dbSession && dbSession.userId === payload.uid) {
          const dbUser = await UserRepository.getById(dbSession.userId);
          if (dbUser && !dbUser.isBanned) {
            const role = normalizeRole(dbUser.role, dbUser.email);
            return {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name || null,
              role,
              storageUsedBytes: dbUser.storageUsedBytes || 0,
              storageLimitBytes: dbUser.storageLimitBytes || 150 * 1024 * 1024,
            };
          }
        }
      }
    }

    // 3. Explicit Admin Master Password via 'x-admin-key' or Bearer header (machine/API access)
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
    const adminKeyHeader = req.headers.get("x-admin-key")?.trim() || null;
    const masterSecretCandidate =
      adminKeyHeader && verifyAdminMasterPassword(adminKeyHeader)
        ? adminKeyHeader
        : bearerToken && verifyAdminMasterPassword(bearerToken)
        ? bearerToken
        : null;

    if (masterSecretCandidate) {
      const primaryAdminEmail = (process.env.ADMIN_EMAIL || ADMIN_EMAILS[0] || "admin@souftools.internal")
        .trim()
        .toLowerCase();
      const adminId = `admin_${primaryAdminEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const dbAdmin =
        (await UserRepository.getByEmail(primaryAdminEmail)) ||
        (await UserRepository.upsertUser({
          id: adminId,
          email: primaryAdminEmail,
          displayName: primaryAdminEmail.split("@")[0],
          role: "super_admin",
        }));

      return {
        id: dbAdmin.id,
        email: dbAdmin.email,
        name: dbAdmin.name || null,
        role: "super_admin",
        storageUsedBytes: dbAdmin.storageUsedBytes || 0,
        storageLimitBytes: dbAdmin.storageLimitBytes || 150 * 1024 * 1024,
      };
    }

    // Unverified headers (x-user-email / x-user-id) and unsigned souftools_session cookies are NEVER trusted.
    return null;
  } catch (err) {
    console.error("resolveAuthUser error:", err);
    return null;
  }
}

export async function requireAuth(
  req: NextRequest
): Promise<{ user: AuthenticatedUser } | { errorResponse: Response }> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return {
      errorResponse: new Response(
        JSON.stringify({
          code: "UNAUTHORIZED",
          message: "يجب تسجيل الدخول للوصول إلى هذه الخدمة",
          retryable: false,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { user };
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ user: AuthenticatedUser } | { errorResponse: Response }> {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult;

  const { user } = authResult;
  if (user.role !== "admin" && user.role !== "super_admin") {
    await AuditRepository.logAction({
      adminUserId: user.id,
      action: "UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT",
      resourceType: "admin_route",
      details: { path: req.nextUrl.pathname, email: user.email },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return {
      errorResponse: new Response(
        JSON.stringify({
          code: "FORBIDDEN",
          message: "ليس لديك صلاحية المسؤول لتنفيذ هذا الإجراء",
          retryable: false,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { user };
}

export const getCurrentUser = resolveAuthUser;

