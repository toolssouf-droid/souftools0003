import { NextRequest, NextResponse } from "next/server";
import { whatsappManager } from "@/lib/whatsapp/whatsappManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const filterPhone = searchParams.get("phone") || undefined;
    const limitParam = parseInt(searchParams.get("limit") || "100", 10);
    const limit = Math.min(Math.max(limitParam || 50, 1), 200);

    const { WhatsAppAuthRepository } = await import("@/lib/db");
    const { initWhatsAppAutoRestore } = await import("@/lib/whatsapp/baileysService");
    const hasPersistentSession = await WhatsAppAuthRepository.hasSession("default");

    const config = whatsappManager.getConfig();
    config.hasPersistentSession = hasPersistentSession;
    config.storageType = "turso";

    // Auto restore if session exists in DB and currently disconnected
    if (hasPersistentSession && config.connectionStatus === "disconnected") {
      initWhatsAppAutoRestore().catch(() => {});
    }

    const logs = whatsappManager.getLogs(filterPhone, limit);
    return NextResponse.json({
      success: true,
      config,
      logs,
      hasPersistentSession,
      storage: "turso",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل جلب إعدادات واتساب" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const updated = whatsappManager.updateConfig(body);
    whatsappManager.addLog({
      direction: "system",
      phone: "Admin",
      content: "تم تحديث إعدادات بوابة واتساب والوكيل الذكي بنجاح.",
      status: "delivered",
      automated: false,
    });

    return NextResponse.json({
      success: true,
      config: updated,
      message: "تم حفظ الإعدادات بنجاح",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل حفظ إعدادات واتساب" },
      { status: 500 }
    );
  }
}
