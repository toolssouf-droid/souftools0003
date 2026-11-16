/**
 * SoufTools Automated Cleanup & Maintenance Cron Endpoint
 * Triggers background sweeps for orphaned storage files, calculates storage quotas,
 * purges stale session records safely, and returns database health statistics.
 */

import { NextRequest, NextResponse } from "next/server";
import { WorkerQueue } from "@/lib/queue/workerQueue";
import { AuditRepository, WorkerJobRepository } from "@/lib/db";
import { DatabaseMaintenanceService } from "@/lib/db/maintenance";

import crypto from "crypto";

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET is not configured on server" },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const customHeader = req.headers.get("x-cron-secret") || "";
  const candidate = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : customHeader.trim();

  const expectedBuf = Buffer.from(cronSecret, "utf8");
  const candidateBuf = Buffer.from(candidate, "utf8");
  const isAuthorized =
    candidateBuf.length === expectedBuf.length && crypto.timingSafeEqual(candidateBuf, expectedBuf);

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid or missing Cron Secret" },
      { status: 401 }
    );
  }

  // Recover any expired worker leases and enqueue background maintenance workers
  const recoveredLeases = await WorkerJobRepository.recoverStaleLeases();
  const job1 = await WorkerQueue.enqueueAsync("cleanup_expired_sessions", {});
  const job2 = await WorkerQueue.enqueueAsync("cleanup_orphaned_storage", {});

  // Fetch current database telemetry stats
  const dbHealth = await DatabaseMaintenanceService.getDatabaseHealthStats();

  await AuditRepository.logAction({
    adminUserId: "system_cron",
    action: "CRON_MAINTENANCE_TRIGGERED",
    resourceType: "system",
    details: { jobs: [job1, job2], recoveredLeases, dbHealth },
  });

  return NextResponse.json({
    success: true,
    message: "تم تشغيل مهام الصيانة والتنظيف التلقائية وتحديث قياسات قاعدة البيانات",
    jobs: [job1, job2],
    databaseHealth: dbHealth,
    timestamp: new Date().toISOString(),
  });
}
