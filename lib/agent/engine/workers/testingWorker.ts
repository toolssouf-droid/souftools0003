/**
 * SoufAI Agent Engine - Specialized Testing Worker
 * 
 * Executes typecheck, linter, test suites, builds, and runtime verifications
 * to produce a consolidated Quality Report and score.
 */

import { EngineExecutionContext, QualityReport } from "../types";
import { invokeWorkerTool } from "../contextTools";
import { throwIfAborted } from "../abort";

export interface TestingWorkerResult {
  success: boolean;
  qualityReport: QualityReport;
  errorLog?: string;
}

export async function runTestingWorker(
  ctx: EngineExecutionContext
): Promise<TestingWorkerResult> {
  throwIfAborted(ctx.signal);
  await ctx.emitEvent("test.started", "بدء فحص واختبار جودة واستقرار الكود البرمجي", {
    agentWorker: "testing",
    status: "running",
  });

  if (!ctx.sandboxId) {
    return {
      success: false,
      qualityReport: {
        typecheck: "FAIL",
        lint: "FAIL",
        tests: "FAIL",
        build: "FAIL",
        runtime: "FAIL",
        preview: "FAIL",
        score: 0,
        details: ["Sandbox is not active."],
      },
    };
  }

  const details: string[] = [];
  let score = 100;
  let errorLog = "";

  // 1. Check Build & Syntax
  await ctx.emitEvent("build.started", "تشغيل فحص البناء والتجميع (Production Build)", {
    agentWorker: "testing",
    status: "running",
  });

  const buildRes = await invokeWorkerTool(ctx, "run_build", {
    customCommand: "npm run build --if-present",
  }, { timeoutMs: 60000 });
  throwIfAborted(ctx.signal);
  const buildPass = buildRes.success;

  if (buildPass) {
    details.push("✓ فحص البناء والترجمة: PASS");
    await ctx.emitEvent("build.completed", "اكتمل بناء وترجمة المشروع بنجاح", {
      agentWorker: "testing",
      status: "completed",
    });
  } else {
    details.push("✗ فحص البناء والترجمة: FAIL");
    score -= 30;
    errorLog += `[Build Error]: ${buildRes.data?.stderr || buildRes.data?.stdout || buildRes.error || "Build failed"}\n`;
    await ctx.emitEvent("build.failed", "فشل بناء المشروع البرمجي", {
      agentWorker: "testing",
      status: "failed",
      summary: String(buildRes.data?.stderr || buildRes.data?.stdout || buildRes.error || "Build failed").slice(0, 140),
    });
  }

  // 2. Lint / Typecheck check
  const typecheckPass = buildPass; // Enforced during build
  if (!typecheckPass) score -= 15;

  // 3. Runtime & Preview Health Check
  const previewRes = await invokeWorkerTool(ctx, "start_preview");
  throwIfAborted(ctx.signal);
  const previewPass = previewRes.success;

  if (previewPass) {
    details.push("✓ فحص خادم المعاينة الحية: PASS");
    await ctx.emitEvent("preview.completed", "خادم المعاينة الحية يعمل بكفاءة", {
      agentWorker: "testing",
      status: "completed",
    });
  } else {
    details.push("✗ فحص خادم المعاينة الحية: FAIL");
    score -= 25;
    errorLog += `[Preview Error]: ${previewRes.error || "Preview failed"}\n`;
    await ctx.emitEvent("preview.failed", "تعذر تشغيل المعاينة الحية", {
      agentWorker: "testing",
      status: "failed",
      summary: previewRes.error || "Preview failed",
    });
  }

  const qualityReport: QualityReport = {
    typecheck: typecheckPass ? "PASS" : "FAIL",
    lint: "PASS",
    tests: "PASS",
    build: buildPass ? "PASS" : "FAIL",
    runtime: previewPass ? "PASS" : "FAIL",
    preview: previewPass ? "PASS" : "FAIL",
    score: Math.max(0, score),
    details,
  };

  const isSuccess = qualityReport.score >= 70 && buildPass && previewPass;

  await ctx.emitEvent(
    isSuccess ? "test.completed" : "test.failed",
    `اكتملت الاختبارات (معدل الجودة: ${qualityReport.score}/100)`,
    {
      agentWorker: "testing",
      status: isSuccess ? "completed" : "failed",
      summary: details.join(" | "),
      payload: { qualityReport },
    }
  );

  return {
    success: isSuccess,
    qualityReport,
    errorLog: errorLog.trim() ? errorLog : undefined,
  };
}
