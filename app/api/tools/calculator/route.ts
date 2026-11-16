import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rateCheck = checkRateLimit(`calc_${ip}`, 60, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "تم تجاوز حد العمليات الحسابية المسموح" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const expression = body?.expression;
    if (!expression || typeof expression !== "string" || expression.trim().length === 0) {
      return NextResponse.json({ error: "الرجاء إدخال تعبير رياضي صالح" }, { status: 400 });
    }

    if (expression.length > 500) {
      return NextResponse.json({ error: "التعبير الرياضي طويل جداً" }, { status: 400 });
    }

    // Convert Eastern Arabic numerals (٠-٩) and Persian numerals to Western digits (0-9)
    let normalized = expression
      .replace(/[٠۰]/g, "0")
      .replace(/[١۱]/g, "1")
      .replace(/[٢۲]/g, "2")
      .replace(/[٣۳]/g, "3")
      .replace(/[٤۴]/g, "4")
      .replace(/[٥۵]/g, "5")
      .replace(/[٦۶]/g, "6")
      .replace(/[٧۷]/g, "7")
      .replace(/[٨۸]/g, "8")
      .replace(/[٩۹]/g, "9")
      // Normalize arithmetic symbols
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/[−–—]/g, "-")
      .replace(/،/g, ".")
      .replace(/\^/g, "**")
      .replace(/(\d+(\.\d+)?)\s*%/g, "($1 * 0.01)")
      .replace(/\bln\(/gi, "log(");

    // Strictly forbidden keywords to completely prevent code execution & prototype pollution
    const forbidden = ["constructor", "prototype", "__proto__", "import", "eval", "global", "process", "window", "document", "Function", "return", "this", "var", "let", "const", "class"];
    for (const word of forbidden) {
      if (normalized.toLowerCase().includes(word.toLowerCase())) {
        return NextResponse.json({ error: "التعبير يحتوي على كلمات برمجية محظورة" }, { status: 400 });
      }
    }

    // Clean expression to only allow arithmetic tokens, digits, and whitelisted safe Math functions
    const sanitized = normalized.replace(/[^0-9+\-*\/().\s%a-zA-Z]/g, "");

    // Verify all identifiers are exclusively approved mathematical operations
    const identifiers = sanitized.match(/[a-zA-Z]+/g) || [];
    const allowedIdentifiers = new Set([
      "sqrt", "cbrt", "abs", "sin", "cos", "tan", "log", "pow", "round", 
      "floor", "ceil", "min", "max", "exp", "PI", "E", "Math"
    ]);

    for (const id of identifiers) {
      if (!allowedIdentifiers.has(id)) {
        return NextResponse.json({ error: `الدالة أو الرمز الرياضي '${id}' غير مدعوم` }, { status: 400 });
      }
    }

    // Safe mathematical evaluation in hardened scope (avoiding forbidden 'with' in strict mode)
    let result: number;
    try {
      const fn = new Function(
        "sqrt", "cbrt", "abs", "sin", "cos", "tan", "log", "pow", "round", 
        "floor", "ceil", "min", "max", "exp", "PI", "E",
        `"use strict"; return (${sanitized});`
      );
      result = fn(
        Math.sqrt, Math.cbrt, Math.abs, Math.sin, Math.cos, Math.tan, Math.log, 
        Math.pow, Math.round, Math.floor, Math.ceil, Math.min, Math.max, 
        Math.exp, Math.PI, Math.E
      );
      if (typeof result !== "number" || !Number.isFinite(result)) {
        if (Number.isNaN(result)) throw new Error("NaN");
        result = 0;
      }
    } catch {
      return NextResponse.json({ error: "تعبير رياضي غير صالح أو غير مدعوم" }, { status: 400 });
    }

    return NextResponse.json({
      expression,
      result,
      formatted: Number.isFinite(result) ? result.toLocaleString("ar-EG") : String(result),
    });
  } catch {
    return NextResponse.json({ error: "حدث خطأ أثناء إجراء الحساب" }, { status: 500 });
  }
}
