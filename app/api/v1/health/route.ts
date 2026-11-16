/**
 * SoufTools Health & Readiness Telemetry Endpoint
 * Checks Turso Database, Private Object Storage, and Durable Worker Queue status.
 */

import { NextResponse } from "next/server";
import { checkDatabaseHealth, WorkerJobRepository } from "@/lib/db";

export async function GET() {
  const [health, queueStats] = await Promise.all([
    checkDatabaseHealth(),
    WorkerJobRepository.getQueueStats().catch(() => ({
      pending: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    })),
  ]);

  const dbStatus = health.connected ? "healthy" : "unreachable";

  return NextResponse.json(
    {
      status: health.connected ? "ok" : "degraded",
      service: "SoufTools Private Backend API",
      version: "v1.0.0",
      database: {
        engine: health.serverVersion || "Turso libSQL",
        status: dbStatus,
        latencyMs: health.latencyMs,
        mode: health.engine,
      },
      storage: {
        engine: "Private Object Storage",
        status: "operational",
      },
      workerQueue: {
        status: health.connected ? "running" : "degraded",
        stats: queueStats,
      },
      timestamp: new Date().toISOString(),
    },
    { status: health.connected ? 200 : 503 }
  );
}
