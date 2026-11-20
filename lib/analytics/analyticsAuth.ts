import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function requireAnalyticsAdmin(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) {
    const status = authResult.errorResponse.status;
    return {
      response: NextResponse.json(
        {
          success: false,
          code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
        },
        { status }
      ),
    };
  }
  return { response: null, user: authResult.user };
}
