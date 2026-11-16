import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { classifyUserIntent } from "@/lib/agent/classifierEngine";
import { decryptKey } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

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
    const promptToTest = testPrompt || "كم الساعة الآن في مدينة دبي؟ وما هو الطقس؟";

    const result = await classifyUserIntent(promptToTest, {
      providerId,
      model,
      apiKey: decryptedKey,
      status: "active",
    });

    return NextResponse.json({
      success: true,
      classification: result.classification,
      rawResponse: result.rawResponse,
      latencyMs: result.latencyMs,
      message: `تم التصنيف بنجاح إلى [${result.classification}] في ${result.latencyMs}ms عبر ${providerId}/${model} ⚡`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "فشل اختبار نموذج التصنيف",
      },
      { status: 500 }
    );
  }
}
