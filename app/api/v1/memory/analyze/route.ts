/**
 * SoufTools Memory Engine - Server-Side Memory Extraction & Analysis API
 */

import { NextRequest, NextResponse } from "next/server";
import { SoufToolsMemoryEngine } from "@/lib/memory/memoryEngine";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, projectName, autoSave = false } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ code: "BAD_REQUEST", message: "نص الرسالة مطلوب" }, { status: 400 });
    }

    const candidate = await SoufToolsMemoryEngine.extractCandidateMemory(prompt, projectName);

    let savedMemory = null;
    let action = null;

    if (candidate && autoSave) {
      const result = await SoufToolsMemoryEngine.storeOrDeduplicateMemory(user.id, {
        type: candidate.type,
        content: candidate.content,
        projectId: candidate.projectId,
        projectName: candidate.projectName,
        userName: candidate.userName,
        importance: candidate.importance,
        confidence: candidate.confidence,
        source: "auto",
      });
      savedMemory = result.memory;
      action = result.action;
    }

    return NextResponse.json({
      success: true,
      hasCandidate: !!candidate,
      candidate,
      savedMemory,
      action,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل تحليل واكتشاف الذاكرة", error: err.message },
      { status: 500 }
    );
  }
}
