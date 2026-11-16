import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";

export async function GET() {
  try {
    const [health, config] = await Promise.all([
      checkDatabaseHealth().catch(() => ({ connected: false, engine: "turso_libsql", latencyMs: 0 })),
      loadServerAdminConfig().catch(() => null),
    ]);
    const providersCount = config?.modelProviders ? Object.keys(config.modelProviders).length : 0;

    return NextResponse.json({
      status: "online",
      timestamp: new Date().toISOString(),
      databaseStatus: health.connected ? "connected" : "disconnected",
      databaseEngine: health.engine || "turso_libsql",
      databaseLatencyMs: health.latencyMs || 0,
      activeModelTiers: config?.activeModelTiers || ["spark", "core", "pro", "ultra"],
      configuredProvidersCount: providersCount,
      environment: process.env.NODE_ENV || "production",
    });
  } catch {
    return NextResponse.json({
      status: "online",
      timestamp: new Date().toISOString(),
      databaseStatus: "error",
      databaseEngine: "turso_libsql",
      activeModelTiers: ["spark", "core", "pro", "ultra"],
    });
  }
}
