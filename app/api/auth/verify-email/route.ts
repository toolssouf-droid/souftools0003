import { NextRequest, NextResponse } from "next/server";
import { generateVerificationOtp, sendVerificationEmail, verifyOtpCode, consumeOtpCode } from "@/lib/auth/emailService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, email, code, userName, type } = body;

    const cleanEmail = (email || "").toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "يرجى إدخال بريد إلكتروني صحيح." },
        { status: 400 }
      );
    }

    // Action 1: Send OTP code to email
    if (action === "send_otp") {
      const otpCode = generateVerificationOtp(cleanEmail);
      const sendResult = await sendVerificationEmail({
        toEmail: cleanEmail,
        code: otpCode,
        type: type || "verification",
        userName: userName || cleanEmail.split("@")[0],
      });

      if (!sendResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: sendResult.error || "فشل إرسال رمز التحقق إلى البريد الإلكتروني. يرجى التحقق من إعدادات البريد.",
            engineUsed: sendResult.engineUsed,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.",
        engineUsed: sendResult.engineUsed,
        messageId: sendResult.messageId,
      });
    }

    // Action 2: Verify code entered by user
    if (action === "verify_otp") {
      if (!code || typeof code !== "string" || code.trim().length < 6) {
        return NextResponse.json(
          { success: false, error: "يرجى إدخال رمز التحقق المكون من 6 أرقام." },
          { status: 400 }
        );
      }

      const verifyResult = await verifyOtpCode(cleanEmail, code);
      if (!verifyResult.valid) {
        return NextResponse.json(
          { success: false, error: verifyResult.reason || "رمز التحقق غير صحيح." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "تم التحقق من البريد الإلكتروني وتأكيده بنجاح!",
        verifiedEmail: cleanEmail,
      });
    }

    // Action 3: Consume code once user account registration is successfully finished
    if (action === "consume_otp") {
      await consumeOtpCode(cleanEmail);
      return NextResponse.json({
        success: true,
        message: "تم استهلاك رمز التحقق بنجاح.",
      });
    }

    return NextResponse.json(
      { success: false, error: "إجراء غير معروف." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Verification API Error:", err);
    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء معالجة طلب التحقق." },
      { status: 500 }
    );
  }
}
