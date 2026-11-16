import { NextRequest, NextResponse } from "next/server";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

function updateServerBaseUrl(req: NextRequest) {
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host) {
      telegramManager.setServerBaseUrl(`${proto}://${host}`);
    }
  } catch {}
}

export async function GET(req: NextRequest) {
  try {
    await telegramManager.ensureInitialized();
    updateServerBaseUrl(req);
    const { searchParams } = new URL(req.url);
    const keyParam = searchParams.get("chatId") || searchParams.get("key");

    if (!keyParam) {
      return NextResponse.json(
        { success: false, error: "Missing chatId or key parameter" },
        { status: 400 }
      );
    }

    const resolvedChatId = telegramManager.resolveChatIdFromKey(keyParam);
    const details = telegramManager.getGmailDetails(resolvedChatId);

    return NextResponse.json({
      success: true,
      resolvedChatId,
      isConnected: !!details?.accessToken,
      email: details?.email || null,
      updatedAt: details?.updatedAt || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed fetching Telegram Gmail status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await telegramManager.ensureInitialized();
    updateServerBaseUrl(req);
    const body = await req.json().catch(() => ({}));
    const { action, chatId, key, accessToken, email, userId } = body;
    const targetKey = chatId || key;

    if (action === "disconnect") {
      const authUser = await resolveAuthUser(req);
      if (targetKey) {
        const resolved = telegramManager.resolveChatIdFromKey(targetKey);
        const paired = telegramManager.getPairedUser(resolved);
        const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";
        const isOwner =
          authUser &&
          ((paired?.userId && paired.userId === authUser.id) ||
            (paired?.email && authUser.email && paired.email.toLowerCase() === authUser.email.toLowerCase()));

        if (!isAdmin && !isOwner && paired) {
          return NextResponse.json(
            { success: false, error: "غير مصرح لك بفك ارتباط هذا الحساب" },
            { status: 403 }
          );
        }
        telegramManager.disconnectGmail(resolved);
        await telegramManager.flushPendingWrites();
      }
      return NextResponse.json({
        success: true,
        message: "Gmail account unlinked successfully from Telegram",
      });
    }

    if (!targetKey || !accessToken) {
      return NextResponse.json(
        { success: false, error: "Required fields missing: chatId (or key) and accessToken" },
        { status: 400 }
      );
    }

    const resolvedChatId = telegramManager.resolveChatIdFromKey(targetKey);
    await telegramManager.setGmailToken(resolvedChatId, accessToken, email, userId, true);
    await telegramManager.flushPendingWrites();

    return NextResponse.json({
      success: true,
      message: "Gmail connected successfully to Telegram bot",
      chatId: resolvedChatId,
      email: email || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed saving Gmail token for Telegram" },
      { status: 500 }
    );
  }
}
