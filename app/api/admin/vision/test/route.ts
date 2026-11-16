import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { decryptKey } from "@/lib/encryption";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

// Minimal 1x1 transparent PNG base64 for testing vision capability
const TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { providerId, model, apiKey, testPrompt } = body || {};

    if (!providerId || !model || !apiKey) {
      return NextResponse.json(
        { success: false, error: "يرجى توفير المزود والنموذج والمفتاح للاختبار" },
        { status: 400 }
      );
    }

    const decryptedKey = decryptKey(apiKey) || apiKey;
    const prompt = testPrompt || "ما هو لون أو محتوى هذه الصورة البسيطة؟ أجب باختصار شديد باللغة العربية.";

    let outputText = "";

    if (providerId === "gemini") {
      const ai = new GoogleGenAI({ apiKey: decryptedKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            inlineData: {
              mimeType: "image/png",
              data: TEST_IMAGE_BASE64,
            },
          },
          { text: prompt },
        ],
        config: {
          systemInstruction: "أنت نظام فحص الرؤية البصرية. أجب بدقة واختصار.",
          temperature: 0.1,
        },
      });
      outputText = response.text || "";
    } else if (providerId === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": decryptedKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: TEST_IMAGE_BASE64,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Anthropic API Error (${res.status})`);
      }
      const data = await res.json();
      outputText = data.content?.[0]?.text || "";
    } else {
      const { getChatEndpointForProvider } = await import("@/lib/providers/providerAdapters");
      const endpoint = getChatEndpointForProvider(providerId, undefined, decryptedKey);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${decryptedKey}`,
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${TEST_IMAGE_BASE64}` },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `Provider Error (${res.status})`;
        throw new Error(msg);
      }
      const data = await res.json();
      outputText = data.choices?.[0]?.message?.content || "";
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      outputText,
      latencyMs,
      message: `تم اختبار نموذج الرؤية بنجاح 🟢 (${providerId}/${model}) في ${latencyMs}ms`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "فشل اختبار نموذج الرؤية",
      },
      { status: 500 }
    );
  }
}
