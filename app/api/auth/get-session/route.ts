import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequestHeaders } from "@/lib/auth/betterAuth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequestHeaders(req.headers);
    return NextResponse.json(session || null);
  } catch {
    return NextResponse.json(null);
  }
}
