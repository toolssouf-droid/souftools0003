import { NextRequest, NextResponse } from "next/server";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await telegramManager.ensureInitialized();
    const { searchParams } = new URL(req.url);
    const filterChatId = searchParams.get("chatId") || undefined;
    const limitParam = parseInt(searchParams.get("limit") || "100", 10);
    const limit = Math.min(Math.max(limitParam || 50, 1), 200);

    const config = telegramManager.getConfig();
    const logs = telegramManager.getLogs(filterChatId, limit);
    return NextResponse.json({
      success: true,
      config,
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل جلب إعدادات تيليجرام" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    await telegramManager.ensureInitialized();
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const updated = telegramManager.updateConfig(body);
    telegramManager.addLog({
      direction: "system",
      chatId: "Admin",
      content: "تم تحديث إعدادات بوابة تيليجرام وحفظها في قاعدة بيانات Turso.",
      messageType: "system",
      status: "delivered",
    });
    await telegramManager.flushPendingWrites();

    return NextResponse.json({
      success: true,
      config: updated,
      message: "تم حفظ الإعدادات بنجاح",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل حفظ إعدادات تيليجرام" },
      { status: 500 }
    );
  }
}
