/**
 * SoufAI Sandbox Session Status Updater
 * PATCH /api/v1/runtime/sessions/[id]/status - Update status of a sandbox session in Turso (owner/admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { RuntimeSessionRepository, SettingsRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const user = authResult.user;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { status, error } = body;

    const existing = await RuntimeSessionRepository.getById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "الجلسة غير موجودة" },
        { status: 404 }
      );
    }

    if (existing.userId !== user.id && user.role !== "super_admin" && user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بتعديل هذه الجلسة" },
        { status: 403 }
      );
    }

    const nextStatus = status || existing.status;
    const updatedRow = await RuntimeSessionRepository.updateStatus(
      id,
      nextStatus,
      nextStatus === "stopped" ? new Date() : null
    );

    const existingMeta = (await SettingsRepository.getSetting<Record<string, any>>(`runtime_session_meta_${id}`)) || {};
    const mergedMeta = {
      ...existingMeta,
      id,
      sessionId: existingMeta.sessionId || id,
      status: nextStatus,
      ...(error !== undefined ? { error } : {}),
      lastActivity: Date.now(),
    };
    await SettingsRepository.setSetting(`runtime_session_meta_${id}`, mergedMeta, false);

    return NextResponse.json({
      success: true,
      message: "تم تحديث حالة الجلسة بنجاح",
      session: {
        ...mergedMeta,
        provider: updatedRow?.provider || existing.provider,
        userId: existing.userId,
      },
    });
  } catch (err: any) {
    console.error("[Runtime Status PATCH] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل تحديث حالة الجلسة" },
      { status: 500 }
    );
  }
}
