/**
 * /api/v1/users/me/sessions
 * 
 * GET: Lists active login sessions for the authenticated user.
 * DELETE: Revokes a specific session by sessionId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { toIsoDateString } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;

    const db = await getReadyDb();
    const sessions = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, user.id))
      .orderBy(desc(userSessions.createdAt));

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        expiresAt: toIsoDateString(s.expiresAt),
        createdAt: toIsoDateString(s.createdAt),
      })),
    });
  } catch (error: any) {
    console.error("[Sessions GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "SESSIONS_FETCH_ERROR", message: "فشل استرجاع الجلسات النشطة" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, code: "SESSION_ID_REQUIRED", message: "معرف الجلسة (sessionId) مطلوب" },
        { status: 400 }
      );
    }

    const db = await getReadyDb();

    // Invalidate session ensuring strict IDOR protection
    await db
      .delete(userSessions)
      .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, user.id)));

    return NextResponse.json({
      success: true,
      message: "تم إنهاء الجلسة بنجاح",
    });
  } catch (error: any) {
    console.error("[Session Invalidation Error]:", error);
    return NextResponse.json(
      { success: false, code: "REVOKE_SESSION_FAILED", message: "فشل إنهاء الجلسة" },
      { status: 500 }
    );
  }
}
