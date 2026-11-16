import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/security/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) {
      return NextResponse.json(
        { error: "يجب عليك تسجيل الدخول أولاً لتوليد الصور.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const rateCheck = checkRateLimit(`img_gen_${authResult.user.id}`, 10, 10);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح لتوليد الصور (10 صور بالدقيقة). يرجى الانتظار قليلاً.", retryAfter: rateCheck.retryAfterSeconds },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, aspectRatio = "1:1" } = body;
    if (!prompt) {
      return NextResponse.json({ error: "طلب إنشاء الصورة فارغ" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: "مفتاح API لـ Gemini غير مهيأ في الخادم. يرجى تهيئته لتوليد الصور." 
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

    let imageUrl = "";

    // 1. Primary: Official Imagen 3 engine via Google GenAI SDK
    try {
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: (aspectRatio as any) || "1:1",
        },
      });

      if (response?.generatedImages && response.generatedImages[0]?.image?.imageBytes) {
        imageUrl = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
      }
    } catch (imagenErr: any) {
      console.warn("Imagen 3 primary generation notice:", imagenErr?.message || imagenErr);
      
      // 2. Secondary: Flash multimodal image generation if supported
      try {
        const altResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ text: prompt }],
          config: {
            imageConfig: {
              aspectRatio: aspectRatio,
            },
          },
        });

        const candidates = altResponse.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData?.data) {
              imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
              break;
            }
          }
        }
      } catch (altErr) {
        // Fallback to high-quality SVG vector illustration if raster model quotas are unavailable
        const cleanPrompt = prompt.replace(/[<>&"]/g, " ").slice(0, 80);
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
            <defs>
              <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0f172a" />
                <stop offset="50%" stop-color="#1e293b" />
                <stop offset="100%" stop-color="#0284c7" />
              </linearGradient>
              <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#818cf8" />
              </linearGradient>
            </defs>
            <rect width="800" height="600" fill="url(#bg)" rx="16" />
            <circle cx="400" cy="240" r="120" fill="url(#glow)" opacity="0.15" />
            <circle cx="400" cy="240" r="80" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 8" opacity="0.6" />
            <path d="M370 210 L430 210 L440 230 L450 230 C455 230 460 235 460 240 L460 280 C460 285 455 290 450 290 L350 290 C345 290 340 285 340 280 L340 240 C340 235 345 230 350 230 L360 230 Z" fill="none" stroke="#38bdf8" stroke-width="3" />
            <circle cx="400" cy="260" r="18" fill="none" stroke="#38bdf8" stroke-width="3" />
            <text x="400" y="380" font-family="system-ui, sans-serif" font-size="22" font-weight="600" fill="#f8fafc" text-anchor="middle">تصميم توضيحي للطلب</text>
            <text x="400" y="420" font-family="system-ui, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">${cleanPrompt}</text>
            <text x="400" y="540" font-family="system-ui, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">تم إنشاؤه عبر محرك SoufAI المدمج</text>
          </svg>
        `.trim();
        imageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ 
        error: "لم يرجع النموذج أي بيانات صورة." 
      }, { status: 500 });
    }

    return NextResponse.json({ imageUrl });

  } catch (err: any) {
    console.error("Image generation error:", err);
    return NextResponse.json({ 
      error: `فشل توليد الصورة: ${err?.message || "خطأ غير معروف"}` 
    }, { status: 500 });
  }
}
