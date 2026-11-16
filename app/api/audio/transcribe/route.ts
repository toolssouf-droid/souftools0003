// Server-side Audio Transcription Route supporting Gemini, AssemblyAI, and ElevenLabs Scribe
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "@/lib/auth/serverAuth";
import {
  getAudioProviderKeys,
  transcribeViaAssemblyAI,
  transcribeViaElevenLabs,
} from "@/lib/providers/audioProviderManager";

function cleanBase64(base64: string): string {
  if (!base64) return "";
  const commaIndex = base64.indexOf(",");
  if (commaIndex !== -1) {
    return base64.substring(commaIndex + 1);
  }
  return base64;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) {
      return NextResponse.json(
        { success: false, error: "يجب عليك تسجيل الدخول أولاً لاستخدام التسجيل الصوتي.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const { audioBase64, mimeType = "audio/webm", language = "ar", provider } = body;

    if (!audioBase64) {
      return NextResponse.json(
        { success: false, error: "لم يتم استلام أي بيانات صوتية" },
        { status: 400 }
      );
    }

    const cleanData = cleanBase64(audioBase64);
    const audioMime = mimeType.split(";")[0] || "audio/webm";
    const audioBuffer = Buffer.from(cleanData, "base64");
    const requestedProvider = typeof provider === "string" ? provider.trim().toLowerCase() : "";

    // Explicit or fallback AssemblyAI transcription
    if (requestedProvider === "assemblyai") {
      const keys = await getAudioProviderKeys("assemblyai");
      if (!keys.length) {
        return NextResponse.json(
          { success: false, error: "مفتاح AssemblyAI غير مهيأ في الخادم" },
          { status: 400 }
        );
      }
      const text = await transcribeViaAssemblyAI({
        audioBuffer,
        apiKey: keys[0],
        language,
      });
      return NextResponse.json({ success: true, text, provider: "assemblyai" });
    }

    // Explicit or fallback ElevenLabs Scribe transcription
    if (requestedProvider === "elevenlabs") {
      const keys = await getAudioProviderKeys("elevenlabs");
      if (!keys.length) {
        return NextResponse.json(
          { success: false, error: "مفتاح ElevenLabs غير مهيأ في الخادم" },
          { status: 400 }
        );
      }
      const text = await transcribeViaElevenLabs({
        audioBuffer,
        mimeType: audioMime,
        apiKey: keys[0],
        language,
      });
      return NextResponse.json({ success: true, text, provider: "elevenlabs" });
    }

    // Default: Gemini Multimodal Engine, with fallback to configured AssemblyAI / ElevenLabs if GEMINI_API_KEY absent
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const assemblyKeys = await getAudioProviderKeys("assemblyai");
      if (assemblyKeys.length > 0) {
        const text = await transcribeViaAssemblyAI({ audioBuffer, apiKey: assemblyKeys[0], language });
        return NextResponse.json({ success: true, text, provider: "assemblyai" });
      }
      const elevenKeys = await getAudioProviderKeys("elevenlabs");
      if (elevenKeys.length > 0) {
        const text = await transcribeViaElevenLabs({
          audioBuffer,
          mimeType: audioMime,
          apiKey: elevenKeys[0],
          language,
        });
        return NextResponse.json({ success: true, text, provider: "elevenlabs" });
      }
      return NextResponse.json(
        { success: false, error: "مفتاح الذكاء الاصطناعي للصوت غير متوفر في الخادم" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const promptText = language === "ar"
      ? "قم بتفريغ وتحويل الصوت المسجل إلى نص مكتوب بدقة فائقة باللغة الأصلية المنطوقة (العربية أو الإنجليزية). اكتب فقط النص المنطوق تماماً دون أي مقدمات أو شروحات أو رموز إضافية. إذا كان الصوت صامتاً أو غير مفهوم، اكتب نصاً فارغاً."
      : "Transcribe the spoken audio verbatim in its spoken language with high precision. Output only the exact transcribed speech without any preamble, metadata or commentary. If silence, output nothing.";

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          inlineData: {
            mimeType: audioMime,
            data: cleanData,
          },
        },
        {
          text: promptText,
        },
      ],
    });

    const transcribedText = response?.text?.trim() || "";

    return NextResponse.json({
      success: true,
      text: transcribedText,
      provider: "gemini",
    });
  } catch (error: any) {
    console.error("Audio transcription error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "فشل تفريغ الصوت المسجل",
      },
      { status: 500 }
    );
  }
}
