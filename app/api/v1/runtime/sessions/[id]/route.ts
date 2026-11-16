/**
 * SoufAI Single Sandbox Session API
 * GET /api/v1/runtime/sessions/[id] - Get session details (owner/admin only)
 * DELETE /api/v1/runtime/sessions/[id] - Remove session from Turso (owner/admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { RuntimeSessionRepository, SettingsRepository } from "@/lib/db";
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
    const row = await RuntimeSessionRepository.getById(id);

    if (!row) {
      return NextResponse.json(
        { success: false, error: "الجلسة غير موجودة" },
        { status: 404 }
      );
    }

    if (row.userId !== user.id && user.role !== "super_admin" && user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بالوصول إلى هذه الجلسة" },
        { status: 403 }
      );
    }

    const extra = (await SettingsRepository.getSetting<Record<string, any>>(`runtime_session_meta_${row.id}`)) || {};
    const logs = await RuntimeSessionRepository.getLogs(row.id, 100);

    return NextResponse.json({
      success: true,
      session: {
        ...extra,
        id: row.id,
        sessionId: extra.sessionId || row.id,
        userId: row.userId,
        provider: row.provider,
        sandboxId: row.sandboxId,
        status: row.status,
        memoryMb: row.memoryMb,
        cpuCores: row.cpuCores,
        createdAt: row.startedAt ? new Date(row.startedAt).getTime() : Date.now(),
        logs,
      },
    });
  } catch (err: any) {
    console.error("[Runtime Session GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل استرجاع الجلسة" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const user = authResult.user;

  try {
    const { id } = await context.params;
    const existing = await RuntimeSessionRepository.getById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "الجلسة غير موجودة" },
        { status: 404 }
      );
    }

    if (existing.userId !== user.id && user.role !== "super_admin" && user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بحذف هذه الجلسة" },
        { status: 403 }
      );
    }

    await RuntimeSessionRepository.deleteSession(id);
    await SettingsRepository.setSetting(`runtime_session_meta_${id}`, null, false).catch(() => null);

    return NextResponse.json({
      success: true,
      message: "تم حذف جلسة التشغيل بنجاح",
    });
  } catch (err: any) {
    console.error("[Runtime Session DELETE] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل حذف الجلسة" },
      { status: 500 }
    );
  }
}
