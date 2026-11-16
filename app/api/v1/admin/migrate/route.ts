/**
 * SoufTools Migration Admin API Route
 * Provides triggers and status inspection for Turso storage verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { DataMigrator } from "@/lib/migration/dataMigrator";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const status = DataMigrator.getStatus();
  return NextResponse.json({ success: true, status });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  // Execute asynchronously
  DataMigrator.executeMigration(user.id);

  return NextResponse.json({
    success: true,
    message: "تم بدء عملية التحقق والتهيئة لقاعدة بيانات Turso السحابية بنجاح",
  });
}
