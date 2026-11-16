import { NextRequest, NextResponse } from "next/server";
import { whatsappManager } from "@/lib/whatsapp/whatsappManager";
import { resolveAuthUser } from "@/lib/auth/serverAuth";
import { WhatsAppPairedUsersRepository } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (code) {
      const status = whatsappManager.checkPairingCode(code);
      return NextResponse.json({
        success: true,
        isLinked: status.isLinked,
        phone: status.phone,
        user: status.user,
        botPhoneNumber: status.botPhoneNumber,
      });
    }

    // Check if the requesting logged-in user is already paired
    const authUser = await resolveAuthUser(req);
    let pairedData = null;
    if (authUser?.id) {
      pairedData = await WhatsAppPairedUsersRepository.getByUserId(authUser.id);
    }
    if (!pairedData && authUser?.email) {
      pairedData = await WhatsAppPairedUsersRepository.getByEmail(authUser.email);
    }

    const config = whatsappManager.getConfig();
    return NextResponse.json({
      success: true,
      isLinked: Boolean(pairedData),
      pairedPhone: pairedData?.phone || null,
      botPhoneNumber: config.connectedNumber || config.agentPhoneNumber || null,
      connectionStatus: config.connectionStatus,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed checking WhatsApp pairing status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, userId, firstName, phone, code } = body;

    const authUser = await resolveAuthUser(req);
    const targetEmail = email || authUser?.email || undefined;
    const targetUserId = userId || authUser?.id || undefined;
    const targetName = firstName || authUser?.name || undefined;

    if (action === "generate_code") {
      const pairInfo = whatsappManager.createPairingCode(targetEmail, targetUserId, targetName);
      return NextResponse.json({
        success: true,
        code: pairInfo.code,
        botPhoneNumber: pairInfo.botPhoneNumber,
        deepLink: pairInfo.deepLink,
      });
    }

    if (action === "unlink") {
      const target = phone || code || targetUserId || targetEmail;
      if (target) {
        await whatsappManager.unlinkUser(target);
      }
      return NextResponse.json({
        success: true,
        message: "تم إلغاء ربط حساب واتساب بنجاح",
      });
    }

    if (action === "status") {
      let pairedData = null;
      if (targetUserId) {
        pairedData = await WhatsAppPairedUsersRepository.getByUserId(targetUserId);
      }
      if (!pairedData && targetEmail) {
        pairedData = await WhatsAppPairedUsersRepository.getByEmail(targetEmail);
      }

      return NextResponse.json({
        success: true,
        isLinked: Boolean(pairedData),
        pairedPhone: pairedData?.phone || null,
        botPhoneNumber: whatsappManager.getConfig().connectedNumber || null,
      });
    }

    return NextResponse.json(
      { success: false, error: "إجراء غير معروف" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed processing WhatsApp pairing request" },
      { status: 500 }
    );
  }
}
