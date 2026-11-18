import { NextRequest, NextResponse } from "next/server";
import { runAgentRuntime } from "@/lib/agent/agentRuntime";
import { isAgentDecisionPayload } from "@/lib/agent/agentDecisionParser";
import { buildMemoryContext } from "@/lib/memory/contextBuilder";
import { saveUserMemory } from "@/lib/memory/memoryService";
import { buildAgentActivityState } from "@/lib/agent/agentActivityTypes";
import { globalAgentTaskStore } from "@/lib/agent/agentTaskStore";
import { resolveAuthUser } from "@/lib/auth/serverAuth";
import { serverErrorManager, ServerErrorManager } from "@/lib/errors/errorManager";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { inspectRequestBody } from "@/lib/security/wafEngine";
import { extractClientIP } from "@/lib/security/threatEngine";
import {
  recordEfficiencyEvent,
  estimateTokens,
  initEfficiencyStoreFromDb,
} from "@/lib/efficiency";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "الرجاء إرسال محتوى طلب صالح (JSON غير صالح)" }, { status: 400 });
    }

    // SoufShield Model Armor & Perimeter Inspection (Google SAIF & Anthropic Guardrail Standards)
    const clientIp = extractClientIP(req.headers);
    const bodyInspection = inspectRequestBody(body, clientIp, "/api/chat");
    if (!bodyInspection.safe && bodyInspection.violation) {
      return NextResponse.json(
        {
          error: bodyInspection.violation.sample || "طلب مرفوض: تم رصد محاولة لتجاوز موجهات الأمان والدستور الأخلاقي للنموذج (Model Armor Guardrail). يرجى توجيه استفسارك بشكل سليم.",
          code: "MODEL_ARMOR_GUARDRAIL_BLOCKED",
          rule: bodyInspection.violation.rule,
          vector: bodyInspection.violation.vector,
        },
        { status: 400 }
      );
    }
    const {
      modelId = "core",
      prompt,
      messages = [],
      webSearchEnabled = false,
      activeTools = [],
      attachments = [],
      suggestionsConfig,
      userId,
      projectId,
      gmailToken,
      taskId,
      resumeTaskId,
      userResponse,
      maxStepsTier = "auto",
      behaviorContext,
      sessionId,
      isTelegramContinuation,
      telegramMeta,
    } = body;

    if (!prompt && !userResponse) {
      return NextResponse.json({ error: "الرجاء كتابة السؤال أو الطلب" }, { status: 400 });
    }

    // Resolve robust user identity and enforce authentication
    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      return NextResponse.json(
        { 
          error: "يجب عليك تسجيل الدخول أولاً لإرسال الرسائل والتفاعل مع الذكاء الاصطناعي.",
          code: "AUTH_REQUIRED" 
        }, 
        { status: 401 }
      );
    }

    const effectiveUserId = authUser.id;

    const origin = req.nextUrl.origin || "http://localhost:3000";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;
        let heartbeatInterval: NodeJS.Timeout | null = null;

        function safeClose() {
          if (isClosed) return;
          isClosed = true;
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
          try {
            controller.close();
          } catch {}
        }

        function sendEvent(type: string, data: any) {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
          } catch (e) {
            safeClose();
          }
        }

        if (req.signal) {
          req.signal.addEventListener("abort", () => {
            safeClose();
          });
        }

        heartbeatInterval = setInterval(() => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`:keepalive ${Date.now()}\n\n`));
          } catch {
            safeClose();
          }
        }, 15000);

        const startTime = Date.now();
        await initEfficiencyStoreFromDb();

        try {
          if (req.signal.aborted) {
            safeClose();
            return;
          }
          const queryText = prompt || userResponse || "";

          // 0. SoufAI Memory Engine Context Retrieval
          let memoryContextBlock = "";
          let retrievedMemories: any[] = [];
          let candidateNewMemory: any = null;

          if (queryText && !req.signal.aborted) {
            try {
              const memoryResult = await buildMemoryContext({
                userId: effectiveUserId,
                prompt: queryText,
                projectId,
              });
              memoryContextBlock = memoryResult.contextBlock;
              retrievedMemories = memoryResult.retrievedMemories;
              candidateNewMemory = memoryResult.candidateNewMemory;

              // Auto-persist all extracted memory facts without prompting the user
              if (candidateNewMemory && candidateNewMemory.content) {
                try {
                  await saveUserMemory(effectiveUserId, {
                    type: candidateNewMemory.type,
                    content: candidateNewMemory.content,
                    userName: candidateNewMemory.userName,
                    importance: candidateNewMemory.importance,
                    confidence: candidateNewMemory.confidence,
                    source: "auto",
                  });
                } catch {}
              }
            } catch (memErr) {
              console.warn("Memory context builder error:", memErr);
            }
          }

          let finalPrompt = prompt || userResponse || "";

          // Omnichannel continuity: Recognize if conversation originated from Telegram
          const isFromTelegram = Boolean(
            isTelegramContinuation ||
            (sessionId && typeof sessionId === "string" && sessionId.startsWith("tg_")) ||
            (Array.isArray(messages) && messages.some((m: any) => 
              m?.source === "telegram" || 
              m?.channel === "telegram" || 
              (typeof m?.id === "string" && m.id.startsWith("tg_msg_"))
            ))
          );

          if (isFromTelegram) {
            const senderName = telegramMeta?.sender || telegramMeta?.username || authUser?.name || "المستخدم";
            const telegramContextBlock = `[سياق استمرارية المحادثة عبر المنصات (Omnichannel Telegram -> Web Continuity)]:
- تنبيه فائق الأهمية للوكيل: بدأ هذا المستخدم (${senderName}) هذه المحادثة معك أصلاً عبر تطبيق تيليجرام (Telegram Bot)، وها هو الآن يكمل نفس المحادثة معك مباشرة من داخل منصة الويب (SoufAI Web Platform).
- أنت نفس الوكيل والمساعد الذكي الموحد المشترك بين تيليجرام والمنصة.
- الرسائل السابقة في سجل المحادثة المرفق هي ما دار بينكما في تيليجرام.
- تعامل معه بذكاء ووعي كامل: أظهر له أنك تدرك وتتذكر تماماً كل ما قاله وناقشه معك في تيليجرام.
- إذا سأل عما إذا كنت تتذكر ما دار أو ما ناقشتموه في تيليجرام، أو أشار إلى أنه انتقل للمنصة، رحب به وأكد له أنك تتابع معه بسلاسة وبنفس سياق الحوار دون انقطاع.
- واصل الإجابة بدقة باللغة العربية مع الاستفادة من إمكانيات واجهة المنصة (تنسيق ماركداون غني، جداول، أكواد برمجية، أدوات).`;

            finalPrompt = `${telegramContextBlock}\n\n${finalPrompt}`;
          }

          if (behaviorContext) {
            finalPrompt = `[سياق تخصيص السلوك والأدوات المفضلة للمستخدم (SoufBehavior)]:\n${behaviorContext}\n\n${finalPrompt}`;
          }
          if (memoryContextBlock) {
            finalPrompt = `${memoryContextBlock}\n\n${finalPrompt}`;
          }

          // Fix 6: Limit conversation history sliding window to prevent token explosion
          const MAX_HISTORY_MESSAGES = 16;
          const trimmedMessages = Array.isArray(messages) ? messages.slice(-MAX_HISTORY_MESSAGES) : [];

          if (req.signal.aborted) {
            safeClose();
            return;
          }

          // Execute Multi-step Real Agent Runtime Engine
          const rawUserQuery = prompt || userResponse || "";
          const agentResult = await runAgentRuntime({
            modelId,
            prompt: finalPrompt,
            rawPrompt: rawUserQuery,
            messages: trimmedMessages,
            webSearchEnabled,
            activeTools,
            attachments,
            suggestionsConfig,
            origin,
            userId: effectiveUserId,
            projectId,
            gmailToken,
            taskId,
            resumeTaskId,
            userResponse,
            maxStepsTier,
            signal: req.signal,
            onToken: (delta) => {
              sendEvent("token", { delta });
            },
            onActivityEvent: (event, state) => {
              sendEvent("activity", { event, state });
            },
          });

          // Sync turn back to Telegram session if this was a Telegram-originated conversation
          if (isFromTelegram && sessionId) {
            try {
              await telegramManager.ensureInitialized();
              telegramManager.recordWebTurnOnTelegramSession(
                sessionId,
                prompt || userResponse || "",
                agentResult.text || "",
                effectiveUserId
              );
              await telegramManager.flushPendingWrites();
            } catch (tgSyncErr) {
              console.warn("Telegram turn sync error:", tgSyncErr);
            }
          }

          const activityState = agentResult.activityState || buildAgentActivityState(
            [],
            agentResult.sources,
            agentResult.queriesUsed,
            agentResult.pagesRead,
            agentResult.status === "waiting_for_user" ? "pending" : "completed"
          );

          const responseTextCandidate =
            agentResult.text || (agentResult as any).finalAnswer || agentResult.state?.finalAnswer || "";
          const responseText = isAgentDecisionPayload(responseTextCandidate)
            ? ""
            : responseTextCandidate.trim();
          if (
            !responseText &&
            agentResult.status !== "waiting_for_user" &&
            agentResult.status !== "cancelled"
          ) {
            console.error("[Chat API] Agent completed without a usable final response.");
            sendEvent("error", { message: "تعذر على الوكيل إنشاء إجابة نهائية صالحة. أعد المحاولة." });
            safeClose();
            return;
          }
          const durationMs = Date.now() - startTime;
          const estimatedTokens = estimateTokens(finalPrompt) + estimateTokens(responseText);

          // Extract tools executed in this turn
          const toolsExecuted: string[] = [];
          if (agentResult.sources && agentResult.sources.length > 0) toolsExecuted.push("web_search");
          if (agentResult.pagesRead && agentResult.pagesRead.length > 0) toolsExecuted.push("open_page");
          if (agentResult.agentSteps && Array.isArray(agentResult.agentSteps)) {
            agentResult.agentSteps.forEach((s: string) => {
              if (s.includes("حساب") || s.includes("حاسبة")) toolsExecuted.push("calculator");
              if (s.includes("ملف") || s.includes("مستند")) toolsExecuted.push("souf_file");
              if (s.includes("صورة")) toolsExecuted.push("generate_image");
              if (s.includes("كود") || s.includes("برمج")) toolsExecuted.push("coding");
              if (s.includes("وقت") || s.includes("ساعة")) toolsExecuted.push("get_current_time");
            });
          }
          const uniqueToolsExecuted = Array.from(new Set(toolsExecuted));

          // Real Telemetry: Record event in AI Efficiency Store
          recordEfficiencyEvent({
            type: "api_call",
            promptSummary: finalPrompt.slice(0, 160),
            modelUsed: agentResult.modelUsed || modelId,
            providerUsed: agentResult.providerUsed || "SoufAI Real Agent Runtime",
            tokensEstimated: estimatedTokens,
            tokensSaved: 0,
            latencyMs: durationMs,
            toolsUsed: uniqueToolsExecuted,
          });

          sendEvent("complete", {
            taskId: agentResult.taskId,
            status: agentResult.status,
            text: responseText,
            finalAnswer: responseText,
            modelUsed: agentResult.modelUsed || modelId,
            providerUsed: agentResult.providerUsed || "SoufAI Real Agent Runtime",
            webSearchUsed: agentResult.sources.length > 0,
            sources: agentResult.sources,
            searchCount: agentResult.sources.length,
            reasoningMode: activeTools?.includes("deep_thinking")
              ? "deep_thinking"
              : activeTools?.includes("deep_analysis")
              ? "deep_analysis"
              : undefined,
            suggestions: agentResult.suggestions || [],
            questionTitle: agentResult.questionTitle,
            queriesUsed: agentResult.queriesUsed,
            pagesRead: agentResult.pagesRead,
            activityState,
            usedMemories: retrievedMemories,
            memoryUsed: retrievedMemories.length > 0,
            candidateNewMemory,
            widgetData: agentResult.widgetData || null,
            deductCredits: true,
          });
          safeClose();
        } catch (err: any) {
          if (req.signal.aborted) {
            const cancelledState = buildAgentActivityState([], [], [], [], "cancelled");
            sendEvent("complete", {
              status: "cancelled",
              text: "",
              finalAnswer: "",
              agentSteps: [],
              activityState: cancelledState,
            });
            safeClose();
            return;
          }
          console.error("Agent execution error in route:", err);
          serverErrorManager.recordError({
            title: "تعثر تنفيذ طلب المحادثة الذكي (Chat Agent Runtime Error)",
            message: err?.message || "حدث خطأ غير متوقع أثناء تشغيل الوكيل الذكي للدردشة.",
            category: "ai_engine",
            severity: "high",
            endpoint: "/api/chat",
            stackTrace: err?.stack,
          });
          const sanitizedMsg = ServerErrorManager.sanitizeUserMessage(err);
          sendEvent("error", { message: sanitizedMsg });
          safeClose();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Chat route error:", err);
    serverErrorManager.recordError({
      title: "خطأ عام في مسار الدردشة (Chat API Route Error)",
      message: err?.message || "فشل استلام ومعالجة طلب المحادثة.",
      category: "ai_engine",
      severity: "critical",
      endpoint: "/api/chat",
      statusCode: 500,
      stackTrace: err?.stack,
    });
    return NextResponse.json({ error: "فشل استلام الطلب ومعالجته" }, { status: 500 });
  }
}
