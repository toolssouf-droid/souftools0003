import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { decryptKey } from "@/lib/encryption";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

// Minimal valid 1x1 PNG image data for testing vision multimodal capabilities
const SAMPLE_TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { providerId, model, apiKey, customEndpoint, testPrompt } = body || {};

    if (!providerId || !model || !apiKey) {
      return NextResponse.json(
        { success: false, error: "يرجى توفير المزود واسم النموذج ومفتاح الـ API للاختبار" },
        { status: 400 }
      );
    }

    const decryptedKey = decryptKey(apiKey) || apiKey;
    const promptToTest = testPrompt || "قم بوصف ما تراه في هذه الصورة البسيطة باختصار شديد باللغة العربية في جملة واحدة.";

    let outputText = "";

    if (providerId === "gemini") {
      const ai = new GoogleGenAI({ apiKey: decryptedKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            inlineData: {
              mimeType: "image/png",
              data: SAMPLE_TEST_IMAGE_BASE64,
            },
          },
          { text: promptToTest },
        ],
        config: {
          temperature: 0.1,
        },
      });
      outputText = response.text || "تم التحليل بنجاح";
    } else if (providerId === "anthropic") {
      const endpoint = customEndpoint || "https://api.anthropic.com/v1/messages";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": decryptedKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 150,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: SAMPLE_TEST_IMAGE_BASE64,
                  },
                },
                { type: "text", text: promptToTest },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic Error (${res.status}): ${errText}`);
      }
      const json = await res.json();
      outputText = json?.content?.[0]?.text || "تم التحليل بنجاح";
    } else {
      const { getChatEndpointForProvider } = await import("@/lib/providers/providerAdapters");
      const endpoint = getChatEndpointForProvider(providerId, customEndpoint, decryptedKey);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${decryptedKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${SAMPLE_TEST_IMAGE_BASE64}`,
                  },
                },
                { type: "text", text: promptToTest },
              ],
            },
          ],
          max_tokens: 150,
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Vision Provider Error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      outputText = json?.choices?.[0]?.message?.content || "تم التحليل بنجاح";
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      description: outputText.trim(),
      latencyMs,
      message: `تم اختبار نموذج الرؤية بنجاح في ${latencyMs}ms عبر [${providerId} / ${model}]! ⚡`,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        latencyMs,
        error: error?.message || "فشل اختبار نموذج تحليل الصور والرؤية",
      },
      { status: 500 }
    );
  }
}
