import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store" };

export function GET() {
  try {
    return NextResponse.json(
      {
        status: "ok",
        service: "SoufTools",
        timestamp: new Date().toISOString(),
      },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error("GET /api/health failed", error);
    return NextResponse.json(
      { status: "error", error: "Health check unavailable" },
      { status: 500, headers: responseHeaders }
    );
  }
}
