/**
 * SoufTools Admin Threat Intelligence & Hacker Telemetry API Route
 * Provides real-time incident streams, attacker IPs, client devices, offensive tools,
 * and immediate IP blocking/unblocking controls.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import {
  getIncidents,
  getBannedIPs,
  getThreatSummary,
  banIP,
  unbanIP,
  simulateTestThreat,
} from "@/lib/security/threatEngine";
import { AuditRepository } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const vector = searchParams.get("vector") || undefined;
    const tool = searchParams.get("tool") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const limit = parseInt(searchParams.get("limit") || "60", 10);

    const metrics = getThreatSummary();
    const incidents = getIncidents({ vector, tool, severity, limit });
    const bannedIPs = getBannedIPs();

    return NextResponse.json({
      success: true,
      metrics,
      incidents,
      bannedIPs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load threat intelligence" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "ban_ip") {
      const ip = (body.ip || "").trim();
      const reason = body.reason || "Manual ban by administrator";
      if (!ip) {
        return NextResponse.json({ success: false, error: "IP address is required" }, { status: 400 });
      }

      const record = banIP(
        ip,
        reason,
        `Admin (${user.email})`,
        body.attackVector || "MANUAL_BLOCK",
        body.toolDetected || "Admin Console"
      );

      // Record administrative audit trail
      await AuditRepository.logAction({
        adminUserId: user.id,
        action: "SECURITY_IP_BANNED",
        resourceType: "IP_PERIMETER",
        resourceId: ip,
        details: { reason, attackVector: body.attackVector, tool: body.toolDetected },
      });

      return NextResponse.json({
        success: true,
        message: `تم حظر عنوان IP بنجاح: ${ip}`,
        bannedRecord: record,
      });
    }

    if (action === "unban_ip") {
      const ip = (body.ip || "").trim();
      if (!ip) {
        return NextResponse.json({ success: false, error: "IP address is required" }, { status: 400 });
      }

      const unbanned = unbanIP(ip);

      if (unbanned) {
        await AuditRepository.logAction({
          adminUserId: user.id,
          action: "SECURITY_IP_UNBANNED",
          resourceType: "IP_PERIMETER",
          resourceId: ip,
          details: { unbannedBy: user.email },
        });
      }
      return NextResponse.json({
        success: true,
        message: unbanned ? `تم رفع الحظر عن عنوان IP: ${ip}` : `لم يتم العثور على العنوان في قائمة الحظر`,
        unbanned,
      });
    }

    if (action === "simulate_attack") {
      const incident = simulateTestThreat({
        vector: body.vector,
        toolName: body.toolName,
        ip: body.ip,
        target: body.target,
        payload: body.payload,
      });

      return NextResponse.json({
        success: true,
        message: "تم تنفيذ محاكاة الهجوم واعتراضه بنجاح ورصد أداة المخترق",
        incident,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute threat management action" },
      { status: 500 }
    );
  }
}
