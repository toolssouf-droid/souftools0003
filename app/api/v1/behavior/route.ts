/**
 * SoufTools Behavior Engine Sync Route
 * Synchronizes compressed local-first user behavior profiles with PostgreSQL.
 */

import { NextRequest, NextResponse } from "next/server";
import { BehaviorRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const profile = await BehaviorRepository.getProfile(user.id);
    return NextResponse.json({ success: true, profile: profile || null });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل استرجاع ملف السلوك", error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const profile = body.profile;

    if (!profile) {
      return NextResponse.json({ code: "BAD_REQUEST", message: "بيانات ملف السلوك مطلوبة" }, { status: 400 });
    }

    await BehaviorRepository.saveProfile(user.id, profile);
    return NextResponse.json({ success: true, message: "تمت مزامنة ملف السلوك بنجاح" });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل حفظ ملف السلوك", error: err.message },
      { status: 500 }
    );
  }
}
