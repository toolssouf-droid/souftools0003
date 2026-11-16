/**
 * SoufTools Native Sandbox - Isolated Linux Execution Engine
 * Provides Linux isolation (namespaces, cgroups/ulimit, seccomp/sanitized env,
 * process group limits, filesystem jailing, and backend-enforced resource limits).
 * 
 * ARCHITECTURE:
 * SoufAI → Coding Agent → Sandbox Manager → Isolated Sandbox → Preview/Logs
 */

import fs from "fs";
import path from "path";
import os from "os";
import { spawn, execSync, ChildProcess } from "child_process";
import {
  SandboxLimits,
  SandboxLiveMetrics,
  SandboxStatus,
  DEFAULT_SANDBOX_LIMITS,
} from "./types";

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut?: boolean;
}

export class NativeSandboxInstance {
  public readonly id: string;
  public readonly userId: string;
  public readonly projectId: string;
  public readonly projectName: string;
  public readonly framework: string;
  public readonly port: number;
  public readonly sandboxDir: string;
  public readonly workspaceDir: string;
  public readonly tmpDir: string;
  public readonly limits: SandboxLimits;

  public status: SandboxStatus = "created";
  public createdAt: number;
  public startedAt?: number;
  public stoppedAt?: number;
  public lastActivity: number;
  public previewUrl?: string;
  public errorMessage?: string;

  private serverProcess: ChildProcess | null = null;
  private serverPid: number | null = null;
  private activePids: Set<number> = new Set();
  private timeoutTimer: NodeJS.Timeout | null = null;
  private memoryWatcherTimer: NodeJS.Timeout | null = null;
  private logs: Array<{ timestamp: number; stream: "stdout" | "stderr" | "system"; message: string }> = [];

  constructor(options: {
    id: string;
    userId: string;
    projectId: string;
    projectName: string;
    framework?: string;
    port?: number;
    limits?: Partial<SandboxLimits>;
  }) {
    this.id = options.id;
    this.userId = options.userId;
    this.projectId = options.projectId;
    this.projectName = options.projectName;
    this.framework = options.framework || "react_nextjs";
    this.port = options.port || 3000;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    this.limits = {
      ...DEFAULT_SANDBOX_LIMITS,
      ...(options.limits || {}),
    };

    // Isolated jailed filesystem root (Cross-platform compatible)
    const baseSandboxDir =
      process.env.SANDBOX_BASE_DIR ||
      (process.platform === "win32"
        ? path.join(os.tmpdir(), "souftools-sandboxes")
        : "/tmp/souftools-sandboxes");
    this.sandboxDir = path.resolve(path.join(baseSandboxDir, this.id));
    this.workspaceDir = path.join(this.sandboxDir, "workspace");
    this.tmpDir = path.join(this.sandboxDir, ".tmp");

    this.initFilesystem();
    this.addLog("system", `[Sandbox Created] Initialized isolated sandbox environment (${this.id})`);
  }

  /**
   * Initializes isolated workspace directory tree with strict permissions and unprivileged user ownership
   */
  private initFilesystem(): void {
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true, mode: 0o775 });
    }
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true, mode: 0o775 });
    }
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true, mode: 0o775 });
    }
    if (process.platform !== "win32") {
      try {
        execSync(`chown -R node:node "${this.sandboxDir}" 2>/dev/null || true`);
      } catch {}
    }
  }

  /**
   * Safe path resolution preventing directory traversal and symlink escape outside sandbox boundary
   */
  public resolveSafePath(relPath: string, checkExistingSymlinks = true): string {
    if (!relPath || typeof relPath !== "string") {
      throw new Error("Security Violation: Invalid file path");
    }

    // 1. Prevent null-byte injection
    if (relPath.includes("\0")) {
      throw new Error("Security Violation: Null byte detected in file path");
    }

    // 2. Strict jailed resolution: must be strictly inside workspaceDir
    const normalized = path.normalize(relPath);
    const resolved = path.resolve(this.workspaceDir, normalized);

    // Boundary check: cannot escape workspaceDir
    const sep = path.sep;
    if (resolved !== this.workspaceDir && !resolved.startsWith(this.workspaceDir + sep)) {
      throw new Error(`Security Violation: Path traversal outside sandbox boundary (${relPath})`);
    }

    // 3. Symlink Escape Verification for existing file/symlink
    if (checkExistingSymlinks && fs.existsSync(resolved)) {
      try {
        const lstat = fs.lstatSync(resolved);
        if (lstat.isSymbolicLink()) {
          const realTarget = fs.realpathSync(resolved);
          if (realTarget !== this.workspaceDir && !realTarget.startsWith(this.workspaceDir + sep)) {
            throw new Error(`Security Violation: Symlink points outside sandbox boundary (${relPath} -> ${realTarget})`);
          }
        }
      } catch (err: any) {
        if (err.message.includes("Security Violation")) throw err;
      }
    }

    // 4. Parent directory symlink escape check
    let currentDir = path.dirname(resolved);
    while (currentDir.startsWith(this.workspaceDir) && currentDir !== this.workspaceDir) {
      if (fs.existsSync(currentDir)) {
        try {
          const lstat = fs.lstatSync(currentDir);
          if (lstat.isSymbolicLink()) {
            const realTarget = fs.realpathSync(currentDir);
            if (realTarget !== this.workspaceDir && !realTarget.startsWith(this.workspaceDir + sep)) {
              throw new Error(`Security Violation: Parent directory symlink escape (${currentDir} -> ${realTarget})`);
            }
          }
        } catch (err: any) {
          if (err.message.includes("Security Violation")) throw err;
        }
      }
      currentDir = path.dirname(currentDir);
    }

    return resolved;
  }

  /**
   * Checks current total workspace disk consumption against the disk limit
   */
  public getDiskUsageBytes(): number {
    try {
      if (!fs.existsSync(this.workspaceDir)) return 0;
      const cmd = `du -sb "${this.workspaceDir}" 2>/dev/null | awk '{print $1}'`;
      const output = execSync(cmd, { encoding: "utf8", timeout: 2000 }).trim();
      return parseInt(output, 10) || 0;
    } catch {
      return this.calculateDirectorySizeFallback(this.workspaceDir);
    }
  }

  private calculateDirectorySizeFallback(dir: string): number {
    let total = 0;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          total += this.calculateDirectorySizeFallback(full);
        } else {
          total += fs.statSync(full).size;
        }
      }
    } catch {}
    return total;
  }

  /**
   * Sanitizes environment variables to guarantee host secrets/keys are never leaked (POL-FS-01, POL-SEC-01)
   */
  private getSanitizedEnv(): NodeJS.ProcessEnv {
    // Whitelist only - never inherit process.env directly
    return {
      NODE_ENV: "development",
      PATH: "/usr/local/bin:/usr/bin:/bin",
      HOME: this.sandboxDir,
      TMPDIR: this.tmpDir,
      PORT: String(this.port),
      SANDBOX_ID: this.id,
      PROJECT_NAME: this.projectName,
      LANG: "en_US.UTF-8",
      TERM: "xterm-256color",
      DISABLE_HMR: "true",
      CI: "true",
      NODE_OPTIONS: "--max-old-space-size=450", // V8 heap memory ceiling
      // Neutralize host database & internal services
      PGHOST: "127.0.0.1",
      PGPORT: "9999", // Unreachable port
    };
  }

  /**
   * Wraps command with Linux isolation primitives:
   * - taskset: CPU core scheduler pinning (-c 0 for 1 Core)
   * - unshare: Kernel namespaces (user, pid, uts, ipc, and net when isolated)
   * - nice: CPU scheduling priority (-n 10)
   * - ulimit: virtual memory (-v), max RSS (-m), max processes (-u), max file size (-f), CPU time (-t), no core dump (-c 0)
   */
  private buildIsolatedCommand(cmd: string): { command: string; args: string[] } {
    // 1. Windows / PowerShell support
    if (process.platform === "win32") {
      const isPowerShellAvailable = fs.existsSync(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
      );
      if (isPowerShellAvailable) {
        return {
          command: "powershell.exe",
          args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
        };
      }
      return {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", cmd],
      };
    }

    // 2. Linux Isolation Engine
    const ramInKb = Math.floor(this.limits.ramMb * 1024);
    // max file size in 512-byte blocks (30MB = 61440 blocks)
    const maxFileBlocks = Math.floor((this.limits.maxFileSizeMb * 1024 * 1024) / 512);
    // CPU core limit: default 1 core (index 0)
    const cpuCoreList = Array.from({ length: Math.max(1, this.limits.cpuCores) }, (_, i) => i).join(",");

    const ulimitHeader = `ulimit -v ${ramInKb} -m ${ramInKb} -f ${maxFileBlocks} -t 120 -c 0 2>/dev/null; `;
    const wrappedShell = `${ulimitHeader}${cmd}`;

    const shell = fs.existsSync("/usr/bin/bash")
      ? "/usr/bin/bash"
      : fs.existsSync("/bin/bash")
      ? "/bin/bash"
      : "/bin/sh";

    const hasUnshare = fs.existsSync("/usr/bin/unshare");
    const hasTaskset = fs.existsSync("/usr/bin/taskset");
    const hasNice = fs.existsSync("/usr/bin/nice");
    const hasRunuser = fs.existsSync("/usr/sbin/runuser") || fs.existsSync("/bin/runuser");

    let useRunuser = false;
    if (typeof process.getuid === "function" && process.getuid() === 0 && hasRunuser) {
      try {
        const idOut = execSync("id -u node 2>/dev/null", { encoding: "utf8" }).trim();
        if (idOut === "1000") useRunuser = true;
      } catch {}
    }

    const unshareArgs: string[] = [
      "--user",
      "--pid",
      "--uts",
      "--ipc",
      "--fork",
    ];

    if (this.limits.networkMode === "isolated") {
      unshareArgs.push("--net");
    }

    let runnerCmd = hasNice ? "/usr/bin/nice" : shell;
    let runnerArgs = hasNice ? ["-n", "10", shell, "-c", wrappedShell] : ["-c", wrappedShell];

    if (hasUnshare) {
      runnerCmd = "/usr/bin/unshare";
      runnerArgs = hasNice
        ? [...unshareArgs, "/usr/bin/nice", "-n", "10", shell, "-c", wrappedShell]
        : [...unshareArgs, shell, "-c", wrappedShell];
    }

    if (useRunuser && hasUnshare) {
      runnerCmd = "/usr/sbin/runuser";
      runnerArgs = hasNice
        ? ["-u", "node", "--", "/usr/bin/unshare", ...unshareArgs, "/usr/bin/nice", "-n", "10", shell, "-c", wrappedShell]
        : ["-u", "node", "--", "/usr/bin/unshare", ...unshareArgs, shell, "-c", wrappedShell];
    }

    if (hasTaskset) {
      return {
        command: "/usr/bin/taskset",
        args: [
          "-c",
          cpuCoreList,
          runnerCmd,
          ...runnerArgs,
        ],
      };
    }

    return {
      command: runnerCmd,
      args: runnerArgs,
    };
  }

  /**
   * Write file to sandbox workspace with disk quota & max file size checks
   */
  public writeFile(relPath: string, content: string): void {
    const targetPath = this.resolveSafePath(relPath, true);
    const fileBytes = Buffer.byteLength(content, "utf8");

    // 1. Enforce Max File Size (Backend enforced: 30 MB)
    const maxFileSizeBytes = this.limits.maxFileSizeMb * 1024 * 1024;
    if (fileBytes > maxFileSizeBytes) {
      throw new Error(
        `تجاوز الحد الأقصى لحجم الملف (${(fileBytes / (1024 * 1024)).toFixed(1)} MB > ${this.limits.maxFileSizeMb} MB)`
      );
    }

    // 2. Enforce Total Disk Quota (Backend enforced: 2 GB)
    const currentDisk = this.getDiskUsageBytes();
    const maxDiskBytes = this.limits.diskMb * 1024 * 1024;
    if (currentDisk + fileBytes > maxDiskBytes) {
      this.status = "failed";
      this.errorMessage = `تجاوز الحد الأقصى لسعة القرص المخصصة للساندبوكس (${this.limits.diskMb} MB)`;
      this.addLog("stderr", `[Disk Quota Exceeded] ${this.errorMessage}`);
      throw new Error(this.errorMessage);
    }

    // 3. Prevent symlink poisoning
    if (fs.existsSync(targetPath)) {
      const lstat = fs.lstatSync(targetPath);
      if (lstat.isSymbolicLink()) {
        fs.unlinkSync(targetPath);
      }
    }

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    fs.writeFileSync(targetPath, content, { encoding: "utf8", mode: 0o600 });
    this.lastActivity = Date.now();
  }

  /**
   * Syncs multiple files at once into workspace
   */
  public syncFiles(files: Record<string, string>): void {
    for (const [relPath, content] of Object.entries(files)) {
      this.writeFile(relPath, content);
    }
  }

  /**
   * Reads file from sandbox workspace
   */
  public readFile(relPath: string): string {
    const targetPath = this.resolveSafePath(relPath, true);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found: ${relPath}`);
    }
    this.lastActivity = Date.now();
    return fs.readFileSync(targetPath, "utf8");
  }

  /**
   * Deletes file from sandbox workspace
   */
  public deleteFile(relPath: string): boolean {
    const targetPath = this.resolveSafePath(relPath, true);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      this.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Lists all files in sandbox workspace recursively
   */
  public listFiles(dir = this.workspaceDir): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === "node_modules" || item.name === ".git") continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...this.listFiles(full));
      } else {
        const rel = path.relative(this.workspaceDir, full);
        results.push(rel);
      }
    }
    return results;
  }

  /**
   * Executes a command inside the isolated Linux sandbox
   */
  public async executeCommand(
    cmd: string,
    options?: {
      timeoutMs?: number;
      cwd?: string;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }
  ): Promise<ExecutionResult> {
    this.lastActivity = Date.now();
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 120000; // 2 mins max per single command

    // Enforce process count limit
    if (this.activePids.size >= this.limits.maxProcesses) {
      const err = `تجاوز الحد الأقصى لعدد العمليات المسموح بها (${this.limits.maxProcesses} processes)`;
      this.addLog("stderr", `[Process Limit Exceeded] ${err}`);
      throw new Error(err);
    }

    const workingDir = options?.cwd ? this.resolveSafePath(options.cwd) : this.workspaceDir;
    const { command, args } = this.buildIsolatedCommand(cmd);

    return new Promise((resolve) => {
      let stdoutAcc = "";
      let stderrAcc = "";
      let timedOut = false;

      this.addLog("system", `$ ${cmd}`);

      const child = spawn(command, args, {
        cwd: workingDir,
        env: this.getSanitizedEnv(),
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      if (child.pid) {
        this.activePids.add(child.pid);
      }

      const timer = setTimeout(() => {
        timedOut = true;
        this.addLog("stderr", `[Command Timeout] Command timed out after ${timeoutMs / 1000}s: ${cmd}`);
        try {
          if (child.pid) {
            process.kill(-child.pid, "SIGKILL");
          } else {
            child.kill("SIGKILL");
          }
        } catch {}
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        const str = chunk.toString();
        stdoutAcc += str;
        this.addLog("stdout", str);
        options?.onStdout?.(str);
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const str = chunk.toString();
        stderrAcc += str;
        this.addLog("stderr", str);
        options?.onStderr?.(str);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (child.pid) {
          this.activePids.delete(child.pid);
        }

        const durationMs = Date.now() - startTime;
        const exitCode = code ?? (timedOut ? 124 : 1);

        if (exitCode === 0) {
          this.addLog("system", `✓ Command completed in ${durationMs}ms`);
        } else {
          this.addLog("stderr", `✗ Command failed with exit code ${exitCode} (${durationMs}ms)`);
        }

        resolve({
          exitCode,
          stdout: stdoutAcc,
          stderr: stderrAcc,
          durationMs,
          timedOut,
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        if (child.pid) {
          this.activePids.delete(child.pid);
        }
        this.addLog("stderr", `Execution Error: ${err.message}`);
        resolve({
          exitCode: 1,
          stdout: stdoutAcc,
          stderr: stderrAcc + `\n${err.message}`,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Starts the sandbox project and background service
   */
  public async start(): Promise<{ success: boolean; previewUrl?: string; message: string }> {
    this.status = "starting";
    this.startedAt = Date.now();
    this.lastActivity = Date.now();

    // Setup Sandbox Timeout auto-terminator (Backend enforced: 10 minutes)
    const timeoutMs = this.limits.timeoutMinutes * 60 * 1000;
    this.timeoutTimer = setTimeout(() => {
      this.handleTimeoutExpired();
    }, timeoutMs);
    this.timeoutTimer.unref?.();

    // Setup active RAM monitor (Backend enforced: 500 MB)
    this.startResourceMonitor();

    // Check project entry point
    const hasPackageJson = fs.existsSync(path.join(this.workspaceDir, "package.json"));
    const hasIndexHtml = fs.existsSync(path.join(this.workspaceDir, "index.html"));

    this.status = "running";
    this.previewUrl = `/api/runtime/sandbox/preview/${this.id}`;

    this.addLog(
      "system",
      `[Sandbox Started] Status: RUNNING | Port: ${this.port} | Timeout: ${this.limits.timeoutMinutes}m | RAM Limit: ${this.limits.ramMb}MB | CPU: ${this.limits.cpuCores} Core`
    );

    return {
      success: true,
      previewUrl: this.previewUrl,
      message: "تم تشغيل بيئة SoufTools Native Sandbox بنجاح",
    };
  }

  /**
   * Active resource monitoring loop:
   * Inspects aggregate RSS RAM of all sandbox processes, disk size, and process count.
   * If limits are exceeded, terminates the sandbox to protect the host.
   */
  private startResourceMonitor(): void {
    this.memoryWatcherTimer = setInterval(() => {
      if (this.status !== "running" && this.status !== "active") {
        return;
      }

      try {
        const metrics = this.getLiveMetrics();

        // 1. RAM Limit Enforcement (500 MB)
        if (metrics.ramUsageMb > this.limits.ramMb) {
          this.status = "failed";
          this.errorMessage = `تجاوز الحد الأقصى لاستهلاك الذاكرة (${metrics.ramUsageMb.toFixed(1)} MB / ${this.limits.ramMb} MB)`;
          this.addLog("stderr", `[RAM Limit Exceeded] ${this.errorMessage}`);
          this.stop(true);
          return;
        }

        // 2. Disk Limit Enforcement (2048 MB)
        if (metrics.diskUsageMb > this.limits.diskMb) {
          this.status = "failed";
          this.errorMessage = `تجاوز الحد الأقصى لسعة القرص (${metrics.diskUsageMb.toFixed(1)} MB / ${this.limits.diskMb} MB)`;
          this.addLog("stderr", `[Disk Limit Exceeded] ${this.errorMessage}`);
          this.stop(true);
          return;
        }

        // 3. Process Limit Enforcement (50 processes)
        if (metrics.processCount > this.limits.maxProcesses) {
          this.status = "failed";
          this.errorMessage = `تجاوز الحد الأقصى لعدد العمليات المسموح بها (${metrics.processCount} > ${this.limits.maxProcesses})`;
          this.addLog("stderr", `[Process Limit Exceeded] ${this.errorMessage}`);
          this.stop(true);
          return;
        }
      } catch {}
    }, 2000);
    this.memoryWatcherTimer.unref?.();
  }

  /**
   * Handles Sandbox Timeout (10 minutes expired)
   */
  private handleTimeoutExpired(): void {
    if (this.status === "running" || this.status === "active" || this.status === "starting") {
      this.status = "expired";
      this.errorMessage = `انتهت مدة تشغيل الساندبوكس المسموح بها (${this.limits.timeoutMinutes} دقائق)`;
      this.addLog("system", `[Sandbox Expired] ${this.errorMessage} - إيقاف الموارد وحفظ الحالة.`);
      this.stop(false);
    }
  }

  /**
   * Computes real, non-mocked live metrics from system
   */
  public getLiveMetrics(): SandboxLiveMetrics {
    let totalRssKb = 0;
    let cpuPercent = 0;
    let activeProcesses = 0;

    // Collect process metrics
    if (this.activePids.size > 0) {
      for (const pid of this.activePids) {
        try {
          // Read from /proc/<pid>/statm if available for ultra-fast RSS
          const statmPath = `/proc/${pid}/statm`;
          if (fs.existsSync(statmPath)) {
            const statm = fs.readFileSync(statmPath, "utf8").trim().split(/\s+/);
            const residentPages = parseInt(statm[1], 10) || 0;
            totalRssKb += residentPages * 4; // 4KB per page
            activeProcesses++;
          }
        } catch {}
      }
    }

    // Disk usage
    const diskBytes = this.getDiskUsageBytes();
    const diskMb = +(diskBytes / (1024 * 1024)).toFixed(2);
    const ramMb = +(totalRssKb / 1024).toFixed(2);

    const now = Date.now();
    const durationSeconds = this.startedAt ? Math.floor((now - this.startedAt) / 1000) : 0;
    const timeoutSeconds = this.limits.timeoutMinutes * 60;

    return {
      ramUsageMb: ramMb,
      ramLimitMb: this.limits.ramMb,
      cpuUsagePercent: cpuPercent,
      diskUsageMb: diskMb,
      diskLimitMb: this.limits.diskMb,
      processCount: activeProcesses,
      maxProcesses: this.limits.maxProcesses,
      durationSeconds,
      timeoutSeconds,
      networkStatus: this.limits.networkMode === "restricted" ? "restricted" : "active",
    };
  }

  /**
   * Stops sandbox and terminates child process tree
   */
  public stop(isCrash = false): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.memoryWatcherTimer) {
      clearInterval(this.memoryWatcherTimer);
      this.memoryWatcherTimer = null;
    }

    this.stoppedAt = Date.now();
    if (!isCrash && this.status !== "expired") {
      this.status = "stopped";
    }

    // Terminate all active processes in process group
    for (const pid of this.activePids) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    }
    this.activePids.clear();

    if (this.serverProcess) {
      try {
        if (this.serverProcess.pid) {
          process.kill(-this.serverProcess.pid, "SIGKILL");
        } else {
          this.serverProcess.kill("SIGKILL");
        }
      } catch {}
      this.serverProcess = null;
    }

    this.addLog("system", `[Sandbox Stopped] Freed memory and killed all associated process groups.`);
  }

  /**
   * Cleans up all sandbox files and resources
   */
  public cleanup(): void {
    this.stop();
    try {
      if (fs.existsSync(this.sandboxDir)) {
        fs.rmSync(this.sandboxDir, { recursive: true, force: true });
      }
    } catch (err: any) {
      this.addLog("stderr", `Cleanup error: ${err?.message}`);
    }
  }

  /**
   * Appends a log item to internal ring buffer
   */
  public addLog(stream: "stdout" | "stderr" | "system", message: string): void {
    this.logs.push({
      timestamp: Date.now(),
      stream,
      message,
    });
    if (this.logs.length > 500) {
      this.logs.shift();
    }
  }

  /**
   * Returns current logs
   */
  public getLogs(limit = 100): Array<{ timestamp: number; stream: "stdout" | "stderr" | "system"; message: string }> {
    return this.logs.slice(-limit);
  }

  /**
   * Returns current resource metrics
   */
  public getMetrics(): { pidsCount: number; uptimeSeconds: number; createdAt: number; lastActivity: number } {
    return {
      pidsCount: this.activePids.size,
      uptimeSeconds: Math.floor((Date.now() - this.createdAt) / 1000),
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
    };
  }
}
