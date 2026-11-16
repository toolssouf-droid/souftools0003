/**
 * SoufAI Session Logs API
 * GET /api/v1/runtime/sessions/[id]/logs - Get logs for a specific sandbox session (owner/admin only)
 * POST /api/v1/runtime/sessions/[id]/logs - Add log item to Turso runtime_logs & global log (owner/admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { RuntimeSessionRepository, SettingsRepository } from "@/lib/db";
import { RuntimeLogItem } from "@/lib/runtime/types";
import { requireAuth } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const user = authResult.user;

  try {
    const { id } = await context.params;
    const existing = await RuntimeSessionRepository.getById(id);
    if (
      existing &&
      existing.userId !== user.id &&
      user.role !== "super_admin" &&
      user.role !== "admin"
    ) {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بعرض سجلات هذه الجلسة", logs: [] },
        { status: 403 }
      );
    }

    const dbLogs = await RuntimeSessionRepository.getLogs(id, 100);
    if (dbLogs.length > 0) {
      return NextResponse.json({
        success: true,
        logs: dbLogs.map((l) => ({
          id: l.id,
          sessionId: l.sessionId,
          timestamp: l.timestamp instanceof Date ? l.timestamp.getTime() : Number(l.timestamp || Date.now()),
          event: "command_exec",
          provider: existing?.provider || "native_sandbox",
          details: l.message,
          success: l.stream !== "stderr",
        })),
      });
    }

    const allLogs = (await SettingsRepository.getSetting<RuntimeLogItem[]>("runtime_logs")) || [];
    const sessionLogs = Array.isArray(allLogs) ? allLogs.filter((l) => l.sessionId === id) : [];

    return NextResponse.json({
      success: true,
      logs: sessionLogs,
    });
  } catch (err: any) {
    console.error("[Session Logs GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل استرجاع سجلات الجلسة", logs: [] },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const user = authResult.user;

  try {
    const { id } = await context.params;
    const existing = await RuntimeSessionRepository.getById(id);
    if (
      existing &&
      existing.userId !== user.id &&
      user.role !== "super_admin" &&
      user.role !== "admin"
    ) {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بتسجيل أحداث لهذه الجلسة" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const logItem: RuntimeLogItem = {
      id: body.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: id,
      userId: user.id,
      timestamp: body.timestamp || Date.now(),
      event: body.event || "log",
      provider: body.provider || existing?.provider || "native_sandbox",
      details: body.details || body.message || "",
      success: body.success !== false,
      error: body.error,
    };

    if (existing) {
      await RuntimeSessionRepository.addLog(
        id,
        logItem.success ? "stdout" : "stderr",
        logItem.details || logItem.error || `[${logItem.event}] ${logItem.provider}`
      );
    }

    let allLogs = (await SettingsRepository.getSetting<RuntimeLogItem[]>("runtime_logs")) || [];
    if (!Array.isArray(allLogs)) allLogs = [];

    allLogs.unshift(logItem);
    await SettingsRepository.setSetting("runtime_logs", allLogs.slice(0, 250), false);

    return NextResponse.json({
      success: true,
      message: "تم حفظ السجل بنجاح",
      log: logItem,
    });
  } catch (err: any) {
    console.error("[Session Logs POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل حفظ سجل الجلسة" },
      { status: 500 }
    );
  }
}
