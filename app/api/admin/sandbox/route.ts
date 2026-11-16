import { NextRequest, NextResponse } from "next/server";
import { SandboxManager } from "@/lib/sandbox/sandboxManager";
import { getSandboxProvider } from "@/lib/runtime/providers";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await SandboxManager.ensureLimitsLoaded();
    const stats = SandboxManager.getGlobalStats();
    const sandboxes = SandboxManager.getAllSandboxesInfo();
    const limits = await SandboxManager.getGlobalLimits();
    const enabled = SandboxManager.isEnabled();

    return NextResponse.json({
      success: true,
      enabled,
      stats,
      sandboxes,
      limits,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch sandbox runtime status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await SandboxManager.ensureLimitsLoaded();
    const body = await req.json().catch(() => ({}));
    const { action, sandboxId, limits, files } = body;

    switch (action) {
      case "toggle_enabled": {
        const isCurrentlyEnabled = SandboxManager.isEnabled();
        const newEnabled = body.enabled !== undefined ? Boolean(body.enabled) : !isCurrentlyEnabled;
        const result = await SandboxManager.setEnabled(newEnabled);
        return NextResponse.json({
          success: true,
          enabled: result,
          message: result
            ? "تم تشغيل بيئة الساندبوكس بنجاح (Active)"
            : "تم تعطيل بيئة الساندبوكس وإيقاف كافة العمليات لتوفير الموارد (Standby)",
        });
      }

      case "execute_command": {
        if (!SandboxManager.isEnabled()) {
          return NextResponse.json(
            {
              success: false,
              disabled: true,
              error: "بيئة تشغيل الساندبوكس في وضع الإيقاف المؤقت (Standby) من قبل الإدارة لتوفير الموارد.",
            },
            { status: 503 }
          );
        }
        const { command: cmdToRun, projectId: projId, framework: fw, projectName: pName, userId: uId } = body;
        if (!cmdToRun) {
          return NextResponse.json({ success: false, error: "Command required" }, { status: 400 });
        }
        const sbx = await SandboxManager.getOrCreateForProject({
          userId: uId || "user_active",
          projectId: projId || sandboxId || "project_default",
          projectName: pName || "SoufAI Project",
          framework: fw || "react",
          files: files || {},
          port: 3000,
        });

        const execResult = await sbx.executeCommand(cmdToRun);
        return NextResponse.json({
          success: execResult.exitCode === 0,
          exitCode: execResult.exitCode,
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          sandboxId: sbx.id,
          previewUrl: sbx.previewUrl,
        });
      }

      case "create_or_get_sandbox": {
        if (!SandboxManager.isEnabled()) {
          return NextResponse.json(
            {
              success: false,
              disabled: true,
              error: "بيئة تشغيل الساندبوكس في وضع الإيقاف المؤقت (Standby) من قبل الإدارة لتوفير الموارد.",
            },
            { status: 503 }
          );
        }
        const { projectId: projId, framework: fw, projectName: pName, userId: uId } = body;
        const sbx = await SandboxManager.getOrCreateForProject({
          userId: uId || "user_active",
          projectId: projId || sandboxId || "project_default",
          projectName: pName || "SoufAI Project",
          framework: fw || "react",
          files: files || {},
          port: 3000,
        });

        return NextResponse.json({
          success: true,
          sandboxId: sbx.id,
          status: sbx.status,
          previewUrl: sbx.previewUrl,
          metrics: sbx.getLiveMetrics(),
        });
      }

      case "check_status": {
        const sid = sandboxId || body.projectId;
        const sbx = sid ? SandboxManager.getSandbox(sid) : null;
        return NextResponse.json({
          success: true,
          active: sbx ? sbx.status === "running" || sbx.status === "active" : false,
          status: sbx ? sbx.status : "stopped",
          previewUrl: sbx?.previewUrl,
          metrics: sbx?.getLiveMetrics(),
        });
      }

      case "update_limits": {
        if (!limits) {
          return NextResponse.json({ success: false, error: "Limits data required" }, { status: 400 });
        }
        const updated = await SandboxManager.updateGlobalLimits(limits);
        return NextResponse.json({
          success: true,
          message: "تم حفظ وتطبيق حدود الساندبوكس بنجاح",
          limits: updated,
        });
      }

      case "stop_sandbox": {
        if (!sandboxId) {
          return NextResponse.json({ success: false, error: "Sandbox ID required" }, { status: 400 });
        }
        const ok = SandboxManager.stopSandbox(sandboxId);
        return NextResponse.json({
          success: ok,
          message: ok ? "تم إيقاف بيئة الساندبوكس وتحرير الموارد بنجاح" : "تعذر إيقاف الساندبوكس",
        });
      }

      case "restart_sandbox": {
        if (!sandboxId) {
          return NextResponse.json({ success: false, error: "Sandbox ID required" }, { status: 400 });
        }
        const restarted = await SandboxManager.restartSandbox(sandboxId, files);
        return NextResponse.json({
          success: !!restarted,
          message: restarted ? "تمت إعادة تشغيل الساندبوكس بنجاح" : "الساندبوكس غير موجود",
          sandbox: restarted ? { id: restarted.id, status: restarted.status } : null,
        });
      }

      case "delete_sandbox": {
        if (!sandboxId) {
          return NextResponse.json({ success: false, error: "Sandbox ID required" }, { status: 400 });
        }
        const ok = SandboxManager.deleteSandbox(sandboxId);
        return NextResponse.json({
          success: ok,
          message: ok ? "تم حذف وتفريغ ملفات الساندبوكس بنجاح" : "الساندبوكس غير موجود",
        });
      }

      case "get_logs": {
        if (!sandboxId) {
          return NextResponse.json({ success: false, error: "Sandbox ID required" }, { status: 400 });
        }
        const sbx = SandboxManager.getSandbox(sandboxId);
        if (!sbx) {
          return NextResponse.json({ success: false, error: "Sandbox not found" }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          logs: sbx.getLogs(200),
          metrics: sbx.getLiveMetrics(),
        });
      }

      case "cleanup_stale": {
        const res = SandboxManager.autoCleanupStaleSandboxes();
        return NextResponse.json({
          success: true,
          cleanedCount: res.cleaned,
          message: `تم تنظيف ${res.cleaned} بيئة خاملة أو منتهية`,
        });
      }

      case "test_environment": {
        const provider = getSandboxProvider("native_sandbox");
        const testRes = await provider.testKey();
        return NextResponse.json({
          success: testRes.valid,
          result: testRes,
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Sandbox API error" },
      { status: 500 }
    );
  }
}
