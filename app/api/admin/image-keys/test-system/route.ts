import { NextRequest, NextResponse } from "next/server";
import {
  loadCloudflareKeys,
  generateViaCloudflareKey,
  generateViaPollinationsFallback,
} from "@/lib/providers/imageProviderManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const steps: { step: string; status: "success" | "error" | "info"; detail: string }[] = [];

  try {
    // Step 1: Check Cloudflare Key Pool
    steps.push({
      step: "فحص مجمع مفاتيح Cloudflare Workers AI",
      status: "info",
      detail: "جاري تحميل المفاتيح المسجلة والمعتمدة...",
    });

    const keys = await loadCloudflareKeys();
    const activeKeys = keys.filter((k) => k.isActive && k.status !== "failed");

    steps.push({
      step: "نتيجة فحص مجمع المفاتيح",
      status: activeKeys.length > 0 ? "success" : "error",
      detail: `إجمالي المفاتيح المسجلة: ${keys.length} | المفاتيح الفعالة والصالحة للتدوير: ${activeKeys.length}`,
    });

    // Step 2: Test Cloudflare Primary Provider Generation if active key exists
    let cfSuccess = false;
    if (activeKeys.length > 0) {
      const testKey = activeKeys[0];
      steps.push({
        step: "اختبار إنشاء صورة عبر Cloudflare Workers AI",
        status: "info",
        detail: `استخدام المفتاح الأول (${testKey.maskedToken}) للحساب (${testKey.accountId})...`,
      });

      const startTime = Date.now();
      const cfRes = await generateViaCloudflareKey(testKey, "a vibrant neon glowing crystal icon");
      const duration = Date.now() - startTime;

      if (cfRes.success) {
        cfSuccess = true;
        steps.push({
          step: "نجاح توليد صورة تجريبية عبر Cloudflare Workers AI",
          status: "success",
          detail: `النموذج المستخدم: ${cfRes.modelUsed || "Flux-1"} | يستغرق: ${duration}ms`,
        });
      } else {
        steps.push({
          step: "تعذر توليد الصورة عبر Cloudflare Workers AI",
          status: "error",
          detail: `السبب: ${cfRes.error}`,
        });
      }
    }

    // Step 3: Test Pollinations.AI Fallback Provider
    steps.push({
      step: "اختبار المزود الاحتياطي Pollinations.AI Fallback",
      status: "info",
      detail: "جاري التحقق من مسار التوليد الاحتياطي الضامن لتوفر الخدمة 100%...",
    });

    const polStart = Date.now();
    const polRes = await generateViaPollinationsFallback("a futuristic metropolis city with flying vehicles");
    const polDuration = Date.now() - polStart;

    if (polRes.success) {
      steps.push({
        step: "نجاح اختبار المزود الاحتياطي Pollinations.AI",
        status: "success",
        detail: `المزود جاهز ومتاح للعمل التلقائي عند طوارئ الخدمة | استجابة: ${polDuration}ms`,
      });
    } else {
      steps.push({
        step: "فشل اختبار المزود الاحتياطي Pollinations.AI",
        status: "error",
        detail: `السبب: ${polRes.error}`,
      });
    }

    return NextResponse.json({
      overallStatus: cfSuccess || polRes.success ? "operational" : "failed",
      steps,
      cloudflareOperational: cfSuccess,
      pollinationsOperational: polRes.success,
    });
  } catch (err: any) {
    steps.push({
      step: "خطأ غير متوقع أثناء فحص النظام",
      status: "error",
      detail: err.message || String(err),
    });

    return NextResponse.json({
      overallStatus: "failed",
      steps,
    });
  }
}
