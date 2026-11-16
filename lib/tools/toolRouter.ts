/**
 * SoufAI Extensible AI Tool Router Engine
 * Standardized execution pipeline for built-in AI tools (Timezone, Currency, Math, System Stats, Weather, etc.)
 */

import { getCurrentTimeInfo, convertTimeInfo } from "@/lib/tools/timeEngine";
import { generateImageViaManager } from "@/lib/providers/imageProviderManager";
import { GoogleGenAI, Type } from "@google/genai";
import { executeRoutedPrompt } from "@/lib/router";

export interface ToolExecutionResult {
  executed: boolean;
  toolName?: string;
  contextNote?: string;
  agentSteps?: string[];
  data?: any;
  widgetData?: {
    type: "time_clock" | "time_ambiguous" | "time_convert" | "calculator" | "system_stats" | "image_result";
    data: any;
  };
  shouldSkipWebSearch?: boolean;
}

/**
 * Detects and executes appropriate internal SoufAI tool based on query patterns
 */
export async function routeAndExecuteTools(
  prompt: string,
  origin: string,
  modelId: "spark" | "core" | "pro" | "ultra" | string = "core",
  attachments: any[] = []
): Promise<ToolExecutionResult> {
  const cleanPrompt = prompt.trim();
  const imageAttachments = (attachments || []).filter((a) => a.type === "image" || (a.mimeType && a.mimeType.startsWith("image/")));

  // --- 0. MULTIMODAL VISION SYSTEM TRIGGER ---
  if (imageAttachments.length > 0 || /صورة|رسم|تصميم|عدل|عدّل|حلل|تحليل|قارن|مقارنة|استخرج|ocr|image|picture|draw|edit/i.test(cleanPrompt)) {
    try {
      const { ImageRouterAgent } = await import("@/lib/vision/imageRouter");
      const visionImages = imageAttachments.map((att, idx) => ({
        id: att.id || `img_${idx + 1}`,
        url: att.url || att.data,
        base64: att.data,
        mimeType: att.mimeType,
        name: att.name,
      }));

      const decision = await ImageRouterAgent.detectIntent(cleanPrompt, visionImages);

      // If there is image attachment OR clear image intent
      if (imageAttachments.length > 0 || decision.confidence > 0.85) {
        const pipelineRes = await ImageRouterAgent.processRequest(cleanPrompt, visionImages);

        if (pipelineRes.success) {
          return {
            executed: true,
            toolName: `vision_${decision.intent.toLowerCase()}`,
            contextNote: `[نظام الذكاء البصري المتعدد الوسائط - Vision Capability Layer]:
- نوع العملية: ${decision.intent}
- المحرك المستخدم: ${pipelineRes.modelUsed || "Vision Engine"} (${pipelineRes.providerUsed || "SoufTools"})
- النتيجة المبسطة: ${pipelineRes.primaryOutputText}

[تعليمات الإجابة للمستخدم]:
1. أجب بأسلوب ودود واحترافي باللغة العربية بناءً على النتيجة السابقة.
2. إذا تم إنشاء أو تعديل صورة، أشر إليها بوضوح دون تكرار الروابط النصية المباشرة لأنها معروضة في بطاقة النتائج.`,
            agentSteps: pipelineRes.activities.map((a) => a.title),
            data: pipelineRes,
            widgetData: pipelineRes.widgetData,
            shouldSkipWebSearch: true,
          };
        }
      }
    } catch (vErr) {
      console.warn("Multimodal vision system execution warning:", vErr);
    }
  }

  // --- 1. TIME CONVERSION TRIGGER ---
  const convertTimeRegex = /(?:إذا كانت|اذا كانت|كم تكون|تحويل|تحويل الوقت|من توقيت|فرق الوقت).*(?:الساعة|توقيت|ساعة).*(?:في|بـ|بين).*(?:كم|إلى|الي|ما تكون)/i;
  const isConvertQuery = convertTimeRegex.test(cleanPrompt) || (cleanPrompt.includes("كم الساعة في") && cleanPrompt.includes("إذا كانت"));

  if (isConvertQuery) {
    try {
      const locationMatches = cleanPrompt.match(/(?:في|بـ|من|إلى|الي)\s+([\u0600-\u06FFa-zA-Z\s]+?)(?=\s+(?:كم|في|إلى|الي|الساعة|توقيت|إذا|اذا|\?|\s*$))/gi);

      let fromLoc = "المغرب";
      let toLoc = "اليابان";

      if (locationMatches && locationMatches.length >= 2) {
        fromLoc = locationMatches[0].replace(/^(في|بـ|من|إلى|الي)\s+/i, "").trim();
        toLoc = locationMatches[1].replace(/^(في|بـ|من|إلى|الي)\s+/i, "").trim();
      } else {
        const altMatch = cleanPrompt.match(/في\s+([\u0600-\u06FFa-zA-Z]+).*(?:في|إلى)\s+([\u0600-\u06FFa-zA-Z]+)/i);
        if (altMatch) {
          fromLoc = altMatch[1];
          toLoc = altMatch[2];
        }
      }

      const timeMatch = cleanPrompt.match(/(\d{1,2})(?::(\d{2}))?\s*(ص|م|صباحا|مساء|am|pm)?/i);
      let timeStr = "12:00";
      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = timeMatch[2] || "00";
        const period = (timeMatch[3] || "").toLowerCase();
        if ((period.includes("م") || period.includes("مساء") || period === "pm") && h < 12) {
          h += 12;
        }
        timeStr = `${h.toString().padStart(2, "0")}:${m}`;
      }

      const conversion = convertTimeInfo(fromLoc, toLoc, timeStr);

      const agentSteps = [
        `🕐 جاري تحويل التوقيت من ${conversion.fromLocationLabel} إلى ${conversion.toLocationLabel}...`,
        `🕐 التوقيت المحول في ${conversion.toLocationLabel}: ${conversion.convertedTimeShort}`,
        `📅 التاريخ: ${conversion.convertedFormattedAr}`,
      ];

      const contextNote = `[أداة تحويل الوقت المباشر - convert_time]:
- التوقيت المصدر: ${conversion.originalTime} في ${conversion.fromLocationLabel} (${conversion.fromTimezone} - UTC ${conversion.fromUtcOffset})
- التوقيت المحول في ${conversion.toLocationLabel} (${conversion.toTimezone} - UTC ${conversion.toUtcOffset}): ${conversion.convertedTimeShort} (كامل: ${conversion.convertedTime})
- التاريخ المحول: ${conversion.convertedDate} (${conversion.convertedFormattedAr})
- اليوم: ${conversion.convertedDayOfWeekAr}
- التوقيت الصيفي المصدر (DST): ${conversion.fromIsDST}
- التوقيت الصيفي الهدف (DST): ${conversion.toIsDST}

[تعليمات الإجابة]:
قدم ملخصاً وجيزاً ولطيفاً مع الساعة التفاعلية المعروضة.`;

      return {
        executed: true,
        toolName: "convert_time",
        contextNote,
        agentSteps,
        data: conversion,
        widgetData: {
          type: "time_convert",
          data: conversion,
        },
        shouldSkipWebSearch: true,
      };
    } catch (err) {
      console.warn("Time conversion tool error:", err);
    }
  }

  // --- 2. CURRENT TIME & DATE TRIGGER ---
  const timeQueryRegex = /(?:كم الساعة|الساعة كم|ما الوقت|الوقت الآن|التوقيت في|ما توقيت|كم الوقت|ما التاريخ|تاريخ اليوم|أي يوم اليوم|تاريخ|ما هو تاريخ|ما هو توقيت|توقيت الآن|time in|current time|what date)/i;

  if (timeQueryRegex.test(cleanPrompt)) {
    try {
      let location = "المغرب"; // default fallback

      const locMatch = cleanPrompt.match(/(?:في|بـ|بدولة|بمدينة)\s+([\u0600-\u06FFa-zA-Z\s_]+)/i);
      if (locMatch && locMatch[1]) {
        location = locMatch[1].replace(/[\؟\?\,\.]/g, "").trim();
      } else {
        const stripped = cleanPrompt
          .replace(/(كم الساعة|الساعة كم|ما الوقت|الوقت الآن|التوقيت|ما توقيت|كم الوقت|ما التاريخ|تاريخ اليوم|أي يوم|ما هو تاريخ|اليوم|الآن|في|بـ|\؟|\?)/gi, "")
          .trim();
        if (stripped.length >= 2) {
          location = stripped;
        }
      }

      const timeInfo = getCurrentTimeInfo(location);

      if (timeInfo.isAmbiguous) {
        const agentSteps = [`🕐 جاري تحديد المنطقة الزمنية لـ ${timeInfo.countryName || location}...`];

        const contextNote = `[أداة الوقت والتاريخ - get_current_time]:
تنبيه مهم: الدولة (${timeInfo.countryName}) تحتوي على أكثر من منطقة زمنية مختلفة.
التعليمات الحاسمة: لا تخمن الوقت إطلاقاً! اسأل المستخدم مباشرة مع اختيار إحدى المدن المقترحة في بطاقات الخيارات التفاعلية.`;

        return {
          executed: true,
          toolName: "get_current_time_ambiguous",
          contextNote,
          agentSteps,
          data: timeInfo,
          widgetData: {
            type: "time_ambiguous",
            data: timeInfo,
          },
          shouldSkipWebSearch: true,
        };
      }

      const agentSteps = [
        `🕐 جاري تحديد الوقت والمنطقة الزمنية في ${timeInfo.cityName || location} (${timeInfo.timezone})...`,
        `🕐 الوقت الآن في ${timeInfo.cityName || location}: ${timeInfo.localTimeShort}`,
        `📅 ${timeInfo.formattedDateAr}`,
      ];

      const contextNote = `[أداة الوقت والتاريخ الحقيقي المباشر - get_current_time]:
- المنطقة الزمنية (IANA): ${timeInfo.timezone}
- المدينة / المكان: ${timeInfo.cityName || location}
- الوقت الحقيقي الحالي: ${timeInfo.localTime} (صيغة 24س: ${timeInfo.localTimeShort})
- التاريخ الحقيقي الحالي: ${timeInfo.localDate} (${timeInfo.formattedDateAr})
- اليوم: ${timeInfo.dayOfWeekAr} (${timeInfo.dayOfWeekEn})
- الشهر: ${timeInfo.monthShortAr} (${timeInfo.monthShortEn})
- إزاحة UTC الحالية: ${timeInfo.utcOffset}
- التوقيت الصيفي (DST): ${timeInfo.isDST ? "يعمل حالياً (True)" : "غير مفعل حالياً (False)"}

[تعليمات الإجابة الرسمية للمستخدم]:
1. أجب بإجابة ترحيبية قصيرة جداً (سطر واحد فقط) بالإشارة إلى الساعة الحية المباشرة أدناه.
2. لا تكرر النصوص المعروضة داخل الساعة التفاعلية بطريقة مملة.`;

      return {
        executed: true,
        toolName: "get_current_time",
        contextNote,
        agentSteps,
        data: timeInfo,
        widgetData: {
          type: "time_clock",
          data: timeInfo,
        },
        shouldSkipWebSearch: true,
      };
    } catch (err) {
      console.warn("Get current time tool error:", err);
    }
  }

  // --- 3. MATH / CALCULATOR TRIGGER ---
  const mathRegex = /(?:احسب|حساب|ما ناتج|كم يساوي|رياضيات|احسبلي|\d+\s*[\+\-\*\/]\s*\d+)/i;
  if (mathRegex.test(cleanPrompt)) {
    try {
      const exprMatch = cleanPrompt.match(/[0-9\.\+\-\*\/\(\)\^\%]+(?:\s*[0-9\.\+\-\*\/\(\)\^\%]+)*/);
      if (exprMatch && exprMatch[0].length >= 3) {
        const calcRes = await fetch(`${origin}/api/tools/calculator`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expression: exprMatch[0] }),
        });
        if (calcRes.ok) {
          const calcData = await calcRes.json();
          if (calcData.result !== undefined) {
            return {
              executed: true,
              toolName: "calculator",
              contextNote: `[أداة الحاسبة المباشرة]: ناتج الحساب الرياضي لـ (${calcData.expression}) يساوي: ${calcData.formatted}`,
              agentSteps: [`🔢 أداة الحاسبة الرياضية: تم حساب (${calcData.expression}) = ${calcData.formatted}`],
              data: calcData,
              widgetData: {
                type: "calculator",
                data: calcData,
              },
              shouldSkipWebSearch: true,
            };
          }
        }
      }
    } catch (cErr) {
      console.warn("Calculator tool call warning:", cErr);
    }
  }

  // --- 4. SYSTEM STATS TRIGGER ---
  if (/حالة النظام|فحص النظام|المزودين|مؤشرات الاداء|المحرك/i.test(cleanPrompt)) {
    try {
      const statsRes = await fetch(`${origin}/api/tools/system-stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        return {
          executed: true,
          toolName: "system_stats",
          contextNote: `[أداة فحص النظام المباشرة]: الحالة: ${statsData.status} | قاعدة البيانات (Turso): ${statsData.databaseStatus || statsData.firestoreStatus || "unknown"} | النماذج النشطة: ${statsData.activeModelTiers?.length || 0}`,
          agentSteps: [`⚙️ تم فحص مؤشرات أداء النظام ومزودي الذكاء الاصطناعي بنجاح`],
          data: statsData,
          widgetData: {
            type: "system_stats",
            data: statsData,
          },
          shouldSkipWebSearch: true,
        };
      }
    } catch (stErr) {
      console.warn("System stats tool call warning:", stErr);
    }
  }

  // --- 5. AGENTIC IMAGE GENERATION TRIGGER ---
  // SoufAI Agent-driven intent understanding and high-fidelity prompt generation
  let shouldGenerateImage = false;
  let optimizedImagePrompt = "";
  let arabicResponseMessage = "";
  const agentAnalysisSteps: string[] = [];

  try {
    const result = await executeRoutedPrompt({
      modelId: modelId as any,
      prompt: `User Prompt: "${cleanPrompt}"`,
      systemInstruction: `You are the core intent analyzer and prompt engineering engine of SoufAI.
Analyze the User Prompt and decide if the user wants to generate, create, draw, design, paint, edit, or imagine an image (e.g., "ارسم لي...", "صورة لـ...", "generate an image of...").

Your response MUST be a valid JSON object matching the following structure:
{
  "shouldGenerateImage": boolean,
  "optimizedImagePrompt": "string (A highly descriptive, artistic, and visually rich English prompt that translates and expands on the user's idea for image models like Flux/Stable Diffusion. Include style, high details, lighting, color tone, and composition. Keep it in English even if the user asked in Arabic. If shouldGenerateImage is false, leave empty)",
  "arabicResponse": "string (A warm, polite, and elegant response in Arabic acknowledging the request and describing the visual concept you formulated. Keep it to 1-2 lines. Do NOT use markdown image tags. If shouldGenerateImage is false, leave empty)"
}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shouldGenerateImage: { type: Type.BOOLEAN },
          optimizedImagePrompt: { type: Type.STRING },
          arabicResponse: { type: Type.STRING },
        },
        required: ["shouldGenerateImage", "optimizedImagePrompt", "arabicResponse"],
      },
    });

    if (result?.text) {
      let text = result.text.trim();
      if (text.startsWith("```json")) {
        text = text.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (text.startsWith("```")) {
        text = text.replace(/^```/, "").replace(/```$/, "").trim();
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        if (first !== -1 && last > first) {
          try {
            parsed = JSON.parse(text.substring(first, last + 1));
          } catch {}
        }
      }

      if (parsed && typeof parsed === "object") {
        shouldGenerateImage = !!parsed.shouldGenerateImage;
        optimizedImagePrompt = parsed.optimizedImagePrompt || "";
        arabicResponseMessage = parsed.arabicResponse || "";

        if (shouldGenerateImage) {
          agentAnalysisSteps.push("🧠 فهم رغبتك في توليد صورة وتجهيز المحرك الفني...");
          agentAnalysisSteps.push("🎨 صياغة التفاصيل البصرية وتطبيق معايير الدقة الفائقة...");
        }
      }
    }
  } catch (apiErr) {
    console.warn("Agentic intent detection failed, falling back to regex:", apiErr);
  }

  // Backup fallback using regex if Gemini API fails or is not configured
  if (!shouldGenerateImage) {
    const imageGenRegex = /(?:(?:[أإآا]نش[ئىيأا]|[أإآا]نش[أا]|توليد|ولد|صمم|تصميم|[أإآا]رسم|رسم|تخيل|تخيّل|[أإآا]صنع|صنع|عمل|[إا]عمل|سوي|سوّي|[أإآا]ريد|[أإآا]بغي|[أإآا]بغا|[أإآا]بي|[أإآا]عطيني|[أإآا]عطني|هات|نريد|أعطني|اعطني|أريد|اريد|ابغى|ابغا|سويلي|سوّيلي)\s*(?:لي\s+|لنا\s+|بالذكاء\s+|الاصطناعي\s+)*(?:صورة|صوره|صور|الصور|الصورة|الصوره|خلفية|خلفيه|خلفيات|لوحة|لوحه|رسمة|رسمه|رسومات|تصميم|تصامييم))|(?:(?:صورة|صوره|صور|الصور|الصورة|الصوره)\s*(?:لـ|ل|عن|فيها|تظهر|توضح|بالذكاء|الاصطناعي))|(?:\b(?:ارسم|أرسم|رسم|تخيل|تخيّل|صمم|صمّم)\s*(?:لي\s+|لنا\s+)?(?:[\u0600-\u06FF\w\s]{3,}))|(?:\b(?:generate|create|draw|paint|make|design|imagine|render)\s*(?:an?\s+|some\s+)?(?:image|picture|photo|illustration|art|sketch|wallpaper|drawing))|(?:\b(?:image|picture|photo|illustration|art|wallpaper|sketch)\s+(?:of|for|about|depicting))/i;
    if (imageGenRegex.test(cleanPrompt)) {
      shouldGenerateImage = true;
      optimizedImagePrompt = cleanPrompt
        .replace(/^(?:[أإآا]نش[ئىيأا]|[أإآا]نش[أا]|توليد|ولد|صمم|تصميم|[أإآا]رسم|رسم|تخيل|تخيّل|[أإآا]صنع|صنع|عمل|[إا]عمل|سوي|سوّي|[أإآا]ريد|[أإآا]بغي|[أإآا]بغا|[أإآا]بي|[أإآا]عطيني|[أإآا]عطني|هات|نريد|أعطني|اعطني|أريد|اريد|ابغى|ابغا|سويلي|سوّيلي)\s*(?:لي\s+|لنا\s+|بالذكاء\s+|الاصطناعي\s+)*/gi, "")
        .replace(/^(?:صورة|صوره|صور|الصور|الصورة|الصوره|خلفية|خلفيه|خلفيات|لوحة|لوحه|رسمة|رسمه|رسومات|تصميم|تصامييم)\s*(?:لـ|ل|عن|بـ|فيها|تظهر|توضح|بالذكاء|الاصطناعي)*/gi, "")
        .replace(/^(?:generate|create|draw|paint|make|design|imagine|render)\s*(?:an?\s+|some\s+)?(?:image|picture|photo|illustration|art|sketch|wallpaper|drawing)?\s*(?:of|for|about|depicting)*/gi, "")
        .replace(/^(?:لـ|ل|عن|بـ)\s+/g, "")
        .replace(/[\؟\?\,\.\"]/g, "")
        .trim();

      if (!optimizedImagePrompt || optimizedImagePrompt.length < 2) {
        optimizedImagePrompt = cleanPrompt;
      }
      arabicResponseMessage = `بكل سرور! لقد قمت بإنشاء الصورة المطلوبة بدقة عالية.`;
      agentAnalysisSteps.push("⚙️ جاري معالجة وتوليد الصورة الفنية بدقة عالية...");
    }
  }

  if (shouldGenerateImage) {
    try {
      const { generateImageViaManager } = await import("@/lib/providers/imageProviderManager");
      const imageRes = await generateImageViaManager(optimizedImagePrompt);

      const contextNote = `[أداة توليد الصور]:
- حالة العمل: ${imageRes.success ? "تمت العملية بنجاح" : "تعذر إنشاء الصورة"}
- زمن الاستجابة: ${imageRes.latencyMs}ms

[تعليمات الإجابة للمستخدم]:
1. أرحب بالمستخدم بعبارة مشجعة ومختصرة مثل: "إليك الصورة التي طلبتها بدقة عالية، أتمنى أن تنال إعجابك!"
2. يمنع منعاً باتاً طباعة أو تكرار البرومبت الداخلي أو البرومبت الإنجليزي في نص إجابتك، واكتفِ بالترحيب وتقديم الصورة.
3. لا تدرج أية روابط صور بنسق Markdown لأن الصورة معروضة بتصميم سينمائي فاخر ومباشر.`;

      return {
        executed: true,
        toolName: "generate_image",
        contextNote,
        agentSteps: [...agentAnalysisSteps, ...imageRes.steps],
        data: imageRes,
        widgetData: {
          type: "image_result",
          data: imageRes,
        },
        shouldSkipWebSearch: true,
      };
    } catch (imgErr) {
      console.warn("SoufImage tool routing error:", imgErr);
    }
  }

  return {
    executed: false,
  };
}
