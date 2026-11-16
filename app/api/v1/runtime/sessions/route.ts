/**
 * SoufAI Runtime Sessions API
 * GET /api/v1/runtime/sessions - List authenticated user's sandbox sessions from Turso
 * POST /api/v1/runtime/sessions - Save or update sandbox session in Turso runtime_sessions
 */
import { NextRequest, NextResponse } from "next/server";
import { RuntimeSessionRepository, SettingsRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const user = authResult.user;

  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");
    const targetUserId =
      requestedUserId && (user.role === "super_admin" || user.role === "admin")
        ? requestedUserId
        : user.id;

    const rows = await RuntimeSessionRepository.listByUser(targetUserId, 100);
    const sessions = await Promise.all(
      rows.map(async (r) => {
        const extra = (await SettingsRepository.getSetting<Record<string, any>>(`runtime_session_meta_${r.id}`)) || {};
        return {
          ...extra,
          id: r.id,
          sessionId: extra.sessionId || r.id,
          userId: r.userId,
          provider: r.provider,
          sandboxId: r.sandboxId,
          status: r.status,
          memoryMb: r.memoryMb,
          cpuCores: r.cpuCores,
          createdAt: r.startedAt ? new Date(r.startedAt).getTime() : Date.now(),
          lastActivity: extra.lastActivity || (r.startedAt ? new Date(r.startedAt).getTime() : Date.now()),
        };
      })
    );

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (err: any) {
    console.error("[Runtime Sessions GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل استرجاع جلسات التشغيل", sessions: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const user = authResult.user;

  try {
    const body = await request.json();
    const incomingSession = body.session || body;
    const sessionId = incomingSession?.id || incomingSession?.sessionId;

    if (!incomingSession || !sessionId) {
      return NextResponse.json(
        { success: false, error: "بيانات الجلسة غير صالحة" },
        { status: 400 }
      );
    }

    const existing = await RuntimeSessionRepository.getById(sessionId);
    if (existing && existing.userId !== user.id && user.role !== "super_admin" && user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بتعديل هذه الجلسة" },
        { status: 403 }
      );
    }

    const expiresAt = incomingSession.expiresAt
      ? new Date(incomingSession.expiresAt)
      : new Date(Date.now() + 2 * 60 * 60 * 1000);

    await RuntimeSessionRepository.upsertSession({
      id: sessionId,
      userId: user.id,
      provider: incomingSession.provider || "native_sandbox",
      sandboxId: incomingSession.sandboxId || incomingSession.projectId || sessionId,
      status: incomingSession.status || "running",
      memoryMb: Number(incomingSession.memoryMb || incomingSession.limits?.ramMb || 512),
      cpuCores: Number(incomingSession.cpuCores || incomingSession.limits?.cpuCores || 1),
      startedAt: incomingSession.createdAt ? new Date(incomingSession.createdAt) : new Date(),
      expiresAt,
    });

    const normalizedMeta = {
      ...incomingSession,
      id: sessionId,
      sessionId,
      userId: user.id,
      createdAt: incomingSession.createdAt || Date.now(),
      lastActivity: Date.now(),
    };
    await SettingsRepository.setSetting(`runtime_session_meta_${sessionId}`, normalizedMeta, false);

    return NextResponse.json({
      success: true,
      message: "تم حفظ جلسة التشغيل بنجاح",
      session: normalizedMeta,
    });
  } catch (err: any) {
    console.error("[Runtime Sessions POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل حفظ جلسة التشغيل" },
      { status: 500 }
    );
  }
}
