import { NextRequest, NextResponse } from "next/server";
import { RuntimeSessionManager } from "@/lib/runtime/sessionManager";
import { requireAuth } from "@/lib/auth/serverAuth";
import { RuntimeSessionRepository } from "@/lib/db";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, files } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    const existing = await RuntimeSessionRepository.getById(sessionId);
    if (
      existing &&
      existing.userId !== user.id &&
      user.role !== "super_admin" &&
      user.role !== "admin"
    ) {
      return NextResponse.json(
        { success: false, error: "غير مصرح لك بإيقاف هذه الجلسة" },
        { status: 403 }
      );
    }

    const result = await RuntimeSessionManager.stopSession(sessionId, files);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to stop sandbox" },
      { status: 500 }
    );
  }
}
