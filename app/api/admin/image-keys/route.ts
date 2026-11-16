import { NextRequest, NextResponse } from "next/server";
import {
  loadCloudflareKeys,
  saveCloudflareKeys,
  CloudflareKeyItem,
} from "@/lib/providers/imageProviderManager";
import { maskKey } from "@/lib/encryption";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const keys = await loadCloudflareKeys();

    // Sanitize tokens so raw secrets are NEVER sent to client
    const safeKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      accountId: k.accountId,
      maskedToken: maskKey(k.apiToken),
      status: k.status,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      lastError: k.lastError || null,
      successCount: k.successCount || 0,
      failureCount: k.failureCount || 0,
      isActive: k.isActive !== undefined ? k.isActive : true,
    }));

    const activeCount = safeKeys.filter((k) => k.isActive && k.status === "healthy").length;
    const disabledCount = safeKeys.filter((k) => !k.isActive || k.status === "disabled").length;
    const failedCount = safeKeys.filter((k) => k.status === "failed").length;

    return NextResponse.json({
      providers: {
        cloudflare: {
          name: "Cloudflare Workers AI",
          status: activeCount > 0 ? "operational" : "degraded",
          model: "Flux-1 Schnell / SDXL",
          keysCount: safeKeys.length,
          activeCount,
          disabledCount,
          failedCount,
        },
        pollinations: {
          name: "Pollinations.AI",
          status: "fallback_available",
          model: "Flux-1",
          requiresKey: false,
        },
      },
      keys: safeKeys,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch image providers config" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, keyData, keyId } = body;

    const keys = await loadCloudflareKeys();

    if (action === "add_key") {
      const { name, accountId, apiToken } = keyData || {};

      if (!accountId || !apiToken) {
        return NextResponse.json(
          { error: "الرجاء إدخال Account ID و API Token الخاص بحساب Cloudflare" },
          { status: 400 }
        );
      }

      const newKeyObj: CloudflareKeyItem = {
        id: `cf_key_${Date.now()}`,
        name: name?.trim() || `Cloudflare Key ${keys.length + 1}`,
        accountId: accountId.trim(),
        apiToken: apiToken.trim(),
        maskedToken: maskKey(apiToken.trim()),
        status: "healthy",
        createdAt: new Date().toISOString(),
        successCount: 0,
        failureCount: 0,
        isActive: true,
      };

      const updatedKeys = [...keys, newKeyObj];
      await saveCloudflareKeys(updatedKeys);

      return NextResponse.json({
        success: true,
        message: "تم حفظ مفتاح Cloudflare الجديد بنجاح بطريقة مشفرة ومحميّة.",
      });
    }

    if (action === "toggle_key") {
      if (!keyId) {
        return NextResponse.json({ error: "Missing keyId" }, { status: 400 });
      }

      const updatedKeys: CloudflareKeyItem[] = keys.map((k) => {
        if (k.id === keyId) {
          const newActiveState = !k.isActive;
          return {
            ...k,
            isActive: newActiveState,
            status: newActiveState ? ("healthy" as const) : ("disabled" as const),
            failureCount: newActiveState ? 0 : k.failureCount,
          };
        }
        return k;
      });

      await saveCloudflareKeys(updatedKeys);

      return NextResponse.json({
        success: true,
        message: "تم تحديث حالة المفتاح بنجاح.",
      });
    }

    if (action === "delete_key") {
      if (!keyId) {
        return NextResponse.json({ error: "Missing keyId" }, { status: 400 });
      }

      const updatedKeys = keys.filter((k) => k.id !== keyId);
      await saveCloudflareKeys(updatedKeys);

      return NextResponse.json({
        success: true,
        message: "تم حذف المفتاح بنجاح.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update key pool" },
      { status: 500 }
    );
  }
}
