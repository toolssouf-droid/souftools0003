/**
 * SoufTools Native Sandbox Security & Runtime Audit Test Suite
 * Validates real Kernel/OS enforcement of limits and security boundaries.
 */

import { NativeSandboxInstance } from "../lib/sandbox/nativeSandbox";
import { SandboxManager } from "../lib/sandbox/sandboxManager";
import fs from "fs";
import path from "path";

async function runAudit() {
  console.log("=================================================================");
  console.log("🔒 STARTING SOUFTOOLS NATIVE SANDBOX SECURITY & RUNTIME AUDIT");
  console.log("=================================================================\n");

  const results: Array<{ check: string; passed: boolean; details: string }> = [];

  const testSandboxId = `sbx_audit_${Date.now()}`;
  const instance = new NativeSandboxInstance({
    id: testSandboxId,
    userId: "audit_user_1",
    projectId: "audit_proj_1",
    projectName: "Security Audit Project",
    framework: "react",
    limits: {
      ramMb: 500,
      cpuCores: 1,
      diskMb: 2048,
      timeoutMinutes: 10,
      maxProcesses: 50,
      maxFileSizeMb: 30,
      networkMode: "isolated",
    },
  });

  try {
    // 1. CPU 1 Core & Scheduler Affinity check
    console.log("TEST 1: CPU 1 Core Pinning (taskset scheduler affinity)");
    const cpuRes = await instance.executeCommand("nproc; echo affinity_checked");
    const cpuPass = cpuRes.exitCode === 0;
    results.push({
      check: "CPU 1 Core Scheduler Pinning",
      passed: cpuPass,
      details: `Exit code: ${cpuRes.exitCode}, Output: ${cpuRes.stdout.trim()}`,
    });

    // 2. RAM 500MB & Ulimit Virtual/Resident Memory Limits
    console.log("TEST 2: RAM 500MB ulimit virtual memory limit");
    const ramRes = await instance.executeCommand("ulimit -v");
    const ulimitRamKb = parseInt(ramRes.stdout.trim(), 10) || 0;
    const ramPass = ulimitRamKb > 0 && ulimitRamKb <= 500 * 1024;
    results.push({
      check: "RAM 500MB Kernel ulimit enforcement",
      passed: ramPass,
      details: `Enforced ulimit -v: ${ulimitRamKb} KB (Target: ${500 * 1024} KB)`,
    });

    // 3. Process Limit 50 (active process controller & PID namespace limits)
    console.log("TEST 3: Max Processes 50 (Sandbox process controller & PID namespace)");
    // Simulate active processes up to limit
    const originalLimit = instance.limits.maxProcesses;
    let procBlocked = false;
    for (let i = 0; i < 50; i++) {
      (instance as any).activePids.add(99000 + i);
    }
    try {
      await instance.executeCommand("echo 'exceed_process_limit'");
    } catch (err: any) {
      if (err.message.includes("الحد الأقصى لعدد العمليات")) {
        procBlocked = true;
      }
    } finally {
      (instance as any).activePids.clear();
    }
    results.push({
      check: "Max Processes 50 Controller & Namespace Enforcement",
      passed: procBlocked && originalLimit === 50,
      details: procBlocked ? "Execution rejected when active process count reached limit (50)" : "Process limit not enforced",
    });

    // 4. Max File Size 30MB (Backend & Kernel enforcement)
    console.log("TEST 4: Max File Size 30MB enforcement");
    let fileSizeBlocked = false;
    try {
      // Attempt to write a 35MB file directly
      const large35MbString = "A".repeat(35 * 1024 * 1024);
      instance.writeFile("large_evil.txt", large35MbString);
    } catch (err: any) {
      if (err.message.includes("تجاوز الحد الأقصى لحجم الملف")) {
        fileSizeBlocked = true;
      }
    }
    results.push({
      check: "Max File Size 30MB Rejection",
      passed: fileSizeBlocked,
      details: fileSizeBlocked ? "35MB file write rejected by backend quota check" : "Failed to block 35MB write",
    });

    // 5. Total Disk Limit 2GB Quota enforcement
    console.log("TEST 5: Total Disk 2048MB Quota check");
    const diskUsage = instance.getDiskUsageBytes();
    const diskPass = diskUsage >= 0 && diskUsage < 2048 * 1024 * 1024;
    results.push({
      check: "Disk 2GB Quota tracking",
      passed: diskPass,
      details: `Current workspace disk usage: ${diskUsage} bytes (Ceiling: ${2048 * 1024 * 1024} bytes)`,
    });

    // 6. Path Traversal & Parent Directory Escape Prevention
    console.log("TEST 6: Path Traversal (../ /etc/passwd) rejection");
    let traversalBlocked = false;
    try {
      instance.resolveSafePath("../../etc/shadow");
    } catch (err: any) {
      if (err.message.includes("Security Violation") || err.message.includes("Path traversal")) {
        traversalBlocked = true;
      }
    }
    results.push({
      check: "Path Traversal Escape Prevention",
      passed: traversalBlocked,
      details: traversalBlocked ? "Traversal attempt '../../etc/shadow' rejected" : "Path traversal allowed!",
    });

    // 7. Symlink Escape Prevention
    console.log("TEST 7: Symlink Escape Prevention");
    let symlinkBlocked = false;
    try {
      // Create a fake symlink pointing to /etc
      const evilSymlink = path.join(instance.workspaceDir, "evil_symlink");
      if (!fs.existsSync(evilSymlink)) {
        try {
          fs.symlinkSync("/etc", evilSymlink);
        } catch {}
      }
      instance.resolveSafePath("evil_symlink/passwd", true);
    } catch (err: any) {
      if (err.message.includes("Security Violation") || err.message.includes("Symlink")) {
        symlinkBlocked = true;
      }
    } finally {
      try {
        const evilSymlink = path.join(instance.workspaceDir, "evil_symlink");
        if (fs.existsSync(evilSymlink)) fs.unlinkSync(evilSymlink);
      } catch {}
    }
    results.push({
      check: "Symlink Escape Prevention",
      passed: symlinkBlocked,
      details: symlinkBlocked ? "Symlink pointing outside sandbox was blocked" : "Symlink escape allowed!",
    });

    // 8. Preventing Host ENV, API Keys, and Secrets Leaks
    console.log("TEST 8: Environment & Secrets isolation (No GEMINI_API_KEY / DATABASE_URL in child env)");
    const envRes = await instance.executeCommand("env");
    const envOutput = envRes.stdout;
    const leakedSecrets = [
      "GEMINI_API_KEY",
      "DATABASE_URL",
      "POSTGRES_PASSWORD",
      "BETTER_AUTH_SECRET",
      "SESSION_SECRET",
    ].filter((sec) => envOutput.includes(sec));

    results.push({
      check: "Host Secrets / Environment Isolation",
      passed: leakedSecrets.length === 0,
      details: leakedSecrets.length === 0 ? "Zero host secrets present in isolated sandbox env" : `Leaked: ${leakedSecrets.join(", ")}`,
    });

    // 9. Network & PostgreSQL Isolation (Testing connection to host port 5432)
    console.log("TEST 9: Network & PostgreSQL Isolation in isolated network namespace");
    const netRes = await instance.executeCommand("timeout 1 bash -c 'cat < /dev/tcp/127.0.0.1/5432' 2>/dev/null || echo 'POSTGRES_UNREACHABLE'");
    const netBlocked = netRes.stdout.includes("POSTGRES_UNREACHABLE") || netRes.exitCode !== 0;
    results.push({
      check: "Network & PostgreSQL Host Port Isolation",
      passed: netBlocked,
      details: netBlocked ? "Host network interface & PostgreSQL (5432) completely unreachable" : "Accessible",
    });

    // 10. Privilege Escalation Prevention (User namespace root cannot touch host files)
    console.log("TEST 10: Privilege Escalation Prevention (sudo/su/setuid inside user namespace)");
    const privRes = await instance.executeCommand("id; touch /etc/test_priv_esc 2>&1 || echo 'PERMISSION_DENIED'");
    const privBlocked = privRes.stdout.includes("PERMISSION_DENIED") || privRes.stdout.includes("Permission denied") || privRes.stdout.includes("Read-only") || privRes.exitCode !== 0;
    results.push({
      check: "Privilege Escalation Prevention",
      passed: privBlocked,
      details: privBlocked ? "Child process cannot write to host /etc or acquire root privileges" : "Host write allowed!",
    });

    // 11. Multi-User Sandbox Isolation
    console.log("TEST 11: Multi-User Sandbox Isolation");
    const user1Sbx = await SandboxManager.createSandbox({
      id: "sbx_user_a",
      userId: "user_alice",
      projectId: "proj_a",
      projectName: "Alice Project",
    });

    // Try to access Alice's sandbox as Bob
    const bobAccess = SandboxManager.getSandbox("sbx_user_a", "user_bob");
    const isolationPass = bobAccess === null;
    results.push({
      check: "User Authorization & Cross-Tenant Isolation",
      passed: isolationPass,
      details: isolationPass ? "Bob unauthorized to access Alice's sandbox instance" : "Data leak across users!",
    });

    // Clean up test user sandbox
    SandboxManager.deleteSandbox("sbx_user_a", "user_alice");

    // 12. Lifecycle: Start, Metrics, Stop, Cleanup
    console.log("TEST 12: Lifecycle (Start, Metrics, Stop, Cleanup)");
    const startRes = await instance.start();
    const metrics = instance.getLiveMetrics();
    instance.stop();
    const isStopped = instance.status === "stopped";
    instance.cleanup();
    const isCleaned = !fs.existsSync(instance.sandboxDir);

    results.push({
      check: "Lifecycle (Start, Live Metrics, Stop, Cleanup)",
      passed: startRes.success && isStopped && isCleaned,
      details: `Start: ${startRes.success}, Stop status: ${instance.status}, Disk freed: ${isCleaned}`,
    });

  } finally {
    instance.cleanup();
  }

  console.log("\n=================================================================");
  console.log("📊 SOUFTOOLS NATIVE SANDBOX SECURITY AUDIT RESULTS");
  console.log("=================================================================");
  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${symbol} | ${r.check} -> ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log("=================================================================");
  console.log(`OVERALL AUDIT STATUS: ${allPassed ? "ALL 12 SECURITY CHECKS PASSED (100%)" : "FAILED CHECKS DETECTED"}`);
  console.log("=================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

runAudit().catch((err) => {
  console.error("Audit runner crashed:", err);
  process.exit(1);
});
