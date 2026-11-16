import { NextRequest, NextResponse } from "next/server";
import { RuntimeSessionManager } from "@/lib/runtime/sessionManager";
import { requireAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/security/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const { user } = authResult;

    // Rate Limiting on Sandbox Creation (10 sandboxes per minute per user)
    const rateCheck = checkRateLimit(`sandbox_create_${user.id}`, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح به لإنشاء بيئات الساندبوكس، يرجى الانتظار قليلاً.", retryAfter: rateCheck.retryAfterSeconds },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { projectId, projectName, framework, files, port = 3000 } = body;

    if (!projectId || !files) {
      return NextResponse.json({ error: "Missing projectId or files" }, { status: 400 });
    }

    const response = await RuntimeSessionManager.getOrCreateSession({
      projectId,
      projectName: projectName || "SoufAI App",
      framework: framework || "react",
      files,
      userId: user.id,
      port,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to create sandbox" },
      { status: 500 }
    );
  }
}
