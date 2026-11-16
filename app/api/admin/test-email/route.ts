import { NextRequest, NextResponse } from "next/server";
import { generateVerificationOtp, sendVerificationEmail } from "@/lib/auth/emailService";
import { loadServerAdminConfig, updateInMemoryAdminConfig } from "@/lib/adminConfigStore";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { targetEmail, smtpUser, smtpPass, smtpHost, smtpPort, resendApiKey } = body;

    const emailToTest = (targetEmail || "souftoolsai@gmail.com").toLowerCase().trim();

    // If custom SMTP credentials were submitted with the test, temporarily set them in config
    if (smtpUser || smtpPass || resendApiKey) {
      updateInMemoryAdminConfig({
        emailSettings: {
          ...(smtpUser ? { smtpUser } : {}),
          ...(smtpPass ? { smtpPass } : {}),
          ...(smtpHost ? { smtpHost } : {}),
          ...(smtpPort ? { smtpPort: Number(smtpPort) } : {}),
          ...(resendApiKey ? { resendApiKey } : {}),
        },
      });
    }

    const config = await loadServerAdminConfig();
    const testCode = generateVerificationOtp(emailToTest);

    const result = await sendVerificationEmail({
      toEmail: emailToTest,
      code: testCode,
      type: "verification",
      userName: "مسؤول المنصة",
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `تم إرسال رسالة تجريبية بنجاح إلى (${emailToTest})!`,
        engineUsed: result.engineUsed,
        messageId: result.messageId,
        testCode,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "فشل إرسال البريد الإلكتروني. يرجى التحقق من إعدادات SMTP وكلمة مرور التطبيقات.",
          engineUsed: result.engineUsed,
          emailSettings: {
            smtpHost: config.emailSettings?.smtpHost,
            smtpPort: config.emailSettings?.smtpPort,
            smtpUser: config.emailSettings?.smtpUser,
            hasPass: !!config.emailSettings?.smtpPass,
            hasResendKey: !!config.emailSettings?.resendApiKey,
          },
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("Test Email API Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "حدث خطأ غير متوقع أثناء إرسال البريد التجريبي." },
      { status: 500 }
    );
  }
}
