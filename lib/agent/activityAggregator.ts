/**
 * SoufAI Agent Activity Aggregator
 *
 * Transforms raw heterogeneous Agent Events into clean, deduplicated,
 * human-comprehensible summaries for the SoufTools Chat UI.
 *
 * Rules:
 * 1. Raw Events -> Group -> Deduplicate -> Summarize -> Dynamic Current Activity.
 * 2. Groups consecutive file operations (e.g. 15 files -> "إنشاء وتعديل الملفات (15 ملفاً)").
 * 3. Classifies task complexity:
 *    - 'none' (simple conversation, general Q&A, translation) -> Don't show agent card at all!
 *    - 'quick' (single small tool or fast action) -> Minimal inline pulse.
 *    - 'medium' (analysis or file fix) -> Compact inline activity.
 *    - 'complex' (multi-step project, multiple files, builds, parallel subtasks) -> Smart compact card.
 * 4. Generates dynamic currentActivity text purely from actual events.
 */

export interface AggregatedActivityItem {
  id: string;
  category: "plan" | "file" | "dep" | "build" | "preview" | "debug" | "search" | "tool" | "verify" | "general";
  icon: string;
  title: string;
  detail?: string;
  status: "pending" | "running" | "completed" | "failed" | "warning";
  timestamp: number;
  timeStr: string;
  durationMs?: number;
  count?: number;
  items?: string[];
}

export interface ParallelSubtaskItem {
  id: string;
  name: string;
  worker?: string;
  status: "pending" | "running" | "completed" | "failed";
}

export type TaskComplexityLevel = "none" | "quick" | "medium" | "complex";

export interface AggregatedActivitySummary {
  complexity: TaskComplexityLevel;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  currentActivity: string;
  currentActivityIcon: string;
  projectGoal?: string;
  totalSteps: number;
  totalTools: number;
  totalFiles: number;
  durationSeconds: number;
  statsLabel: string;
  completionTitle: string;
  parallelTasks: ParallelSubtaskItem[];
  timeline: AggregatedActivityItem[];
  hasErrors: boolean;
  errorMessage?: string;
}

interface RawEventInput {
  id?: string;
  type?: string;
  eventType?: string;
  title?: string;
  summary?: string;
  description?: string;
  status?: string;
  timestamp?: number | string;
  tool?: string;
  metadata?: Record<string, any>;
  agentWorker?: string;
}

/**
 * Format timestamp to HH:MM:SS
 */
function formatTime(ts?: number | string): string {
  if (!ts) return "";
  try {
    const d = new Date(typeof ts === "string" ? ts : ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-GB", { hour12: false });
  } catch {
    return "";
  }
}

/**
 * Detects if a prompt or raw input is a simple direct conversational query
 * that should NEVER display an Agent Activity card.
 */
export function isSimpleDirectQuery(prompt: string = "", stepsCount: number = 0, toolsCount: number = 0): boolean {
  if (stepsCount > 2 || toolsCount > 1) return false;
  const p = prompt.trim().toLowerCase();
  if (!p) return true;

  // Explicit complex task indicators
  if (/ابنِ|بناء|مشروع|تطبيق|برمج|طور|منصة|saas|موقع كامل|sandbox|build|npm|dependencies|fullstack|ديف/i.test(p)) {
    return false;
  }
  // Short conversational or standard queries
  if (
    /^(ما|ماذا|من|متى|أين|كيف|هل|كم|ترجم|عرف|اشرح|لماذا|hello|hi|what|who|where|when|why|how|translate)\b/i.test(p) &&
    p.length < 80 &&
    toolsCount === 0
  ) {
    return true;
  }
  return false;
}

/**
 * Main Aggregator Function
 */
export function aggregateAgentActivities(options: {
  events?: RawEventInput[];
  agentSteps?: string[];
  userPrompt?: string;
  status?: "pending" | "running" | "completed" | "failed" | "cancelled";
  isGenerating?: boolean;
  isStreaming?: boolean;
  locale?: string;
  projectName?: string;
  toolsUsed?: Array<{ name: string; status?: string }>;
  sources?: any[];
  startTime?: number;
}): AggregatedActivitySummary {
  const {
    events = [],
    agentSteps = [],
    userPrompt = "",
    status: explicitStatus,
    isGenerating = false,
    isStreaming = false,
    locale = "ar",
    projectName,
    toolsUsed = [],
    sources = [],
    startTime,
  } = options;

  const isRtl = locale === "ar";
  const isRunning = isGenerating || isStreaming || explicitStatus === "running";
  const isCancelled = explicitStatus === "cancelled";
  const isFailed = explicitStatus === "failed";
  const isCompleted = !isRunning && !isCancelled && !isFailed;

  // 1. Gather raw actions from events or agentSteps
  const rawEventsList: RawEventInput[] = [];

  if (events && events.length > 0) {
    rawEventsList.push(...events);
  } else if (agentSteps && agentSteps.length > 0) {
    agentSteps.forEach((step, idx) => {
      rawEventsList.push({
        id: `step_${idx}`,
        title: step,
        type: step.includes("بحث")
          ? "search"
          : step.includes("ملف") || step.includes("كود")
          ? "file.created"
          : step.includes("حزمة") || step.includes("تثبيت") || step.includes("dependency")
          ? "dependency.install"
          : step.includes("بناء") || step.includes("Build")
          ? "build.started"
          : step.includes("معاينة") || step.includes("Preview")
          ? "preview.started"
          : step.includes("فحص") || step.includes("تحقق")
          ? "verification.started"
          : "tool.started",
        status: isRunning && idx === agentSteps.length - 1 ? "running" : "completed",
        timestamp: Date.now() - (agentSteps.length - idx) * 800,
      });
    });
  }

  // 2. Count distinct tools & files
  const toolsSet = new Set<string>();
  toolsUsed.forEach((t) => t.name && toolsSet.add(t.name));
  let fileOperationsCount = 0;
  let hasBuild = false;
  let hasDebug = false;
  let hasPreview = false;
  let parallelMap = new Map<string, ParallelSubtaskItem>();

  // 3. Process and Group sequential events
  const timeline: AggregatedActivityItem[] = [];
  let currentFileGroup: { count: number; files: string[]; firstTs: number; lastTs: number; status: any } | null = null;
  let currentSearchGroup: { count: number; queries: string[]; firstTs: number; lastTs: number; status: any } | null = null;

  const flushFileGroup = () => {
    if (currentFileGroup && currentFileGroup.count > 0) {
      timeline.push({
        id: `grouped_files_${timeline.length}`,
        category: "file",
        icon: "📄",
        title: isRtl
          ? `إنشاء وتحديث ملفات المشروع (${currentFileGroup.count} ملفاً)`
          : `Create & update files (${currentFileGroup.count} files)`,
        detail: currentFileGroup.files.slice(-4).join(", ") + (currentFileGroup.files.length > 4 ? "..." : ""),
        status: currentFileGroup.status,
        timestamp: currentFileGroup.lastTs,
        timeStr: formatTime(currentFileGroup.lastTs),
        count: currentFileGroup.count,
        items: currentFileGroup.files,
      });
      currentFileGroup = null;
    }
  };

  const flushSearchGroup = () => {
    if (currentSearchGroup && currentSearchGroup.count > 0) {
      timeline.push({
        id: `grouped_search_${timeline.length}`,
        category: "search",
        icon: "🔍",
        title: isRtl
          ? `البحث في الويب ومراجعة المصادر (${currentSearchGroup.count} نتائج)`
          : `Web search & verify sources (${currentSearchGroup.count} queries)`,
        detail: currentSearchGroup.queries.slice(-3).join(" • "),
        status: currentSearchGroup.status,
        timestamp: currentSearchGroup.lastTs,
        timeStr: formatTime(currentSearchGroup.lastTs),
        count: currentSearchGroup.count,
      });
      currentSearchGroup = null;
    }
  };

  rawEventsList.forEach((ev, idx) => {
    const rawType = (ev.eventType || ev.type || "").toLowerCase();
    const rawTitle = ev.title || ev.summary || ev.description || "Activity";
    const statusVal = (ev.status || (idx === rawEventsList.length - 1 && isRunning ? "running" : "completed")) as any;
    const ts = typeof ev.timestamp === "number" ? ev.timestamp : Date.now();

    if (ev.tool) toolsSet.add(ev.tool);

    // Parallel subtask tracking
    if (rawType.includes("subtask") || ev.agentWorker || ev.metadata?.subtask) {
      const subtaskId = ev.metadata?.subtaskId || ev.agentWorker || rawTitle;
      const subtaskName = ev.metadata?.subtaskTitle || rawTitle;
      parallelMap.set(subtaskId, {
        id: subtaskId,
        name: subtaskName,
        worker: ev.agentWorker,
        status: statusVal === "running" ? "running" : statusVal === "failed" ? "failed" : "completed",
      });
    }

    // 3a. File operations grouping
    if (
      rawType.includes("file") ||
      rawTitle.includes("ملف") ||
      rawTitle.includes("كتب ملف") ||
      rawTitle.includes("كتابة") ||
      rawTitle.includes(".tsx") ||
      rawTitle.includes(".ts") ||
      rawTitle.includes(".json")
    ) {
      flushSearchGroup();
      fileOperationsCount++;
      const fileNameMatch = rawTitle.match(/([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `File #${fileOperationsCount}`;
      if (!currentFileGroup) {
        currentFileGroup = { count: 1, files: [fileName], firstTs: ts, lastTs: ts, status: statusVal };
      } else {
        currentFileGroup.count++;
        if (!currentFileGroup.files.includes(fileName)) {
          currentFileGroup.files.push(fileName);
        }
        currentFileGroup.lastTs = ts;
        if (statusVal === "running") currentFileGroup.status = "running";
      }
      return;
    }

    // 3b. Search operations grouping
    if (rawType.includes("search") || rawTitle.includes("بحث") || rawType.includes("source")) {
      flushFileGroup();
      if (!currentSearchGroup) {
        currentSearchGroup = { count: 1, queries: [rawTitle], firstTs: ts, lastTs: ts, status: statusVal };
      } else {
        currentSearchGroup.count++;
        if (!currentSearchGroup.queries.includes(rawTitle)) {
          currentSearchGroup.queries.push(rawTitle);
        }
        currentSearchGroup.lastTs = ts;
        if (statusVal === "running") currentSearchGroup.status = "running";
      }
      return;
    }

    // Flush any pending groups before adding distinct event
    flushFileGroup();
    flushSearchGroup();

    // 3c. Dependency install
    if (rawType.includes("depend") || rawTitle.includes("تثبيت") || rawTitle.includes("حزم") || rawTitle.includes("npm")) {
      timeline.push({
        id: ev.id || `act_${idx}`,
        category: "dep",
        icon: "📦",
        title: rawTitle,
        detail: ev.summary,
        status: statusVal,
        timestamp: ts,
        timeStr: formatTime(ts),
      });
      return;
    }

    // 3d. Build
    if (rawType.includes("build") || rawTitle.includes("Build") || rawTitle.includes("بناء")) {
      hasBuild = true;
      timeline.push({
        id: ev.id || `act_${idx}`,
        category: "build",
        icon: "▶️",
        title: rawTitle,
        detail: ev.summary,
        status: statusVal,
        timestamp: ts,
        timeStr: formatTime(ts),
      });
      return;
    }

    // 3e. Debug / Error Fix
    if (rawType.includes("debug") || rawType.includes("error") || rawTitle.includes("إصلاح") || rawTitle.includes("خطأ")) {
      hasDebug = true;
      timeline.push({
        id: ev.id || `act_${idx}`,
        category: "debug",
        icon: "🔧",
        title: rawTitle,
        detail: ev.summary,
        status: statusVal,
        timestamp: ts,
        timeStr: formatTime(ts),
      });
      return;
    }

    // 3f. Preview / Testing
    if (rawType.includes("preview") || rawType.includes("vision") || rawTitle.includes("معاينة") || rawTitle.includes("Preview")) {
      hasPreview = true;
      timeline.push({
        id: ev.id || `act_${idx}`,
        category: "preview",
        icon: "👁️",
        title: rawTitle,
        detail: ev.summary,
        status: statusVal,
        timestamp: ts,
        timeStr: formatTime(ts),
      });
      return;
    }

    // 3g. Planning / Analysis
    if (rawType.includes("plan") || rawType.includes("analy") || rawTitle.includes("خطة") || rawTitle.includes("تحليل")) {
      timeline.push({
        id: ev.id || `act_${idx}`,
        category: "plan",
        icon: "🧠",
        title: rawTitle,
        detail: ev.summary,
        status: statusVal,
        timestamp: ts,
        timeStr: formatTime(ts),
      });
      return;
    }

    // 3h. Default / Tool event
    timeline.push({
      id: ev.id || `act_${idx}`,
      category: "tool",
      icon: "⚡",
      title: rawTitle,
      detail: ev.summary,
      status: statusVal,
      timestamp: ts,
      timeStr: formatTime(ts),
    });
  });

  // Flush remaining
  flushFileGroup();
  flushSearchGroup();

  // If sources exist and no search in timeline, add aggregated source reference
  if (sources.length > 0 && !timeline.some((t) => t.category === "search")) {
    timeline.unshift({
      id: "sources_agg",
      category: "search",
      icon: "🔍",
      title: isRtl ? `استشارة ${sources.length} مصادر موثوقة من الويب` : `Consulted ${sources.length} verified web sources`,
      status: "completed",
      timestamp: Date.now(),
      timeStr: formatTime(Date.now()),
      count: sources.length,
    });
  }

  // 4. Determine Dynamic Current Activity Text (Requirement 14)
  let currentActivity = "";
  let currentActivityIcon = "⚡";

  if (isRunning) {
    // Look at the latest item in timeline or raw events
    const latestItem = timeline[timeline.length - 1];
    if (latestItem) {
      currentActivityIcon = latestItem.icon || "⚡";
      if (latestItem.category === "file") {
        currentActivity = isRtl ? "يكتب ملفات المشروع..." : "Writing project files...";
      } else if (latestItem.category === "dep") {
        currentActivity = isRtl ? "تثبيت dependencies والمكتبات..." : "Installing dependencies...";
      } else if (latestItem.category === "build") {
        currentActivity = isRtl ? "تشغيل build وفحص البناء..." : "Running build test...";
      } else if (latestItem.category === "debug") {
        currentActivity = isRtl ? "إصلاح وتصحيح الكود البرمجي..." : "Fixing issues & debugging...";
      } else if (latestItem.category === "preview") {
        currentActivity = isRtl ? "فحص Preview واختبار الواجهة..." : "Inspecting preview & UI...";
      } else if (latestItem.category === "search") {
        currentActivity = isRtl ? "يبحث في الويب ويراجع المصادر..." : "Searching web & verifying...";
      } else if (latestItem.category === "plan") {
        currentActivity = isRtl ? "يحلل المهمة ويضع الخطة..." : "Analyzing task & planning...";
      } else {
        currentActivity = latestItem.title.replace(/\.{3}$/, "") + "...";
      }
    } else {
      // Starting pulse
      if (/كود|مشروع|تطبيق|ابن|saas/i.test(userPrompt)) {
        currentActivity = isRtl ? "يبني المشروع..." : "Building project...";
        currentActivityIcon = "🏗️";
      } else if (/صلح|خطأ|bug|fix/i.test(userPrompt)) {
        currentActivity = isRtl ? "يحلل الملف ويصلح الخطأ..." : "Analyzing file & fixing error...";
        currentActivityIcon = "🔧";
      } else if (/بحث|معلومات|سعر|أخبار/i.test(userPrompt)) {
        currentActivity = isRtl ? "يبحث في الويب..." : "Searching web...";
        currentActivityIcon = "🔍";
      } else {
        currentActivity = isRtl ? "يعمل على تنفيذ طلبك..." : "Processing your request...";
        currentActivityIcon = "⚡";
      }
    }
  } else if (isFailed) {
    currentActivity = isRtl ? "تعثرت بعض العمليات" : "Operation encountered an error";
    currentActivityIcon = "⚠️";
  } else if (isCancelled) {
    currentActivity = isRtl ? "تم إيقاف الوكيل بواسطة المستخدم" : "Stopped by user";
    currentActivityIcon = "⏹️";
  } else {
    currentActivity = isRtl ? "اكتمل بناء المطلوب بنجاح" : "Task completed successfully";
    currentActivityIcon = "✓";
  }

  // 5. Classify Task Complexity (Requirements 2, 3, 8, 9, 10)
  let complexity: TaskComplexityLevel = "none";
  const totalSteps = rawEventsList.length || timeline.length;
  const totalTools = Math.max(toolsSet.size, toolsUsed.length);

  // If simple query with no steps and no tools
  if (isSimpleDirectQuery(userPrompt, totalSteps, totalTools)) {
    complexity = isRunning && totalSteps > 0 ? "quick" : "none";
  } else if (totalSteps <= 1 && totalTools <= 1 && fileOperationsCount === 0 && !hasBuild) {
    // Quick task (e.g. "اكتب لي دالة JavaScript" or simple calculation)
    complexity = "quick";
  } else if (totalSteps <= 3 && fileOperationsCount <= 1 && !hasBuild && parallelMap.size <= 1) {
    // Medium task (e.g. "حلل هذا الملف وأصلح الخطأ")
    complexity = "medium";
  } else {
    // Complex task (e.g. full app, multiple files, dependencies, build, parallel)
    complexity = "complex";
  }

  // 6. Calculate Duration
  const now = Date.now();
  const start = startTime || (rawEventsList[0]?.timestamp ? Number(rawEventsList[0].timestamp) : now - totalSteps * 1800);
  const durationMs = Math.max(1000, now - start);
  const durationSeconds = Math.round(durationMs / 1000);

  const durationStr = isRtl
    ? durationSeconds > 60
      ? `${Math.floor(durationSeconds / 60)} دقيقة و ${durationSeconds % 60} ثانية`
      : `${durationSeconds} ثانية`
    : durationSeconds > 60
    ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
    : `${durationSeconds}s`;

  // Stats label
  const statsParts: string[] = [];
  if (totalSteps > 0) {
    statsParts.push(isRtl ? `${totalSteps} خطوات` : `${totalSteps} steps`);
  }
  if (totalTools > 0) {
    statsParts.push(isRtl ? `${totalTools} أدوات` : `${totalTools} tools`);
  }
  if (fileOperationsCount > 0) {
    statsParts.push(isRtl ? `${fileOperationsCount} ملفات` : `${fileOperationsCount} files`);
  }
  statsParts.push(durationStr);
  const statsLabel = statsParts.join(" · ");

  // Completion Title
  let completionTitle = isRtl ? "اكتملت المهمة بنجاح" : "Task completed successfully";
  if (fileOperationsCount > 0 || hasBuild) {
    completionTitle = isRtl ? "اكتمل بناء المشروع بنجاح" : "Project build completed";
  } else if (hasDebug) {
    completionTitle = isRtl ? "تم إصلاح الخطأ والتحقق بنجاح" : "Issue fixed & verified";
  } else if (sources.length > 0) {
    completionTitle = isRtl ? "تم إنجاز البحث وتوثيق الإجابة" : "Research completed with verified sources";
  }

  return {
    complexity,
    status: isRunning ? "running" : isCancelled ? "cancelled" : isFailed ? "failed" : "completed",
    currentActivity,
    currentActivityIcon,
    projectGoal: projectName,
    totalSteps,
    totalTools,
    totalFiles: fileOperationsCount,
    durationSeconds,
    statsLabel,
    completionTitle,
    parallelTasks: Array.from(parallelMap.values()),
    timeline,
    hasErrors: isFailed || timeline.some((t) => t.status === "failed"),
  };
}
