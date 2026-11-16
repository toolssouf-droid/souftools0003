import { NextRequest, NextResponse } from "next/server";
import { updateInMemoryAdminConfig, loadServerAdminConfig } from "@/lib/adminConfigStore";
import { normalizeAndFixEmailAddress } from "@/lib/utils/emailFormatter";
import { whatsappManager } from "@/lib/whatsapp/whatsappManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const config = await loadServerAdminConfig();
    const waConfig = whatsappManager.getConfig();

    const email = config.platformSupportEmail || waConfig.agentEmail || "souftoolsheb@gmail.com";
    return NextResponse.json({
      success: true,
      platformSupportEmail: email,
      agentEmail: waConfig.agentEmail || email,
      agentDisplayName: waConfig.agentDisplayName || "سوف - الوكيل الذكي المستقل (SoufAI Agent)",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load support email", platformSupportEmail: "souftoolsheb@gmail.com" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { platformSupportEmail, agentDisplayName } = body;

    if (!platformSupportEmail || typeof platformSupportEmail !== "string") {
      return NextResponse.json(
        { success: false, error: "يرجى تحديد عنوان بريد إلكتروني صالح لدعم المنصة" },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeAndFixEmailAddress(platformSupportEmail);

    // Persist directly to Turso via adminConfigStore
    await updateInMemoryAdminConfig({
      platformSupportEmail: cleanEmail,
    });

    // Update WhatsApp & Agent Identity manager
    whatsappManager.updateConfig({
      agentEmail: cleanEmail,
      ...(agentDisplayName ? { agentDisplayName } : {}),
    });

    return NextResponse.json({
      success: true,
      platformSupportEmail: cleanEmail,
      message: `تم تحديث بريد دعم المنصة الرسمي إلى (${cleanEmail}) بنجاح`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل حفظ بريد دعم المنصة" },
      { status: 500 }
    );
  }
}
