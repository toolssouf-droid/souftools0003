import { NextRequest, NextResponse } from "next/server";
import { webPushManager } from "@/lib/notifications/webPushManager";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const body = await req.json();

    if (!body || !body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { success: false, error: "Invalid push subscription object" },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const saved = await webPushManager.saveSubscription(userId, body, userAgent);

    return NextResponse.json({
      success: saved,
      message: saved ? "تم تفعيل اشتراك الإشعارات بنجاح" : "تعذر حفظ الاشتراك",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to register subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const endpoint = body.endpoint || req.nextUrl.searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: "Endpoint is required to unsubscribe" },
        { status: 400 }
      );
    }

    const removed = await webPushManager.removeSubscription(
      endpoint,
      authResult.user.role === "super_admin" ? undefined : userId
    );

    return NextResponse.json({
      success: true,
      removed,
      message: "تم إلغاء تفعيل اشتراك الإشعارات",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
