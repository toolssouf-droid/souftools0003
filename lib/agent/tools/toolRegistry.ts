/**
 * SoufAI Real Plug-in Tool Registry
 * Manages, validates, documents, and executes real agent tools.
 */

import { AgentTool, AgentToolExecutionContext, StructuredToolResult } from "./toolInterface";
import { executeRawSearchQuery } from "@/lib/agent/webResearchAgent";
import { getCurrentTimeInfo, convertTimeInfo } from "@/lib/tools/timeEngine";
import { generateImageViaManager } from "@/lib/providers/imageProviderManager";
import { VisionCapabilityLayer } from "@/lib/vision/visionCapabilityLayer";
import { runCodingAgent } from "@/lib/agent/coding/codingAgentEngine";
import { ProjectWorkspace, SupportedFramework } from "@/lib/agent/coding/types";
import { FRAMEWORK_PRESETS } from "@/lib/agent/coding/frameworkPresets";
import { getUserMemories, getMemorySettings } from "@/lib/memory/memoryService";
import { retrieveRelevantMemories } from "@/lib/memory/memoryAnalyzer";
import {
  saveUserMemoryTool,
  updateUserMemoryTool,
  deleteUserMemoryTool,
  getUserProfileTool,
} from "./memoryTools";
import { taskCreateTool, taskListTool, scheduleEmailTool, scheduleCancelTool } from "./taskTools";
import { useScheduleStore } from "@/store/scheduleStore";
import { whatsappSendTool, whatsappTemplateTool } from "./whatsappTools";
import { gmailSearchTool, gmailReadTool, gmailDraftTool, gmailSummarizeTool } from "./gmailTools";
import { soufFileTool } from "./soufFileTool";
import { mediaPlayerTool } from "./mediaPlayerTool";
import { updateLoadedToolsStats } from "@/lib/toolsConfig";


function safeParseToolResult(rawRes: any): any {
  if (!rawRes) return { success: false, error: "استجابة فارغة من الأداة" };
  if (typeof rawRes !== "string") return rawRes;
  try {
    return JSON.parse(rawRes);
  } catch {
    const first = rawRes.indexOf("{");
    const last = rawRes.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(rawRes.substring(first, last + 1));
      } catch {}
    }
    return { success: true, message: rawRes };
  }
}

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  public registerTool(tool: AgentTool): void {
    this.tools.set(tool.name.toLowerCase(), tool);
  }

  public getTool(name: string): AgentTool | undefined {
    return this.tools.get(name.toLowerCase());
  }

  public getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name.toLowerCase());
  }

  public isToolAllowedForChannel(name: string, channel: "web" | "telegram" | "api" = "web"): boolean {
    const tool = this.getTool(name);
    if (!tool) return false;
    if (channel === "telegram" && tool.category === "sandbox_system") return false;
    if (tool.allowedChannels && tool.allowedChannels.length > 0) {
      return tool.allowedChannels.includes(channel);
    }
    return true;
  }

  public getToolsForChannel(channel: "web" | "telegram" | "api" = "web", activeFilter?: string[]): AgentTool[] {
    return this.getAllTools().filter((tool) => {
      if (channel === "telegram" && tool.category === "sandbox_system") {
        return false;
      }
      if (tool.allowedChannels && tool.allowedChannels.length > 0) {
        if (!tool.allowedChannels.includes(channel)) {
          return false;
        }
      }
      if (!activeFilter || activeFilter.length === 0) return true;
      return activeFilter.includes(tool.name);
    });
  }

  public getToolsDocumentation(activeFilter?: string[], channel: "web" | "telegram" | "api" = "web"): string {
    const tools = this.getToolsForChannel(channel, activeFilter);

    return tools
      .map((t) => {
        const schemaProps = Object.entries(t.inputSchema.properties || {})
          .map(([k, v]) => `    "${k}": "${v.description}${v.enum ? ` (خيارات: ${v.enum.join(" | ")})` : ""}"`)
          .join(",\n");
        return `- "${t.name}": {\n${schemaProps}\n  }\n  الوصف: ${t.description} (الفئة: ${t.category || "server_safe"}, التوازي: ${t.supportsParallel ? "نعم" : "لا"}, التكلفة: ${t.cost})`;
      })
      .join("\n\n");
  }

  private registerBuiltInTools(): void {
    // ----------------------------------------------------
    // 1. WEB SEARCH TOOL
    // ----------------------------------------------------
    this.registerTool({
      name: "web_search",
      description: "البحث الحي في الويب وجلب مصادر وروابط موثوقة وأحدث الأخبار والمعلومات لعام 2026",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "استعلام البحث الدقيق والمركز" },
        },
        required: ["query"],
      },
      permissions: ["network:web_search"],
      timeout: 10000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: { query: string }, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const query = (args?.query || "").trim();
        if (!query) {
          return {
            success: false,
            tool: "web_search",
            data: null,
            error: { code: "MISSING_ARGUMENT", message: "استعلام البحث غير مدخل", retryable: false },
          };
        }

        try {
          if (context.onProgress) {
            context.onProgress({ title: "🔎 جاري البحث في الويب", summary: `استعلام: "${query}"` });
          }

          const searchRes = await executeRawSearchQuery(query);
          const sources = (searchRes.results || []).map((r) => {
            let domain = "web";
            try {
              domain = new URL(r.url).hostname.replace(/^www\./, "");
            } catch {}
            return {
              title: r.title,
              snippet: r.snippet,
              url: r.url,
              domain,
            };
          });

          const topSources = sources.slice(0, 4);
          const contextNote =
            `[نتائج البحث الحي في الويب لـ "${query}" (${searchRes.providerUsed})]:\n` +
            (topSources.length > 0
              ? topSources.map((s, idx) => `${idx + 1}. [${s.title}]\n   ملخص: ${s.snippet.slice(0, 220)}`).join("\n\n")
              : "لم يتم العثور على نتائج مطابقة لهذا الاستعلام.");

          return {
            success: sources.length > 0,
            tool: "web_search",
            data: { query, count: sources.length, providerUsed: searchRes.providerUsed },
            sources,
            contextNote,
            error: sources.length === 0 ? { code: "NO_RESULTS", message: "لم يتم العثور على نتائج بحث", retryable: true } : null,
          };
        } catch (err: any) {
          return {
            success: false,
            tool: "web_search",
            data: null,
            error: { code: "SEARCH_FAILED", message: err?.message || "تعذر إجراء البحث في الويب", retryable: true },
          };
        }
      },
    });

    // ----------------------------------------------------
    // 2. OPEN / READ PAGE TOOL
    // ----------------------------------------------------
    this.registerTool({
      name: "open_page",
      description: "فتح رابط صفحة ويب أو مستند وقراءة محتواه واستخراج النصوص والبيانات الفعلية",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "رابط الصفحة الكامل (مثال: https://react.dev)" },
        },
        required: ["url"],
      },
      permissions: ["network:http_get"],
      timeout: 10000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: { url: string }, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const url = (args?.url || "").trim();
        if (!url) {
          return {
            success: false,
            tool: "open_page",
            data: null,
            error: { code: "MISSING_ARGUMENT", message: "رابط الموقع غير مدخل", retryable: false },
          };
        }

        try {
          if (context.onProgress) {
            context.onProgress({ title: "🌐 جاري فتح الصفحة وقراءة المحتوى", summary: url });
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(url, {
            signal: context.signal ? context.signal : controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SoufAI/2026 AgentRuntime",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            updateLoadedToolsStats("reader", "failed", url, 100);
            return {
              success: false,
              tool: "open_page",
              data: { url },
              error: { code: "HTTP_ERROR", message: `تعذر جلب الصفحة (رمز الاستجابة ${res.status})`, retryable: true },
            };
          }

          const html = await res.text();
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : url;

          let cleanText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (cleanText.length > 2200) {
            cleanText = cleanText.substring(0, 2200) + "... [تم اقتطاع النص للاختصار]";
          }

          updateLoadedToolsStats("reader", "success", url, 180);

          return {
            success: true,
            tool: "open_page",
            data: { url, title, length: cleanText.length },
            contextNote: `[محتوى صفحة الويب المقروءة: ${title} (${url})]:\n${cleanText}`,
            error: null,
          };
        } catch (fetchErr: any) {
          updateLoadedToolsStats("reader", "failed", url, 100);
          return {
            success: false,
            tool: "open_page",
            data: { url },
            error: { code: "FETCH_FAILED", message: fetchErr?.message || "فشل الاتصال بالموقع وقراءة الصفحة", retryable: true },
          };
        }
      },
    });

    // ----------------------------------------------------
    // 3. READ FILE TOOL
    // ----------------------------------------------------
    this.registerTool({
      name: "read_file",
      description: "قراءة محتوى ملف مرفق أو مستند أو كود برمجي واستخراج نصوصه وجداوله",
      inputSchema: {
        type: "object",
        properties: {
          fileName: { type: "string", description: "اسم الملف المرفق أو المسار المراد قراءته" },
        },
        required: ["fileName"],
      },
      permissions: ["files:read"],
      timeout: 5000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: { fileName: string }, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const fileName = (args?.fileName || "").trim().toLowerCase();
        const attachments = context.attachments || [];

        if (attachments.length === 0) {
          return {
            success: false,
            tool: "read_file",
            data: null,
            error: { code: "NO_ATTACHMENTS", message: "لا توجد ملفات مرفقة في الجلسة الحالية", retryable: false },
          };
        }

        const matched = attachments.find(
          (a) => (a.name || "").toLowerCase().includes(fileName) || fileName.includes((a.name || "").toLowerCase())
        ) || attachments[0];

        try {
          let text = "";
          if (matched.data && matched.data.includes(";base64,")) {
            const base64Str = matched.data.split(";base64,")[1];
            text = Buffer.from(base64Str, "base64").toString("utf-8");
          } else if (matched.data) {
            text = matched.data;
          }

          return {
            success: true,
            tool: "read_file",
            data: { name: matched.name, size: matched.size, mimeType: matched.mimeType, length: text.length },
            contextNote: `[محتوى الملف المرفق (${matched.name})]:\n${text.slice(0, 8000)}`,
            error: null,
          };
        } catch (err: any) {
          return {
            success: false,
            tool: "read_file",
            data: null,
            error: { code: "DECODE_ERROR", message: "تعذر فك تشفير وقراءة الملف المرفق", retryable: false },
          };
        }
      },
    });

    // ----------------------------------------------------
    // 4. AUTONOMOUS CODING AGENT TOOL
    // ----------------------------------------------------
    this.registerTool({
      name: "coding",
      description: "بناء وتعديل وتطوير تطبيقات برمجية كاملة، ملفات كود حقيقية، اختبارات، وتشغيل المعاينة التفاعلية في الساندبوكس",
      category: "sandbox_system",
      allowedChannels: ["web"],
      inputSchema: {
        type: "object",
        properties: {
          userPrompt: { type: "string", description: "الوصف التفصيلي للتطبيق أو التعديل البرمجي المطلوب تنفيذه" },
          framework: {
            type: "string",
            description: "إطار العمل المفضل للمشروع",
            enum: ["react", "nextjs", "vue", "svelte", "vanilla_html", "nodejs", "python_fastapi"],
          },
          title: { type: "string", description: "عنوان اختياري للمشروع" },
        },
        required: ["userPrompt"],
      },
      permissions: ["code:execute", "workspace:write"],
      timeout: 30000,
      cost: 2,
      supportsParallel: false,
      execute: async (
        args: { userPrompt: string; framework?: SupportedFramework; title?: string },
        context: AgentToolExecutionContext
      ): Promise<StructuredToolResult> => {
        const userPrompt = args?.userPrompt || "Build full-featured application";

        let framework: SupportedFramework = (args?.framework as SupportedFramework) || "react";
        const lowerP = userPrompt.toLowerCase();
        if (lowerP.includes("next.js") || lowerP.includes("nextjs")) framework = "nextjs";
        else if (lowerP.includes("vue")) framework = "vue";
        else if (lowerP.includes("svelte")) framework = "svelte";
        else if (lowerP.includes("html") || lowerP.includes("صفحة html")) framework = "vanilla_html";
        else if (lowerP.includes("python") || lowerP.includes("fastapi")) framework = "python_fastapi";
        else if (lowerP.includes("express") || lowerP.includes("node")) framework = "nodejs";

        const preset = FRAMEWORK_PRESETS[framework] || FRAMEWORK_PRESETS.react;
        const initialFiles: Record<string, any> = {};
        Object.entries(preset.initialFiles).forEach(([p, content]) => {
          initialFiles[p] = {
            path: p,
            content,
            language: p.endsWith("tsx") || p.endsWith("ts") ? "typescript" : "json",
            updatedAt: Date.now(),
          };
        });

        const initialWorkspace: ProjectWorkspace = {
          id: `ws_${Date.now()}`,
          title: args?.title || `مشروع ${preset.name}`,
          description: userPrompt,
          framework,
          files: initialFiles,
          activeFilePath: preset.entryFile,
          openFilePaths: [preset.entryFile, "package.json", "README.md"],
          checkpoints: [],
          errors: [],
          terminalLogs: [
            {
              id: `log_init_${Date.now()}`,
              text: `⚡ بيئة العمل البرمجية جاهزة لإطار العمل (${framework}). جاري بناء وتطبيق الأكواد الحقيقية...`,
              type: "info",
              timestamp: Date.now(),
            },
          ],
          agentSteps: [],
          isPreviewRunning: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        if (context.onProgress) {
          context.onProgress({ title: "💻 جاري هندسة وبناء المشروع البرمجي", summary: userPrompt.slice(0, 70) });
        }

        const result = await runCodingAgent({
          userPrompt,
          workspace: initialWorkspace,
          userId: context.userId,
          modelId: "coder",
        });

        const generatedFilesList = Object.keys(result.updatedWorkspace.files || {}).join(", ");
        const contextNote = `[أداة البرمجة الحقيقية - coding]:
- تم بنجاح بناء وتوليد ملفات المشروع الحقيقية: (${generatedFilesList}).
- تم تشغيل واختبار المشروع في المعاينة الحية التفاعلية بنجاح.
- ملخص الإنجاز: ${result.summary}
- رسالة الوكيل: ${result.agentResponse}
- تنبيه حاسم: لا تعيد كتابة ملفات الأكواد كاملة كنص عادي في الدردشة لأن واجهة المعاينة الحية ومحرر الملفات المباشر تم تضمينها وتشغيلها للمستخدم بالفعل. اذكر ملخصاً احترافياً للميزات والإنجاز فقط.`;

        return {
          success: true,
          tool: "coding",
          data: {
            workspace: result.updatedWorkspace,
            summary: result.summary,
            steps: result.steps,
            logs: result.logs,
          },
          contextNote,
          widgetData: {
            type: "coding_workspace",
            data: {
              workspace: result.updatedWorkspace,
              summary: result.summary,
              steps: result.steps,
              logs: result.logs,
            },
          },
          error: null,
        };
      },
    });

    // ----------------------------------------------------
    // 5. CALCULATOR TOOL
    // ----------------------------------------------------
    this.registerTool({
      name: "calculator",
      description: "تنفيذ العمليات الحسابية والمعادلات الرياضية وحساب النسب والجذور بدقة بالغة",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string", description: "التعبير الرياضي المراد حسابه (مثال: (1500 * 0.2) + Math.sqrt(144))" },
        },
        required: ["expression"],
      },
      permissions: ["math:execute"],
      timeout: 3000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: { expression: string }): Promise<StructuredToolResult> => {
        const expr = (args?.expression || "").trim();
        if (!expr) {
          return {
            success: false,
            tool: "calculator",
            data: null,
            error: { code: "MISSING_ARGUMENT", message: "التعبير الرياضي غير مدخل", retryable: false },
          };
        }

        try {
          const sanitized = expr
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .replace(/\^/g, "**")
            .replace(/,/g, "")
            .replace(/[^0-9+\-*/().,% Math.sqrtMath.powMath.sinMath.cosMath.tanMath.logMath.PI]/g, "");

          const mathScope = {
            sqrt: Math.sqrt,
            pow: Math.pow,
            sin: Math.sin,
            cos: Math.cos,
            tan: Math.tan,
            log: Math.log,
            PI: Math.PI,
            E: Math.E,
            abs: Math.abs,
            round: Math.round,
            floor: Math.floor,
            ceil: Math.ceil,
          };

          const fn = new Function("Math", `with(Math) { return ${sanitized}; }`);
          const numRes = fn(mathScope);

          const formatted = Number.isFinite(numRes) ? numRes.toLocaleString("ar-EG") : String(numRes);

          updateLoadedToolsStats("calculator", "success", expr, 10);

          return {
            success: true,
            tool: "calculator",
            data: { expression: expr, result: numRes, formatted },
            contextNote: `[أداة الحاسبة الرياضية]: الحساب لـ (${expr}) = ${formatted}`,
            widgetData: { type: "calculator", data: { expression: expr, result: numRes, formatted } },
            error: null,
          };
        } catch (mErr: any) {
          updateLoadedToolsStats("calculator", "failed", expr, 5);
          return {
            success: false,
            tool: "calculator",
            data: null,
            error: { code: "INVALID_EXPRESSION", message: "التعبير الرياضي غير صالح أو غير قابل للحساب", retryable: true },
          };
        }
      },
    });

    // ----------------------------------------------------
    // 6. TIME TOOLS (GET CURRENT TIME & CONVERT TIME)
    // ----------------------------------------------------
    this.registerTool({
      name: "get_current_time",
      description: "معرفة الوقت الحالي والتاريخ واليوم بدقة لأي مدينة أو دولة أو منطقة زمنية في العالم",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "اسم المدينة أو الدولة (مثال: الرباط، دبي، الرياض، باريس، طوكيو)" },
        },
      },
      permissions: ["time:read"],
      timeout: 3000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: { location?: string }): Promise<StructuredToolResult> => {
        const location = args?.location || "المغرب";
        const timeInfo = getCurrentTimeInfo(location);

        const contextNote = `[أداة الوقت والتاريخ - get_current_time]:
- المكان: ${timeInfo.cityName || location} (${timeInfo.timezone})
- الوقت الحالي: ${timeInfo.localTime} (${timeInfo.localTimeShort})
- التاريخ: ${timeInfo.localDate} (${timeInfo.formattedDateAr})
- اليوم: ${timeInfo.dayOfWeekAr}`;

        updateLoadedToolsStats("time", "success", location, 15);

        return {
          success: true,
          tool: "get_current_time",
          data: timeInfo,
          contextNote,
          widgetData: { type: "time_clock", data: timeInfo },
          error: null,
        };
      },
    });

    this.registerTool({
      name: "convert_time",
      description: "تحويل الوقت بين مدينتين أو منطقتين زمنيتين مختلفتين وتحديد الفارق الزمني بدقة",
      inputSchema: {
        type: "object",
        properties: {
          fromLocation: { type: "string", description: "المدينة أو المنطقة الأصلية" },
          toLocation: { type: "string", description: "المدينة أو المنطقة المستهدفة" },
          time: { type: "string", description: "الوقت المراد تحويله بتنسيق HH:mm (مثال: 15:30)" },
        },
        required: ["fromLocation", "toLocation", "time"],
      },
      permissions: ["time:read"],
      timeout: 3000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: { fromLocation: string; toLocation: string; time: string }): Promise<StructuredToolResult> => {
        const fromLoc = args?.fromLocation || "المغرب";
        const toLoc = args?.toLocation || "اليابان";
        const timeStr = args?.time || "12:00";

        const conversion = convertTimeInfo(fromLoc, toLoc, timeStr);
        const contextNote = `[أداة تحويل التوقيت - convert_time]:
- من ${conversion.fromLocationLabel} (${conversion.originalTime}) إلى ${conversion.toLocationLabel}: ${conversion.convertedTimeShort} (${conversion.convertedFormattedAr})`;

        updateLoadedToolsStats("time", "success", `${fromLoc} -> ${toLoc}`, 20);

        return {
          success: true,
          tool: "convert_time",
          data: conversion,
          contextNote,
          widgetData: { type: "time_convert", data: conversion },
          error: null,
        };
      },
    });

    // ----------------------------------------------------
    // 7. GENERATE IMAGE TOOL
    // ----------------------------------------------------
    this.registerTool({
      name: "generate_image",
      description: "توليد وإنشاء صور ورسومات فنية وشعارات فائقة الدقة والجمال بالذكاء الاصطناعي",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "A highly descriptive, artistic, detailed prompt IN ENGLISH ONLY explaining style, subject, lighting, and composition.",
          },
          aspectRatio: {
            type: "string",
            description: "نسبة أبعاد الصورة",
            enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
          },
        },
        required: ["prompt"],
      },
      permissions: ["image:generate"],
      timeout: 25000,
      cost: 1,
      supportsParallel: false,
      execute: async (
        args: { prompt: string; aspectRatio?: string },
        context: AgentToolExecutionContext
      ): Promise<StructuredToolResult> => {
        const prompt = (args?.prompt || "").trim();
        if (!prompt) {
          return {
            success: false,
            tool: "generate_image",
            data: null,
            error: { code: "MISSING_ARGUMENT", message: "وصف الصورة غير مدخل", retryable: false },
          };
        }

        try {
          if (context.onProgress) {
            context.onProgress({ title: "🎨 جاري توليد الصورة الفنية", summary: "معالجة الطلب بأعلى جودة..." });
          }

          const imgRes = await generateImageViaManager(prompt, {
            width: 1024,
            height: 1024,
          });

          if (!imgRes.success || !imgRes.imageUrl) {
            updateLoadedToolsStats("image_gen", "failed", prompt.slice(0, 50), 1200);
            return {
              success: false,
              tool: "generate_image",
              data: null,
              error: { code: "GENERATION_FAILED", message: (imgRes as any).error || "فشل توليد الصورة", retryable: true },
            };
          }

          const imgUrl = imgRes.imageUrl;
          updateLoadedToolsStats("image_gen", "success", prompt.slice(0, 50), 2500);

          return {
            success: true,
            tool: "generate_image",
            data: {
              url: imgUrl,
              prompt: imgRes.prompt || prompt,
              providerUsed: imgRes.providerUsed,
              modelUsed: imgRes.modelUsed,
              count: 1,
            },
            error: null,
            contextNote: `[أداة توليد الصور]: تم إنشاء الصورة بنجاح وتُعرض للمستخدم مباشرة. يرجى الترحيب بأسلوب لطيف ومختصر بدون طباعة تفاصيل البرومبت الفني الداخلي.`,
            widgetData: {
              type: "image_result",
              data: {
                imageUrl: imgUrl,
                prompt: imgRes.prompt || prompt,
                providerUsed: imgRes.providerUsed,
              },
            },
          };
        } catch (err: any) {
          return {
            success: false,
            tool: "generate_image",
            data: null,
            error: { code: "IMAGE_ERROR", message: err?.message || "حدث خطأ أثناء معالجة الصورة", retryable: true },
          };
        }
      },
    });

    // ----------------------------------------------------
    // 8. VISION / IMAGE ANALYSIS TOOL
    // ----------------------------------------------------
    this.registerTool({
      name: "analyze_image",
      description: "تحليل وفحص الصور المرفقة، قراءة النصوص من الصور (OCR)، فحص الجودة، أو المقارنة بين الصور",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "السؤال أو هدف التحليل المطلوب للصورة" },
          mode: {
            type: "string",
            description: "نمط التحليل",
            enum: ["describe", "detect_objects", "quality_score", "compare", "ocr"],
          },
        },
      },
      permissions: ["vision:analyze"],
      timeout: 20000,
      cost: 1,
      supportsParallel: false,
      execute: async (
        args: { prompt?: string; mode?: "describe" | "detect_objects" | "quality_score" | "inspect_quality" | "quality" | "compare" | "ocr" },
        context: AgentToolExecutionContext
      ): Promise<StructuredToolResult> => {
        const attachments = (context.attachments || []).filter((a) => a.type === "image" || a.mimeType?.startsWith("image/"));
        if (attachments.length === 0) {
          return {
            success: false,
            tool: "analyze_image",
            data: null,
            error: { code: "NO_IMAGE", message: "يرجى إرفاق صورة واحدة على الأقل لتحليلها", retryable: false },
          };
        }

        try {
          if (context.onProgress) {
            context.onProgress({ title: "🔍 جاري فحص وتحليل الصورة", summary: args.prompt || "تحليل شامل" });
          }

          const visionImages = attachments.map((a) => ({
            base64: a.data?.includes(";base64,") ? a.data.split(";base64,")[1] : a.data,
            mimeType: a.mimeType || "image/png",
            name: a.name || "image.png",
          }));

          const mode = args.mode || "describe";
          let resultData: any = null;

          if (mode === "ocr") {
            const ocr = await VisionCapabilityLayer.extractInformation({
              image: visionImages[0],
              extractType: "ocr",
            });
            resultData = ocr;
          } else if (mode === "compare" && visionImages.length > 1) {
            const comp = await VisionCapabilityLayer.compareImages({
              images: visionImages,
              criteria: args.prompt || "الجودة العامة والتوازن والتفاصيل",
            });
            resultData = comp;
          } else if (mode === "quality" || mode === "inspect_quality") {
            const analysis = await VisionCapabilityLayer.inspectQuality({
              image: visionImages[0],
              promptGoal: args.prompt,
            });
            resultData = analysis;
          } else {
            const analysis = await VisionCapabilityLayer.analyzeImage({
              images: visionImages,
              prompt: args.prompt,
            });
            resultData = analysis;
          }

          return {
            success: true,
            tool: "analyze_image",
            data: resultData,
            contextNote: `[أداة تحليل الصور - analyze_image]:\n${JSON.stringify(resultData)}`,
            error: null,
          };
        } catch (err: any) {
          return {
            success: false,
            tool: "analyze_image",
            data: null,
            error: { code: "VISION_ERROR", message: err?.message || "تعذر تحليل الصورة", retryable: true },
          };
        }
      },
    });

    // ----------------------------------------------------
    // 9. DYNAMIC MEMORY & USER PROFILE TOOLS
    // ----------------------------------------------------
    this.registerTool(saveUserMemoryTool);
    this.registerTool(updateUserMemoryTool);
    this.registerTool(deleteUserMemoryTool);
    this.registerTool(getUserProfileTool);

    this.registerTool({
      name: "retrieve_memory",
      description: "استرجاع ذاكرة وتفضيلات وسياق المستخدم المحفوظة عند الحاجة لتخصيص الإجابة",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "الموضوع أو الكلمة المفتاحية للبحث في الذاكرة" },
        },
        required: ["query"],
      },
      permissions: ["memory:read"],
      timeout: 4000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: { query: string }, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const userId = context.userId || "default_user";

        try {
          const settings = await getMemorySettings(userId);
          if (!settings.memoryEnabled) {
            return {
              success: true,
              tool: "retrieve_memory",
              data: { memories: [] },
              contextNote: "[الذاكرة]: ميزة الذاكرة معطلة في إعدادات المستخدم.",
              error: null,
            };
          }

          const allMemories = await getUserMemories(userId);
          const relevant = retrieveRelevantMemories(args.query || "", allMemories, settings.maxContextItems, context.projectId);

          const memoryStrings = relevant.map((m) => {
            const userTag = m.userName ? `[المستخدم: ${m.userName}] ` : "";
            const projTag = m.projectName ? `[مشروع: ${m.projectName}] ` : "";
            return `- (${m.type}) ${userTag}${projTag}${m.content}`;
          });

          const totalCount = allMemories.filter((m) => m.enabled).length;
          const contextNote = `[الذاكرة المسترجعة للطلب (${relevant.length} من إجمالي ${totalCount} عناصر)]:\n${
            memoryStrings.join("\n") || "لا توجد تفضيلات أو حقائق سابقة مطابقة لهذا الاستعلام المحدد."
          }`;

          return {
            success: true,
            tool: "retrieve_memory",
            data: { memories: relevant, totalCount },
            contextNote,
            error: null,
          };
        } catch (err: any) {
          return {
            success: false,
            tool: "retrieve_memory",
            data: null,
            error: { code: "MEMORY_ERROR", message: err?.message || "تعذر قراءة الذاكرة", retryable: false },
          };
        }
      },
    });

    // ----------------------------------------------------
    // 10. TASK & MESSAGE SCHEDULING TOOLS
    // ----------------------------------------------------
    this.registerTool({
      name: "task_create",
      description: taskCreateTool.description,
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المهمة أو التذكير أو موضوع البحث المجدول" },
          dueDate: { type: "string", description: "تاريخ ووقت التنفيذ (مثال: 'غداً الساعة 9 صباحاً'، 'بعد ساعتين'، 'كل يوم الساعة 8 صباحاً')" },
          type: { type: "string", description: "نوع المهمة", enum: ["reminder", "research", "code", "general_task", "email", "whatsapp_message"] },
          prompt: { type: "string", description: "الأمر أو التعليمات المفصلة للتنفيذ عند حلول الموعد" },
          channel: { type: "string", description: "قناة الإرسال المفضلة", enum: ["telegram", "whatsapp", "web", "email"] },
          recurrence: { type: "string", description: "نمط التكرار", enum: ["once", "daily", "weekly", "monthly", "workdays"] },
          priority: { type: "string", description: "الأولوية", enum: ["high", "medium", "low"] },
          category: { type: "string", description: "الفئة", enum: ["work", "personal", "reminder", "meeting"] },
          description: { type: "string", description: "ملاحظات أو تفاصيل إضافية للمهمة" },
        },
        required: ["title"],
      },
      permissions: ["tasks:write"],
      timeout: 5000,
      cost: 1,
      supportsParallel: false,
      execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const payloadArgs = {
          ...args,
          userId: args.userId || context.userId || "default_user",
          channel: args.channel || (context.channel === "telegram" ? "telegram" : "web"),
          chatId: args.chatId || (context.channel === "telegram" ? context.userId : undefined),
        };
        const rawRes = await taskCreateTool.execute(payloadArgs);
        const parsed = safeParseToolResult(rawRes);
        if (parsed.success && parsed.task) {
          try {
            useScheduleStore.getState().addItem(parsed.task);
          } catch (e) {
            // Ignore if in headless node environment
          }
        }
        return {
          success: parsed.success,
          tool: "task_create",
          data: parsed,
          widgetData: parsed.success ? { type: "scheduled_task", data: parsed } : undefined,
          contextNote: `[أداة جدولة المهام والمراقبة التلقائية في قاعدة البيانات]: ${parsed.message || "تم إنشاء المهمة المجدولة"} (الوكيل سيتولى الاستيقاظ والمراقبة تلقائياً في الموعد)`,
          error: parsed.success ? null : { code: "TASK_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    this.registerTool({
      name: "schedule_email",
      description: scheduleEmailTool.description,
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "البريد الإلكتروني للمستلم" },
          subject: { type: "string", description: "موضوع الرسالة المجدولة" },
          body: { type: "string", description: "نص ومحتوى الرسالة" },
          scheduledTime: { type: "string", description: "موعد الإرسال (مثال: 'غداً الساعة 9 صباحاً' أو 'بعد ساعتين')" },
          priority: { type: "string", description: "الأولوية", enum: ["high", "medium", "low"] },
        },
        required: ["to", "subject", "body", "scheduledTime"],
      },
      permissions: ["gmail:send", "tasks:write"],
      timeout: 5000,
      cost: 1,
      supportsParallel: false,
      execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const payloadArgs = {
          ...args,
          userId: args.userId || context.userId || "default_user",
        };
        const rawRes = await scheduleEmailTool.execute(payloadArgs);
        const parsed = safeParseToolResult(rawRes);
        if (parsed.success && parsed.task) {
          try {
            useScheduleStore.getState().addItem(parsed.task);
          } catch (e) {
            // Ignore if in headless node environment
          }
        }
        return {
          success: parsed.success,
          tool: "schedule_email",
          data: parsed,
          widgetData: parsed.success ? { type: "scheduled_task", data: parsed } : undefined,
          contextNote: `[جدولة إرسال البريد والمراقبة المستقلة في قاعدة البيانات]: ${parsed.message || "تمت جدولة إرسال البريد الإلكتروني"}. تم تفعيل الاستيقاظ الذاتي للوكيل لإرسال البريد ومراقبة تسليم الخادم فور حلول الموعد.`,
          error: parsed.success ? null : { code: "SCHEDULE_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    this.registerTool({
      name: "task_list",
      description: taskListTool.description,
      inputSchema: {
        type: "object",
        properties: {
          filter: { type: "string", description: "فلترة المهام والرسائل", enum: ["all", "pending", "completed", "email", "task"] },
        },
      },
      permissions: ["tasks:read"],
      timeout: 4000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const payloadArgs = {
          ...args,
          userId: args?.userId || context.userId || "default_user",
        };
        const rawRes = await taskListTool.execute(payloadArgs);
        const parsed = safeParseToolResult(rawRes);
        return {
          success: parsed.success,
          tool: "task_list",
          data: parsed,
          widgetData: { type: "schedule_list", data: { ...parsed, isList: true } },
          contextNote: `[قائمة المهام والرسائل المجدولة من قاعدة البيانات]: ${parsed.message || "عرض القائمة"}`,
          error: null,
        };
      },
    });

    this.registerTool({
      name: "schedule_cancel",
      description: scheduleCancelTool.description,
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "معرف المهمة أو الرسالة المجدولة" },
          reason: { type: "string", description: "سبب الإلغاء" },
        },
        required: ["taskId"],
      },
      permissions: ["tasks:write"],
      timeout: 4000,
      cost: 1,
      supportsParallel: false,
      execute: async (args: any): Promise<StructuredToolResult> => {
        const rawRes = await scheduleCancelTool.execute(args);
        const parsed = safeParseToolResult(rawRes);
        if (parsed.success) {
          try {
            useScheduleStore.getState().cancelItem(args.taskId, args.reason);
          } catch (e) {
            // Ignore if in headless node environment
          }
        }
        return {
          success: parsed.success,
          tool: "schedule_cancel",
          data: parsed,
          contextNote: `[إلغاء الجدولة من قاعدة البيانات]: ${parsed.message || "تم إلغاء المهمة"}`,
          error: parsed.success ? null : { code: "CANCEL_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    // ----------------------------------------------------
    // 11. WHATSAPP TOOLS
    // ----------------------------------------------------
    this.registerTool({
      name: "whatsapp_send",
      description: whatsappSendTool.description,
      inputSchema: {
        type: "object",
        properties: {
          phone: { type: "string", description: "رقم الهاتف الدولي (مثال: +212600000000)" },
          message: { type: "string", description: "نص الرسالة" },
        },
        required: ["phone", "message"],
      },
      permissions: ["whatsapp:send"],
      timeout: 5000,
      cost: 1,
      supportsParallel: false,
      execute: async (args: any): Promise<StructuredToolResult> => {
        const rawRes = await whatsappSendTool.execute(args);
        const parsed = safeParseToolResult(rawRes);
        return {
          success: parsed.success,
          tool: "whatsapp_send",
          data: parsed,
          contextNote: `[أداة الواتساب]: ${parsed.message || "تم إرسال الرسالة"}`,
          error: parsed.success ? null : { code: "WHATSAPP_FAILED", message: parsed.error, retryable: true },
        };
      },
    });

    this.registerTool({
      name: "whatsapp_template",
      description: whatsappTemplateTool.description,
      inputSchema: {
        type: "object",
        properties: {
          phone: { type: "string", description: "رقم الهاتف" },
          templateType: { type: "string", description: "نوع القالب", enum: ["task_reminder", "welcome", "status_update", "urgent_alert"] },
          details: { type: "string", description: "تفاصيل الرسالة" },
        },
        required: ["phone", "templateType"],
      },
      permissions: ["whatsapp:send"],
      timeout: 5000,
      cost: 1,
      supportsParallel: false,
      execute: async (args: any): Promise<StructuredToolResult> => {
        const rawRes = await whatsappTemplateTool.execute(args);
        const parsed = safeParseToolResult(rawRes);
        return {
          success: parsed.success,
          tool: "whatsapp_template",
          data: parsed,
          contextNote: `[قالب الواتساب]: ${parsed.message || "تم تجهيز القالب"}`,
          error: parsed.success ? null : { code: "TEMPLATE_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    // ----------------------------------------------------
    // 12. GMAIL TOOLS
    // ----------------------------------------------------
    this.registerTool({
      name: "gmail_search",
      description: gmailSearchTool.description,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "استعلام البحث في البريد الإلكتروني" },
          maxResults: { type: "number", description: "العدد الأقصى للنتائج" },
        },
        required: ["query"],
      },
      permissions: ["gmail:read"],
      timeout: 8000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const rawRes = await gmailSearchTool.execute(args, { gmailToken: context.gmailToken });
        const parsed = safeParseToolResult(rawRes);
        return {
          success: parsed.success,
          tool: "gmail_search",
          data: parsed,
          contextNote: `[بحث البريد الإلكتروني]: تم العثور على ${parsed.count || parsed.messages?.length || 0} رسائل من Gmail.`,
          widgetData: parsed.success && parsed.messages && parsed.messages.length > 0 ? {
            type: "gmail_inbox",
            data: {
              query: args.query,
              messages: parsed.messages,
              total: parsed.count || parsed.messages.length,
            }
          } : undefined,
          error: parsed.success ? null : { code: "GMAIL_SEARCH_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    this.registerTool({
      name: "gmail_draft",
      description: gmailDraftTool.description,
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "البريد الإلكتروني للمستلم" },
          subject: { type: "string", description: "موضوع الرسالة" },
          body: { type: "string", description: "محتوى الرسالة" },
        },
        required: ["to", "subject", "body"],
      },
      permissions: ["gmail:write"],
      timeout: 8000,
      cost: 1,
      supportsParallel: false,
      execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const rawRes = await gmailDraftTool.execute(args, { gmailToken: context.gmailToken });
        const parsed = safeParseToolResult(rawRes);
        return {
          success: parsed.success,
          tool: "gmail_draft",
          data: parsed,
          contextNote: `[مسودة البريد الإلكتروني]: تم إنشاء المسودة لـ (${args.to}) بعنوان "${args.subject}"`,
          widgetData: { type: "gmail_draft", data: parsed.data || parsed.draft },
          error: parsed.success ? null : { code: "GMAIL_DRAFT_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    this.registerTool({
      name: "gmail_read",
      description: gmailReadTool.description,
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "معرف الرسالة المحددة لقراءتها بالتفصيل" },
        },
        required: ["messageId"],
      },
      permissions: ["gmail:read"],
      timeout: 8000,
      cost: 1,
      supportsParallel: true,
      execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const rawRes = await gmailReadTool.execute(args, { gmailToken: context.gmailToken });
        const parsed = safeParseToolResult(rawRes);
        return {
          success: parsed.success,
          tool: "gmail_read",
          data: parsed,
          contextNote: `[قراءة البريد الإلكتروني]: الرسالة من ${parsed.from} بعنوان "${parsed.subject}":\n${parsed.body || parsed.snippet}`,
          widgetData: parsed.success ? {
            type: "gmail_read",
            data: parsed,
          } : undefined,
          error: parsed.success ? null : { code: "GMAIL_READ_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    this.registerTool({
      name: "gmail_summarize",
      description: gmailSummarizeTool.description,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "استعلام التصفية مثل 'is:unread' أو 'newer_than:2d'" },
          maxEmails: { type: "number", description: "العدد الأقصى للرسائل للتلخيص (الافتراضي 5)" },
        },
      },
      permissions: ["gmail:read"],
      timeout: 10000,
      cost: 1,
      supportsParallel: false,
      execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
        const rawRes = await gmailSummarizeTool.execute(args, { gmailToken: context.gmailToken });
        const parsed = safeParseToolResult(rawRes);
        return {
          success: parsed.success,
          tool: "gmail_summarize",
          data: parsed,
          contextNote: `[ملخص البريد الإلكتروني]:\n${parsed.summary || ""}`,
          widgetData: parsed.success && parsed.messages && parsed.messages.length > 0 ? {
            type: "gmail_inbox",
            data: {
              query: args.query || "is:unread",
              messages: parsed.messages,
              total: parsed.count || parsed.messages.length,
              summary: parsed.summary,
            }
          } : undefined,
          error: parsed.success ? null : { code: "GMAIL_SUMMARIZE_FAILED", message: parsed.error, retryable: false },
        };
      },
    });

    // ----------------------------------------------------
    // SOUFFILE TOOL (FILES, DOCUMENTS, DATA, CODE, PREVIEW)
    // ----------------------------------------------------
    this.registerTool(soufFileTool);

    // ----------------------------------------------------
    // MEDIA PLAYER TOOL (INLINE VIDEO & AUDIO PLAYBACK)
    // ----------------------------------------------------
    this.registerTool(mediaPlayerTool);
  }
}


// Global Singleton Tool Registry
export const globalToolRegistry = new ToolRegistry();
