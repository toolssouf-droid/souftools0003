import { NextRequest, NextResponse } from "next/server";
import {
  getRuntimeProviders,
  saveRuntimeProviders,
  getRuntimeKeys,
  saveRuntimeKeys,
  getRuntimeSettings,
  saveRuntimeSettings,
} from "@/lib/runtime/runtimeDatabaseServices";
import { maskKey, encryptKey, decryptKey } from "@/lib/encryption";
import { RuntimeKeyItem } from "@/lib/runtime/types";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const [providers, rawKeys, settings] = await Promise.all([
      getRuntimeProviders(),
      getRuntimeKeys(),
      getRuntimeSettings(),
    ]);

    // Mask keys before returning to UI for security (POL-FS-01 & POL-SEC-01)
    const sanitizedKeys = rawKeys.map((k) => {
      const decrypted = decryptKey(k.key);
      return {
        ...k,
        maskedKey: maskKey(decrypted),
        key: maskKey(decrypted), // Frontend receives masked representation
        hasRealKey: Boolean(decrypted && decrypted.length > 5),
      };
    });

    // Automatically surface environment system key (E2B_API_KEY) if set and not already present
    const envKey = process.env.E2B_API_KEY;
    if (
      envKey &&
      envKey.length > 5 &&
      !sanitizedKeys.some((k) => k.id === "env_fallback_e2b" || k.maskedKey === maskKey(envKey))
    ) {
      sanitizedKeys.unshift({
        id: "env_fallback_e2b",
        provider: "e2b",
        key: maskKey(envKey),
        maskedKey: maskKey(envKey),
        hasRealKey: true,
        status: "active",
        failures: 0,
        createdAt: Date.now(),
        label: "مفتاح النظام الافتراضي (.env E2B_API_KEY)",
        latencyMs: 120,
      });
    }

    return NextResponse.json({
      providers,
      keys: sanitizedKeys,
      settings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load runtime configuration" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { providers, keys, settings } = body;

    if (providers && Array.isArray(providers)) {
      await saveRuntimeProviders(providers);
    }

    if (keys && Array.isArray(keys)) {
      const existingKeys = await getRuntimeKeys();
      const processedKeys: RuntimeKeyItem[] = [];

      for (const incoming of keys) {
        // Skip virtual system fallback key from being persisted into key array
        if (incoming.id === "env_fallback_e2b") continue;

        let keyVal = incoming.key || "";

        // If key value is masked (e.g. e2b_••••1234) or already encrypted (enc:...), retain existing stored encrypted key
        if (keyVal.includes("••••") || keyVal.includes("****") || keyVal.startsWith("enc:")) {
          const match = existingKeys.find((ek) => ek.id === incoming.id);
          if (match) {
            processedKeys.push({
              ...incoming,
              key: match.key, // Retain previously encrypted key value
            });
            continue;
          } else if (keyVal.startsWith("enc:")) {
            processedKeys.push({
              ...incoming,
              key: keyVal,
            });
            continue;
          }
        }

        // New or updated plain text key
        if (keyVal && !keyVal.includes("••••") && !keyVal.includes("****")) {
          processedKeys.push({
            id: incoming.id || `rkey_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            provider: incoming.provider || "e2b",
            key: encryptKey(keyVal),
            status: incoming.status || "active",
            failures: incoming.failures || 0,
            createdAt: incoming.createdAt || Date.now(),
            lastUsed: incoming.lastUsed,
            latencyMs: incoming.latencyMs || 150,
            label: incoming.label || "E2B Sandbox Key",
          });
        }
      }

      await saveRuntimeKeys(processedKeys);
    }

    if (settings && typeof settings === "object") {
      await saveRuntimeSettings(settings);
    }

    return NextResponse.json({
      success: true,
      message: "تم حفظ ومزامنة إعدادات ومفاتيح الـ Runtime بنجاح",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save runtime configuration" },
      { status: 500 }
    );
  }
}
