import { NextResponse } from "next/server";
import { webPushManager } from "@/lib/notifications/webPushManager";

export async function GET() {
  try {
    await webPushManager.ensureInitialized?.();
    const publicKey = await Promise.resolve(webPushManager.getPublicKey());
    return NextResponse.json({
      success: true,
      publicKey,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to retrieve VAPID public key" },
      { status: 500 }
    );
  }
}
