import { NextRequest, NextResponse } from "next/server";
import { runCodingAgent } from "@/lib/agent/coding/codingAgentEngine";
import { ProjectWorkspace } from "@/lib/agent/coding/types";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) {
      return NextResponse.json(
        { error: "يجب عليك تسجيل الدخول أولاً لتشغيل الوكيل البرمجي.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      workspace,
      modelId = "coder",
      isBuildUIMode = false,
    } = body as {
      prompt: string;
      workspace: ProjectWorkspace;
      modelId?: "spark" | "core" | "pro" | "coder" | "ultra";
      isBuildUIMode?: boolean;
    };

    if (!prompt || !workspace) {
      return NextResponse.json(
        { error: "الطلب ومساحة العمل مطلوبان" },
        { status: 400 }
      );
    }

    const result = await runCodingAgent({
      userPrompt: prompt,
      workspace,
      modelId,
      isBuildUIMode,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in /api/agent/coding:", error);
    return NextResponse.json(
      {
        error: error.message || "حدث خطأ أثناء تشغيل الوكيل البرمجي",
      },
      { status: 500 }
    );
  }
}
