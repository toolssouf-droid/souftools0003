import { NextRequest, NextResponse } from "next/server";
import { SandboxManager } from "@/lib/sandbox/sandboxManager";
import { FRAMEWORK_PRESETS } from "@/lib/agent/coding/frameworkPresets";
import type { SupportedFramework } from "@/lib/agent/coding/types";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Strict ID format validation to prevent directory traversal / command injection
    if (!id || !/^[a-zA-Z0-9_-]{3,64}$/.test(id)) {
      return new NextResponse("Invalid Sandbox ID format", { status: 400 });
    }

    const sbx = SandboxManager.getSandbox(id);
    const baseSandboxesDir =
      process.env.SANDBOX_BASE_DIR ||
      (process.platform === "win32"
        ? path.join(os.tmpdir(), "souftools-sandboxes")
        : "/tmp/souftools-sandboxes");
    const sandboxDir = path.join(baseSandboxesDir, id, "workspace");

    // 2. Strict jail verification: ensure resolved path is strictly inside baseSandboxesDir
    if (!sandboxDir.startsWith(baseSandboxesDir) || sandboxDir.includes("..")) {
      return new NextResponse("Forbidden: Sandbox path traversal detected", { status: 403 });
    }

    const securityHeaders = {
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:; frame-ancestors 'self';",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    };

    // Check if index.html exists and verify it is not a symlink escaping workspace
    const indexPath = path.join(sandboxDir, "index.html");
    if (fs.existsSync(indexPath)) {
      try {
        const realTarget = fs.realpathSync(indexPath);
        if (!realTarget.startsWith(sandboxDir)) {
          return new NextResponse("Security Violation: Symlink escape detected in preview index", { status: 403 });
        }
      } catch {
        return new NextResponse("Forbidden", { status: 403 });
      }

      const html = fs.readFileSync(indexPath, "utf8");
      return new NextResponse(html, {
        headers: {
          ...securityHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // Auto-compile live bundle from workspace files if index.html was not written yet
    if (fs.existsSync(sandboxDir)) {
      const scannedFiles: Record<string, string> = {};
      const readDirRecursive = (dir: string, prefix = "") => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.name === "node_modules" || ent.name === ".git" || ent.name === ".tmp") continue;
          const fullPath = path.join(dir, ent.name);
          const relPath = prefix ? `${prefix}/${ent.name}` : ent.name;
          if (ent.isDirectory()) {
            readDirRecursive(fullPath, relPath);
          } else {
            scannedFiles[relPath] = fs.readFileSync(fullPath, "utf-8");
          }
        }
      };

      try {
        readDirRecursive(sandboxDir);
      } catch {}

      if (Object.keys(scannedFiles).length > 0) {
        const framework = (sbx?.framework || "react") as SupportedFramework;
        const preset = FRAMEWORK_PRESETS[framework] || FRAMEWORK_PRESETS.react;
        const bundle = preset.buildRunner(scannedFiles);
        if (bundle?.previewHtml) {
          try {
            fs.writeFileSync(indexPath, bundle.previewHtml, "utf-8");
          } catch {}
          return new NextResponse(bundle.previewHtml, {
            headers: {
              ...securityHeaders,
              "Content-Type": "text/html; charset=utf-8",
            },
          });
        }
      }
    }

    // Check files in workspace
    let fileList: string[] = [];
    if (fs.existsSync(sandboxDir)) {
      fileList = fs.readdirSync(sandboxDir);
    }

    const status = sbx?.status || "active";
    const projectName = sbx?.projectName || "SoufTools Native Sandbox Project";
    const limits = sbx?.limits || {
      ramMb: 500,
      cpuCores: 1,
      diskMb: 2048,
      timeoutMinutes: 10,
      networkMode: "restricted",
    };

    // Render Preview Harness
    const harnessHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - معاينة SoufTools Sandbox</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --border: #1e293b;
      --accent: #10b981;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 32px; max-width: 600px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #fff; }
    p { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
    .specs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .spec-item { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: center; }
    .spec-val { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px; }
    .spec-lbl { font-size: 11px; color: var(--muted); }
    .status-box { background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; font-family: monospace; font-size: 13px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> بيئة SoufTools Native المعزولة</div>
    <h1>${projectName}</h1>
    <p>تعمل البيئة داخل حاوية Linux معزولة بتقنيات Namespaces وCgroups دون أي وسيط خارجي.</p>

    <div class="specs">
      <div class="spec-item">
        <div class="spec-val">${limits.ramMb} MB</div>
        <div class="spec-lbl">الذاكرة المخصصة</div>
      </div>
      <div class="spec-item">
        <div class="spec-val">${limits.cpuCores} Core</div>
        <div class="spec-lbl">أنوية المعالج</div>
      </div>
      <div class="spec-item">
        <div class="spec-val">${limits.diskMb} MB</div>
        <div class="spec-lbl">سعة القرص</div>
      </div>
    </div>

    <div class="status-box">
      <span>الحالة: ${status === "running" || status === "active" ? "يعمل وجاهز للمعاينة" : status}</span>
      <span>الشبكة: ${limits.networkMode === "restricted" ? "محمية (Restricted)" : "نشطة"}</span>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(harnessHtml, {
      headers: {
        ...securityHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Sandbox Preview Error: ${err?.message}`, { status: 500 });
  }
}
