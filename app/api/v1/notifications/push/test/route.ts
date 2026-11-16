import { NextRequest, NextResponse } from "next/server";
import { webPushManager } from "@/lib/notifications/webPushManager";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const body = await req.json().catch(() => ({}));

    const result = await webPushManager.sendPushNotification(userId, {
      title: body.title || "🔔 اختبار إشعارات SoufAI الفورية",
      body: body.body || "تهانينا! نظام Web Push يعمل بنجاح على جهازك حتى عند إغلاق المتصفح 🚀",
      url: body.url || "/ar/chat",
      id: `test_${Date.now()}`,
    });

    return NextResponse.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors,
      message:
        result.sentCount > 0
          ? `تم إرسال إشعار فوري إلى ${result.sentCount} أجهزة مسجلة بنجاح!`
          : "لم يتم العثور على أجهزة مسجلة لاشتراك هذا المستخدم، يرجى تفعيل الإشعارات أولاً.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to send test push notification" },
      { status: 500 }
    );
  }
}
