import { NextRequest, NextResponse } from "next/server";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  try {
    await telegramManager.ensureInitialized();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (code) {
      const status = telegramManager.checkPairingCode(code);
      return NextResponse.json({
        success: true,
        isLinked: status.isLinked,
        chatId: status.user?.chatId,
        username: status.user?.username,
        botUsername: status.botUsername || telegramManager.getConfig().botUsername,
      });
    }

    const config = telegramManager.getConfig();
    return NextResponse.json({
      success: true,
      botUsername: config.botUsername,
      connectionStatus: config.connectionStatus,
      isPolling: config.connectionStatus === "connected",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed checking pairing status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await telegramManager.ensureInitialized();
    const body = await req.json().catch(() => ({}));
    const { action, email, userId, chatId, code } = body;

    if (action === "generate_code") {
      const pairInfo = telegramManager.createPairingCode(email, userId);
      await telegramManager.flushPendingWrites();
      return NextResponse.json({
        success: true,
        code: pairInfo.code,
        botUsername: pairInfo.botUsername,
        deepLink: pairInfo.deepLink,
      });
    }

    if (action === "unlink") {
      const authUser = await resolveAuthUser(req);
      const target = chatId || code;
      if (target) {
        const paired = telegramManager.getPairedUser(target);
        const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";
        const isOwner =
          authUser &&
          ((paired?.userId && paired.userId === authUser.id) ||
            (paired?.email && authUser.email && paired.email.toLowerCase() === authUser.email.toLowerCase()));

        if (!isAdmin && !isOwner && paired) {
          return NextResponse.json(
            { success: false, error: "غير مصرح لك بإلغاء ربط هذا الحساب" },
            { status: 403 }
          );
        }
        telegramManager.unlinkUser(target);
        await telegramManager.flushPendingWrites();
      }
      return NextResponse.json({
        success: true,
        message: "Unlinked successfully",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action specified" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed processing pairing request" },
      { status: 500 }
    );
  }
}
