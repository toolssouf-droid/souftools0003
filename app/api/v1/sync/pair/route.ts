/**
 * SoufTools Cross-Browser / Multi-Device Instant Pairing API
 * Persists short-lived 6-digit pairing codes in Turso and mints verified sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  attachVerifiedSessionCookies,
  createVerifiedServerSession,
  resolveAuthUser,
} from "@/lib/auth/serverAuth";
import { ConversationRepository, SettingsRepository } from "@/lib/db";
import { recordSyncEvent, registerUserAlias } from "@/lib/sync/syncEngine";

interface PairingSession {
  code: string;
  userId: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  expiresAt: number;
}

const PAIRING_SETTING_PREFIX = "sync_pair_code_";

/**
 * GET /api/v1/sync/pair
 * Generates or retrieves an active 6-digit sync pairing code for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "جلسة المستخدم غير صالحة" }, { status: 401 });
  }

  const now = Date.now();
  const userCodeKey = `sync_pair_user_${user.id}`;
  const existingForUser = await SettingsRepository.getSetting<PairingSession>(userCodeKey);

  if (existingForUser && existingForUser.expiresAt > now) {
    return NextResponse.json({
      success: true,
      code: existingForUser.code,
      userId: user.id,
      email: user.email,
      expiresInSeconds: Math.floor((existingForUser.expiresAt - now) / 1000),
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + 15 * 60 * 1000;

  const session: PairingSession = {
    code,
    userId: user.id,
    email: user.email,
    role: user.role,
    expiresAt,
  };

  await SettingsRepository.setSetting(`${PAIRING_SETTING_PREFIX}${code}`, session, false);
  await SettingsRepository.setSetting(userCodeKey, session, false);

  return NextResponse.json({
    success: true,
    code,
    userId: user.id,
    email: user.email,
    expiresInSeconds: Math.floor((expiresAt - now) / 1000),
  });
}

/**
 * POST /api/v1/sync/pair
 * Pairs the current browser with the target user session using the 6-digit sync code.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, currentGuestId } = body;

    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json({ success: false, message: "رمز المزامنة يجب أن يتكون من 6 أرقام" }, { status: 400 });
    }

    const cleanCode = code.trim();
    const session = await SettingsRepository.getSetting<PairingSession>(`${PAIRING_SETTING_PREFIX}${cleanCode}`);

    if (!session || session.expiresAt < Date.now()) {
      return NextResponse.json({ success: false, message: "رمز المزامنة غير صالح أو انتهت صلاحيته" }, { status: 404 });
    }

    const targetUserId = session.userId;
    const targetEmail = session.email;
    const targetRole = session.role || "user";

    if (currentGuestId && currentGuestId !== targetUserId) {
      registerUserAlias(targetUserId, currentGuestId);
      try {
        const guestConvs = await ConversationRepository.listByUser(currentGuestId);
        if (Array.isArray(guestConvs) && guestConvs.length > 0) {
          for (const conv of guestConvs) {
            await ConversationRepository.saveConversation(targetUserId, conv);
          }
        }
      } catch (migrateErr) {
        console.warn("[SyncPair] Guest migration warning:", migrateErr);
      }
    }

    const targetSessions = await ConversationRepository.listByUser(targetUserId);

    // One-time consumption: expire the pairing code immediately after use
    await SettingsRepository.setSetting(`${PAIRING_SETTING_PREFIX}${cleanCode}`, { ...session, expiresAt: 0 }, false);

    recordSyncEvent({
      userId: targetUserId,
      entityType: "device",
      entityId: `paired_${Date.now()}`,
      operation: "updated",
      payload: {
        action: "device_linked",
        targetUserId,
        targetEmail,
      },
    }).catch(() => null);

    const verified = await createVerifiedServerSession({
      req,
      userId: targetUserId,
      email: targetEmail,
      role: targetRole,
    });

    const response = NextResponse.json({
      success: true,
      message: "تم ربط المتصفح ومزامنة المحادثات بنجاح!",
      userId: targetUserId,
      email: targetEmail,
      sessions: targetSessions || [],
    });

    attachVerifiedSessionCookies(response, {
      req,
      signedCookie: verified.signedCookie,
      userId: targetUserId,
      email: targetEmail,
      role: targetRole,
    });

    response.cookies.set("souftools_uid", targetUserId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || "فشل إتمام ربط المزامنة" }, { status: 500 });
  }
}
