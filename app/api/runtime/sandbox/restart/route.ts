import { NextRequest, NextResponse } from "next/server";
import { SmartRuntimeRouter } from "@/lib/runtime/smartRouter";
import { getSandboxSession, saveSandboxSession } from "@/lib/runtime/runtimeDatabaseServices";
import { requireAuth } from "@/lib/auth/serverAuth";
import { RuntimeSessionRepository } from "@/lib/db";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, files = {} } = body;

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
        { success: false, error: "غير مصرح لك بإعادة تشغيل هذه الجلسة" },
        { status: 403 }
      );
    }

    const session = await getSandboxSession(sessionId);
    const providerId = session?.provider || existing?.provider || "native_sandbox";

    const res = await SmartRuntimeRouter.restartSandbox(sessionId, providerId as any, files);

    if (session && res.success) {
      session.status = "active";
      session.lastActivity = Date.now();
      await saveSandboxSession(session);
    }

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to restart sandbox" },
      { status: 500 }
    );
  }
}
