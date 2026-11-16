import { NextRequest, NextResponse } from "next/server";
import { gmailSendTool } from "@/lib/agent/tools/gmailTools";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, subject, emailBody, token } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing Gmail token" }, { status: 401 });
    }

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const context = { gmailToken: token };
    const toolArgs = { to, subject, body: emailBody };

    const result = await gmailSendTool.execute(toolArgs, context);

    if (result.startsWith("Error:")) {
      return NextResponse.json({ error: result }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "تم الإرسال بنجاح" });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
