import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) {
      return NextResponse.json(
        { error: "يجب عليك تسجيل الدخول أولاً لتوليد الفيديو.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const { prompt, aspectRatio = "16:9" } = body;
    if (!prompt) {
      return NextResponse.json({ error: "طلب إنشاء الفيديو فارغ" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: "مفتاح API لـ Gemini غير مهيأ في الخادم. يرجى تهيئته لتوليد الفيديو." 
      }, { status: 500 });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    return NextResponse.json({ 
      success: true, 
      operationName: operation.name,
      message: "بدأ توليد الفيديو بنجاح! يمكنك تتبع حالة العملية."
    });

  } catch (err: any) {
    console.error("Video generation error:", err);
    return NextResponse.json({ 
      error: `فشل توليد الفيديو: ${err?.message || "تتطلب ميزة الفيديو حساب Gemini مدفوع ومفعّل"}` 
    }, { status: 500 });
  }
}
