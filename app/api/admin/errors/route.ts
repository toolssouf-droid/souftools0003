import { NextRequest, NextResponse } from "next/server";
import { serverErrorManager } from "@/lib/errors/errorManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await serverErrorManager.ensureLoaded?.();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as any;
    const severity = searchParams.get("severity") as any;
    const category = searchParams.get("category") as any;
    const search = searchParams.get("search") || undefined;

    const errors = serverErrorManager.getErrors({
      status: status || undefined,
      severity: severity || undefined,
      category: category || undefined,
      search,
    });

    const stats = serverErrorManager.getStats();

    return NextResponse.json({
      success: true,
      errors,
      stats,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch error diagnostics" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await serverErrorManager.ensureLoaded?.();
    const body = await req.json().catch(() => ({}));
    const { title, message, category, severity, endpoint, stackTrace, metadata } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Title and message are required" },
        { status: 400 }
      );
    }

    const record = serverErrorManager.recordError({
      title,
      message,
      category,
      severity,
      endpoint,
      stackTrace,
      metadata,
    });
    await serverErrorManager.flushPendingWrites();

    return NextResponse.json({
      success: true,
      record,
      stats: serverErrorManager.getStats(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record error" },
      { status: 500 }
    );
  }
}
