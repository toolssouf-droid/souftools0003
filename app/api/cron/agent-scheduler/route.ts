import { NextRequest, NextResponse } from "next/server";
import { ServerTaskRunner } from "@/lib/scheduler/serverTaskRunner";

import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const cronSecret = (process.env.CRON_SECRET || "").trim();
    if (!cronSecret) {
      return NextResponse.json(
        { success: false, message: "CRON_SECRET is not configured on server" },
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
        { success: false, message: "Unauthorized Cron request: Valid Cron Secret token required" },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    // Execute all due tasks from Turso Database
    const executedResults = await ServerTaskRunner.processDueTasks();

    // Ensure WhatsApp session persistence is active if credentials exist in Turso
    import("@/lib/whatsapp/baileysService").then(({ initWhatsAppAutoRestore }) => {
      initWhatsAppAutoRestore().catch(() => {});
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      timestamp: now,
      cronJob: "/api/cron/agent-scheduler",
      executedTasksCount: executedResults.length,
      tasks: executedResults,
      message: `تم تشغيل محرك الجدولة ومعالجة ${executedResults.length} مهمة مستحقة من قاعدة البيانات بنجاح 🚀`,
    });
  } catch (error: any) {
    console.error("[Cron Scheduler Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Cron execution failed" },
      { status: 500 }
    );
  }
}
