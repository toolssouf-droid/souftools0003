import { NextRequest, NextResponse } from "next/server";
import {
  getAllActiveSandboxSessions,
  deleteSandboxSession,
} from "@/lib/runtime/runtimeDatabaseServices";
import { RuntimeSessionManager } from "@/lib/runtime/sessionManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const sessions = await getAllActiveSandboxSessions();
    return NextResponse.json({ sessions });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load sandbox sessions" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    await RuntimeSessionManager.stopSession(sessionId);
    await deleteSandboxSession(sessionId);

    return NextResponse.json({ success: true, message: "تم إيقاف وحذف الجلسة بنجاح" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete session" },
      { status: 500 }
    );
  }
}
