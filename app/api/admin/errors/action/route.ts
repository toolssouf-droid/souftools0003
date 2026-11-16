import { NextRequest, NextResponse } from "next/server";
import { serverErrorManager } from "@/lib/errors/errorManager";
import { GoogleGenAI } from "@google/genai";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await serverErrorManager.ensureLoaded();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { action, errorId, notes, user, simulationType, fixType } = body;

    if (action === "ai_analyze_error") {
      if (!errorId) {
        return NextResponse.json({ success: false, error: "معرف الخطأ مطلوب" }, { status: 400 });
      }
      const errorRecord = serverErrorManager.getErrorById(errorId);
      if (!errorRecord) {
        return NextResponse.json({ success: false, error: "سجل الخطأ غير موجود" }, { status: 404 });
      }

      let analysis = {
        rootCause: errorRecord.diagnosis || "مشكلة في بيئة التشغيل أو الاتصال بالخدمات الخارجية.",
        impact: "تأثر بعض وظائف المنصة أو بطء في الاستجابة للمستخدمين.",
        steps: [
          "مراجعة إعدادات ومفاتيح الخدمة في لوحة التحكم.",
          "استخدام أزرار الإصلاح السريع المتاحة في لوحة التشخيص.",
          "إعادة تشغيل العملية أو الجلسة المتأثرة للتحقق من زوال الخطأ."
        ],
        suggestedAction: errorRecord.suggestedFix || "إعادة محاولة الطلب بعد فحص سلامة الاتصال والمفاتيح.",
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `أنت مهندس استشاري ومسؤول بنية تحتية عالي الخبرة (Site Reliability Engineer) لمنصة SoufTools.
قم بتحليل هذا الخطأ البرمجي الواقع في خادم المنصة، واقترح تشخيصاً تقنياً دقيقاً وخطوات إصلاح حاسمة.

بيانات الخطأ:
- العنوان: ${errorRecord.title}
- التصنيف: ${errorRecord.category}
- مستوى الخطورة: ${errorRecord.severity}
- الرسالة: ${errorRecord.message}
- المسار (Endpoint): ${errorRecord.endpoint || "غير محدد"}
- رمز الحالة (Status Code): ${errorRecord.statusCode || "غير محدد"}
- المزود / النموذج: ${errorRecord.providerId || ""} ${errorRecord.modelId || ""}
- التكرار: حدث ${errorRecord.occurrencesCount} مرة
- تتبع المكدس (Stack Trace): ${errorRecord.stackTrace?.slice(0, 500) || "غير متوفر"}

أجب ككائن JSON صالح فقط بالشكل التالي:
{
  "rootCause": "شرح علمي وتقني مباشر ودقيق لسبب حدوث المشكلة باللغة العربية",
  "impact": "توضيح تأثير هذا الخطأ بدقة على المستخدمين أو استقرار السيرفر",
  "steps": [
    "الخطوة الأولى المباشرة للحل",
    "الخطوة الثانية للتحقق",
    "الخطوة الثالثة للوقاية"
  ],
  "suggestedAction": "الإجراء السريع الموصى به لتنفيذه فوراً"
}`;

          let res: any = null;
          for (const m of ["gemini-3-flash-preview", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"]) {
            try {
              res = await ai.models.generateContent({
                model: m,
                contents: prompt,
                config: {
                  responseMimeType: "application/json",
                  temperature: 0.2,
                },
              });
              if (res?.text) break;
            } catch (retryErr) {
              // continue to next model
            }
          }

          if (res?.text) {
            try {
              const parsed = JSON.parse(res.text);
              if (parsed.rootCause && Array.isArray(parsed.steps)) {
                analysis = {
                  rootCause: parsed.rootCause,
                  impact: parsed.impact || analysis.impact,
                  steps: parsed.steps,
                  suggestedAction: parsed.suggestedAction || analysis.suggestedAction,
                };
              }
            } catch {}
          }
        } catch (aiErr) {
          console.warn("Gemini Error Analysis fallback:", aiErr);
        }
      }

      const updated = serverErrorManager.attachAiAnalysis(errorId, analysis);
      await serverErrorManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        record: updated,
        analysis,
        stats: serverErrorManager.getStats(),
      });
    }

    if (action === "resolve") {
      if (!errorId) {
        return NextResponse.json({ success: false, error: "معرف الخطأ مطلوب" }, { status: 400 });
      }
      const updated = serverErrorManager.updateErrorStatus(errorId, "resolved", notes, user);
      await serverErrorManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        record: updated,
        stats: serverErrorManager.getStats(),
      });
    }

    if (action === "investigate") {
      if (!errorId) {
        return NextResponse.json({ success: false, error: "معرف الخطأ مطلوب" }, { status: 400 });
      }
      const updated = serverErrorManager.updateErrorStatus(errorId, "investigating", notes, user);
      await serverErrorManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        record: updated,
        stats: serverErrorManager.getStats(),
      });
    }

    if (action === "resolve_all") {
      const count = serverErrorManager.resolveAll(user);
      await serverErrorManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        resolvedCount: count,
        stats: serverErrorManager.getStats(),
      });
    }

    if (action === "clear_resolved") {
      const cleared = serverErrorManager.clearResolvedHistory();
      await serverErrorManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        clearedCount: cleared,
        stats: serverErrorManager.getStats(),
      });
    }

    if (action === "execute_fix") {
      const target = errorId || fixType;
      if (!target) {
        return NextResponse.json({ success: false, error: "يجب تحديد نوع الإصلاح أو معرف الخطأ" }, { status: 400 });
      }
      const fixResult = await serverErrorManager.executeAutoFix(target);
      await serverErrorManager.flushPendingWrites();
      return NextResponse.json({
        success: fixResult.success,
        message: fixResult.message,
        details: fixResult.details,
        stats: serverErrorManager.getStats(),
      });
    }

    if (action === "simulate_test_error") {
      const simulated = serverErrorManager.simulateTestError(simulationType || "critical_ai");
      await serverErrorManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        record: simulated,
        stats: serverErrorManager.getStats(),
      });
    }

    return NextResponse.json({ success: false, error: "الإجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "حدث خطأ أثناء تنفيذ العملية" },
      { status: 500 }
    );
  }
}
