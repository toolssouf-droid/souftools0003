import { NextRequest, NextResponse } from "next/server";
import { generateImageViaManager } from "@/lib/providers/imageProviderManager";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, aspectRatio, style } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "الرجاء كتابة وصف الصورة (Prompt)" },
        { status: 400 }
      );
    }

    let fullPrompt = prompt.trim();
    if (aspectRatio || style) {
      fullPrompt = `${fullPrompt} [Aspect ratio: ${aspectRatio || "16:9"}, Style: ${style || "cinematic"}]`;
    }

    const result = await generateImageViaManager(fullPrompt);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Image generation API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "حدث خطأ غير متوقع أثناء إنشاء الصورة",
      },
      { status: 500 }
    );
  }
}
