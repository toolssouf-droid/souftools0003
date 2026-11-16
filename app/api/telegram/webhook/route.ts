import { NextRequest, NextResponse } from "next/server";
import { telegramManager } from "@/lib/telegram/telegramManager";

function updateServerBaseUrl(req: NextRequest) {
  try {
    const configuredBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (configuredBase) {
      telegramManager.setServerBaseUrl(configuredBase);
      return;
    }
    // Safe fallback to request origin without taking untrusted x-forwarded-host
    const origin = req.nextUrl.origin;
    if (origin && !origin.includes("localhost:0")) {
      telegramManager.setServerBaseUrl(origin);
    }
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    await telegramManager.ensureInitialized();
    // Enforce Telegram Webhook Secret Token Verification
    const configuredSecret =
      process.env.TELEGRAM_WEBHOOK_SECRET ||
      (telegramManager.getConfig().botToken
        ? "tg_sec_" + Buffer.from(telegramManager.getConfig().botToken.slice(0, 16)).toString("hex")
        : null);

    if (configuredSecret) {
      const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
      if (incomingSecret !== configuredSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized webhook token" }, { status: 401 });
      }
    }

    updateServerBaseUrl(req);
    const update = await req.json().catch(() => ({}));
    if (!update || Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, handled: false, note: "Empty ping received" });
    }
    
    // Process update in background / async
    const result = await telegramManager.processInboundMessage(update);
    await telegramManager.flushPendingWrites();

    return NextResponse.json({
      ok: true,
      handled: result.handled,
    });
  } catch (error: any) {
    console.error("Telegram Webhook Inbound Error:", error);
    // Return 200 to Telegram so it does not endlessly retry malformed payloads
    return NextResponse.json({ ok: true, error: error.message });
  }
}

export async function GET(req: NextRequest) {
  await telegramManager.ensureInitialized();
  updateServerBaseUrl(req);
  return NextResponse.json({
    status: "online",
    service: "SoufAI Telegram Webhook Gateway",
    timestamp: Date.now(),
    baseUrl: telegramManager.getBaseUrl(),
  });
}
