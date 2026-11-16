/**
 * SoufAI Runtime Keys API
 * GET /api/v1/runtime/keys - Retrieve configured runtime provider keys (Admin only)
 * POST /api/v1/runtime/keys - Update runtime provider keys (Encrypted & persisted in Turso)
 */
import { NextRequest, NextResponse } from "next/server";
import { SettingsRepository } from "@/lib/db";
import { RuntimeKeyItem } from "@/lib/runtime/types";
import { encryptKey, decryptKey } from "@/lib/encryption";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const rawKeys = (await SettingsRepository.getSetting<RuntimeKeyItem[]>("runtime_keys")) || [];

    const decryptedKeys = rawKeys.map((item) => {
      let keyVal = item.key || "";
      if (keyVal.startsWith("enc:")) {
        try {
          keyVal = decryptKey(keyVal.slice(4));
        } catch {}
      } else if (keyVal) {
        try {
          keyVal = decryptKey(keyVal);
        } catch {}
      }
      return {
        ...item,
        key: keyVal,
      };
    });

    return NextResponse.json({
      success: true,
      keys: decryptedKeys,
    });
  } catch (err: any) {
    console.error("[Runtime Keys GET] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "فشل استرجاع مفاتيح بيئة التشغيل من قاعدة البيانات",
        keys: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await request.json();
    const incomingKeys: RuntimeKeyItem[] = body.keys || [];

    if (!Array.isArray(incomingKeys)) {
      return NextResponse.json(
        { success: false, error: "صيغة المفاتيح غير صحيحة" },
        { status: 400 }
      );
    }

    const encryptedKeys = incomingKeys.map((item) => {
      let keyVal = item.key || "";
      if (keyVal && !keyVal.startsWith("enc:")) {
        keyVal = encryptKey(decryptKey(keyVal));
      }
      return {
        ...item,
        key: keyVal,
      };
    });

    await SettingsRepository.setSetting("runtime_keys", encryptedKeys, true);

    return NextResponse.json({
      success: true,
      message: "تم حفظ مفاتيح بيئة التشغيل وتشفيرها في قاعدة بيانات Turso بنجاح",
      count: encryptedKeys.length,
    });
  } catch (err: any) {
    console.error("[Runtime Keys POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "فشل حفظ المفاتيح في قاعدة البيانات" },
      { status: 500 }
    );
  }
}
