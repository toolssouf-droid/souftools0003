export type ReasoningMode = "deep_thinking" | "deep_analysis" | "fast_mode" | "standard";

export interface ReasoningConfig {
  mode: ReasoningMode;
  systemInstructionAddon: string;
  temperature: number;
}

export function detectReasoningMode(activeTools: string[] = []): ReasoningMode {
  if (activeTools.includes("deep_thinking")) return "deep_thinking";
  if (activeTools.includes("deep_analysis")) return "deep_analysis";
  if (activeTools.includes("fast_mode")) return "fast_mode";
  return "standard";
}

export function getReasoningConfig(mode: ReasoningMode): ReasoningConfig {
  switch (mode) {
    case "deep_thinking":
      return {
        mode: "deep_thinking",
        temperature: 0.2, // Low temperature for maximum logic precision
        systemInstructionAddon: `
[توجيه استدلالي - تفكير عميق (Deep Thinking Engine)]
أنت الآن في وضع "التفكير العميق الاستدلالي (Deep Thinking)".
المستخدم يحتاج إلى تحليل منطقي دقيق واستدلال متسلسل خطوة بخطوة حل جميع التعقيدات والمشاكل المساندة.

يجب عليك تقسيم مخرجاتك تلقائياً إلى قسمين واضحين كالتالي:

1. خطوات الاستدلال الداخلي:
ضع خطوات التفكير المنطقي خطوة بخطوة داخل وسم <thinking_steps>:
<thinking_steps>
1. تفكيك السؤال وتحليل جميع المعطيات والافتراضات الأولى.
2. صياغة المنهجية والاستدلال المنطقي لمعالجة المشكلة.
3. اختبار الحلول البديلة واستبعاد الاحتمالات الخاطئة.
4. التحقق الرياضي أو البرمجي أو العلمي من صحة النتيجة.
</thinking_steps>

2. الإجابة النهائية المنظمة:
اكتب الإجابة الشاملة المنظمة والواضحة للمستخدم بعد وسم الإغلاق </thinking_steps>.
تأكد من الحفاظ على أقصى درجات الدقة باللغة العربية.`,
      };

    case "deep_analysis":
      return {
        mode: "deep_analysis",
        temperature: 0.35,
        systemInstructionAddon: `
[توجيه استدلالي - تحليل عميق (Deep Analysis Engine)]
أنت الآن في وضع "التحليل العميق والمقارنة الشاملة (Deep Analysis)".
قم بإجراء تحليل استراتيجي متعدد الأبعاد للموضوع، مع تقديم:

<thinking_steps>
1. تحديد المحركات والأسباب الجذرية.
2. بناء مصفوفة مقارنة ومزايا وسلبيات الجوانب المختلفة.
3. فحص المخاطر والتحديات والافتراضات المستقبلية.
4. صياغة التوصيات والحلول العملية الموصى بها.
</thinking_steps>

قدم الإجابة مدعومة بالجداول القابلة للقراءة والرؤى التحليلية العميقة المنظمة باللغة العربية.`,
      };

    case "fast_mode":
      return {
        mode: "fast_mode",
        temperature: 0.7,
        systemInstructionAddon: `
[توجيه استدلالي - الوضع السريع (Fast Mode Engine)]
أنت تعمل في "الوضع السريع (Fast Mode)".
أعطِ إجابة سريعة جداً، مباشرة، دقيقة وموجزة دون مقدمات طويلة أو جمل تمهيدية. اركز فوراً على الحل النهائي للمستخدم.`,
      };

    default:
      return {
        mode: "standard",
        temperature: 0.7,
        systemInstructionAddon: "",
      };
  }
}

export function parseReasoningResponse(text: string): {
  cleanText: string;
  reasoningSteps: string[];
} {
  let cleanText = text;
  const reasoningSteps: string[] = [];

  if (!text) return { cleanText: "", reasoningSteps: [] };

  // Match <thinking_steps>...</thinking_steps>
  const match = text.match(/<thinking_steps>([\s\S]*?)<\/thinking_steps>/i);
  if (match) {
    const stepsRaw = match[1].trim();
    cleanText = text.replace(/<thinking_steps>[\s\S]*?<\/thinking_steps>/gi, "").trim();

    const lines = stepsRaw.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const cleanLine = line.replace(/^[-*•\d+\.]+\s*/, "").trim();
      if (cleanLine) {
        reasoningSteps.push(cleanLine);
      }
    }
  }

  return { cleanText, reasoningSteps };
}
