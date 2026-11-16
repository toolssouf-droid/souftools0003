/**
 * SoufTools Memory Engine - Data Export & Portability API
 */

import { NextRequest, NextResponse } from "next/server";
import { SoufToolsMemoryEngine } from "@/lib/memory/memoryEngine";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "json") as "json" | "markdown";

    const exported = await SoufToolsMemoryEngine.exportUserMemories(user.id, format);

    return new Response(exported.data, {
      headers: {
        "Content-Type": exported.mimeType,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل تصدير بيانات الذاكرة", error: err.message },
      { status: 500 }
    );
  }
}
