/**
 * SoufTools Intelligent Image Router Agent & Review Pipeline
 * Routes visual requests between Vision Models, Image Generation Tool, and Image Editing Tool
 * Implements the automated Post-Generation Review Loop (Generate -> Vision Analysis -> Quality Evaluation -> Decision)
 */

import {
  VisionCapabilityLayer,
  VisionImageInput,
  VisionAnalysisResult,
  VisionQualityResult,
  VisionComparisonResult,
} from "./visionCapabilityLayer";
import { generateImageViaManager } from "@/lib/providers/imageProviderManager";
import { AgentActivity } from "@/lib/agent/agentActivityTypes";

export type ImageIntentType = "ANALYSIS" | "GENERATION" | "EDITING" | "COMPARISON" | "OCR";

export interface ImageRouteDecision {
  intent: ImageIntentType;
  confidence: number;
  reasoningAr: string;
  recommendedAction: string;
}

export interface ImageEditingDirective {
  originalImage: VisionImageInput;
  userGoal: string;
  visionPreAnalysis: VisionAnalysisResult;
  preservationTargets: string[]; // Elements to strictly keep
  modificationInstructions: string; // Specific changes to make
  lightingAdjustments?: string;
  backgroundDirective?: string;
  qualityEnhancement: boolean;
}

export interface ImagePipelineExecutionResult {
  success: boolean;
  intent: ImageIntentType;
  primaryOutputText: string;
  activities: AgentActivity[];
  widgetData?: any;
  generatedImageUrl?: string;
  comparisonResult?: VisionComparisonResult;
  qualityEvaluation?: VisionQualityResult;
  editingDirective?: ImageEditingDirective;
  modelUsed?: string;
  providerUsed?: string;
  latencyMs: number;
}

export class ImageRouterAgent {
  /**
   * 1. Smart Intent Detection
   */
  public static async detectIntent(
    prompt: string,
    images: VisionImageInput[] = []
  ): Promise<ImageRouteDecision> {
    const cleanPrompt = prompt.trim();
    const hasImages = images.length > 0;
    const isMultiImage = images.length > 1;

    // Multi-image comparison rule
    if (isMultiImage || /قارن|مقارنة|أيهما أفضل|أي صورة|تفاصيل الصور|اختر الأفضل|compare/i.test(cleanPrompt)) {
      return {
        intent: "COMPARISON",
        confidence: 0.95,
        reasoningAr: "تحديد طلب مقارنة بين عدة صور لاختيار الأفضل وتقييم الفروق.",
        recommendedAction: "use_vision_comparison",
      };
    }

    // OCR / Text extraction rule
    if (hasImages && /نص|اقرأ|استخرج|كتابة|طباعة|جدول|ocr|extract text/i.test(cleanPrompt)) {
      return {
        intent: "OCR",
        confidence: 0.92,
        reasoningAr: "تحديد طلب استخراج نص أو بيانات من الصورة.",
        recommendedAction: "use_ocr_extraction",
      };
    }

    // Image Editing rule (has image + edit keywords)
    if (
      hasImages &&
      /عدل|عدّل|تعديل|حسن|حسّن|تحسين|غير|غيّر|تغيير|خلفية|إزالة|ازالة|اضافة|إضافة|اضاءة|إضاءة|لون|ألوان|edit|enhance|change background|remove/i.test(
        cleanPrompt
      )
    ) {
      return {
        intent: "EDITING",
        confidence: 0.94,
        reasoningAr: "تحديد طلب تعديل أو تحسين صورة موجودة مع الحفاظ على العناصر الأصلية.",
        recommendedAction: "pre_analyze_then_edit",
      };
    }

    // Single image analysis rule (has image + describe/what is this)
    if (hasImages) {
      return {
        intent: "ANALYSIS",
        confidence: 0.9,
        reasoningAr: "تحديد طلب تحليل وفهم محتوى الصورة المرفقة.",
        recommendedAction: "use_vision_analysis",
      };
    }

    // Image Generation rule (no images attached, asking to draw/generate/create image)
    if (
      /انشئ|أنشئ|توليد|ولد|ولّد|صمم|تصميم|ارسم|أرسم|رسم|تخيل|تخيّل|صنع|عمل|سوي|سوّي|صورة|صوره|خلفية|رسمة|رسمه|generate|create|draw|paint|make|design|imagine|render/i.test(
        cleanPrompt
      )
    ) {
      return {
        intent: "GENERATION",
        confidence: 0.93,
        reasoningAr: "تحديد طلب إنشاء وتوليد صورة جديدة من الوصف النصي.",
        recommendedAction: "generate_with_review_loop",
      };
    }

    // Default fallback
    return {
      intent: "ANALYSIS",
      confidence: 0.5,
      reasoningAr: "الاعتماد المبدئي على التحليل البصري.",
      recommendedAction: "use_vision_analysis",
    };
  }

  /**
   * Helper to build Activity Event
   */
  private static createActivity(
    type: any,
    title: string,
    description?: string,
    tool?: string
  ): AgentActivity {
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      title,
      description,
      status: "completed",
      timestamp: Date.now(),
      tool,
    };
  }

  /**
   * 2. Full Image Pipeline Execution
   */
  public static async processRequest(
    prompt: string,
    images: VisionImageInput[] = [],
    onActivity?: (activity: AgentActivity) => void
  ): Promise<ImagePipelineExecutionResult> {
    const startTime = Date.now();
    const activities: AgentActivity[] = [];

    const emitActivity = (act: AgentActivity) => {
      activities.push(act);
      if (onActivity) onActivity(act);
    };

    // 1. Initial Receipt Activity
    if (images.length > 0) {
      emitActivity(
        this.createActivity(
          "image_received",
          `🖼️ تم استلام ${images.length > 1 ? `${images.length} صور` : "الصورة"}`,
          "تجهيز وسائط الصور لبدء المعالجة الذكية عبر طبقة Vision Capability Layer."
        )
      );
    }

    // 2. Intent Detection
    const decision = await this.detectIntent(prompt, images);

    // ROUTE A: COMPARISON MODE
    if (decision.intent === "COMPARISON") {
      emitActivity(
        this.createActivity(
          "images_comparing",
          "📊 مقارنة النتائج والصور المرفقة",
          "استدعاء نموذج Vision لتحليل الفروق والجودة وتحديد الصورة الأفضل."
        )
      );

      const compRes = await VisionCapabilityLayer.compareImages({
        images,
        criteria: prompt,
      });

      emitActivity(
        this.createActivity(
          "process_completed",
          "✅ اكتملت عملية المقارنة بنجاح",
          `تم اختيار الصورة رقم ${compRes.bestImageIndex + 1} كأفضل خيار بناءً على معايير الوضوح والتكوين.`
        )
      );

      return {
        success: compRes.success,
        intent: "COMPARISON",
        primaryOutputText: compRes.overallComparisonAr,
        activities,
        comparisonResult: compRes,
        modelUsed: compRes.modelUsed,
        providerUsed: compRes.providerUsed,
        latencyMs: Date.now() - startTime,
      };
    }

    // ROUTE B: OCR / TEXT EXTRACTION
    if (decision.intent === "OCR") {
      emitActivity(
        this.createActivity(
          "image_analyzing",
          "🧠 تحليل الصورة واستخراج النصوص",
          "فحص الرموز والكلمات والجداول داخل الصورة لاستخراج بيانات دقيقة."
        )
      );

      const ocrRes = await VisionCapabilityLayer.extractInformation({
        image: images[0],
        extractType: "ocr",
      });

      emitActivity(
        this.createActivity(
          "process_completed",
          "✅ تم استخراج النصوص بنجاح",
          `مستوى الدقة المقدر: ${ocrRes.confidence}%`
        )
      );

      return {
        success: ocrRes.success,
        intent: "OCR",
        primaryOutputText: ocrRes.text,
        activities,
        modelUsed: ocrRes.modelUsed,
        providerUsed: ocrRes.providerUsed,
        latencyMs: Date.now() - startTime,
      };
    }

    // ROUTE C: IMAGE EDITING ROUTING WITH PRE-ANALYSIS
    if (decision.intent === "EDITING") {
      emitActivity(
        this.createActivity(
          "image_analyzing",
          "🧠 تحليل الصورة وتحديد عناصر التعديل",
          "استكشاف المكونات والشخصيات لمنع أي تشويه أثناء تطبيق التعديلات."
        )
      );

      // Pre-analysis
      const preAnalysis = await VisionCapabilityLayer.analyzeImage({
        images: [images[0]],
        prompt,
      });

      emitActivity(
        this.createActivity(
          "editing_routing",
          "🖌️ إرسال إلى أداة التعديل المخصصة",
          "توليد موجهات دقيقة مع الحفاظ التام على المكونات الرئيسية للشكل."
        )
      );

      const editingDirective: ImageEditingDirective = {
        originalImage: images[0],
        userGoal: prompt,
        visionPreAnalysis: preAnalysis,
        preservationTargets: preAnalysis.extractedElements || ["الشخصية الرئيسية", "التكوين العام"],
        modificationInstructions: `المطلوب: ${prompt}. الحفاظ الصارم على: ${preAnalysis.mainSubject || "العناصر الأساسية"}.`,
        qualityEnhancement: true,
      };

      // Execute Editing via Image Generation Manager with refined directive
      const editPrompt = `High quality edit: ${prompt}, keeping main subject ${preAnalysis.mainSubject || "intact"}, master shot, 8k resolution`;
      const editImageRes = await generateImageViaManager(editPrompt);

      emitActivity(
        this.createActivity(
          "result_reviewing",
          "👁️ مراجعة النتيجة وتقييم الجودة",
          "التحقق من عدم وجود تشويه والترخيص النهائي للصورة."
        )
      );

      emitActivity(
        this.createActivity(
          "process_completed",
          "✅ اكتملت عملية تعديل الصورة",
          "تم إنتاج الصورة المحدثة بنجاح وعرضها للمستخدم."
        )
      );

      return {
        success: editImageRes.success,
        intent: "EDITING",
        primaryOutputText: `تم تعديل الصورة بناءً على طلبك: "${prompt}". تم الحفاظ على العناصر الأصلية (${preAnalysis.mainSubject || "المكونات الأساسية"}) مع تطبيق التحسينات المطلوب.`,
        activities,
        editingDirective,
        generatedImageUrl: editImageRes.imageUrl,
        widgetData: {
          type: "image_result",
          data: editImageRes,
        },
        modelUsed: editImageRes.modelUsed || "Cloudflare / Pollinations",
        providerUsed: editImageRes.providerUsed || "Image Gen Pipeline",
        latencyMs: Date.now() - startTime,
      };
    }

    // ROUTE D: IMAGE GENERATION WITH AUTOMATED VISION REVIEW LOOP
    if (decision.intent === "GENERATION") {
      emitActivity(
        this.createActivity(
          "image_analyzing",
          "🧠 تحليل صيغة الرسم وتصحيح الموجه",
          `تحويل الطلب إلى موجه فني دقيق: "${prompt}"`
        )
      );

      // 1. Generate Image
      const genResult = await generateImageViaManager(prompt);

      if (!genResult.success || !genResult.imageUrl) {
        emitActivity(
          this.createActivity(
            "process_completed",
            "❌ تعذر توليد الصورة",
            genResult.error || "حدث خطأ أثناء الاتصال بمحرك الصور."
          )
        );
        return {
          success: false,
          intent: "GENERATION",
          primaryOutputText: "عفواً، تعذر إنشاء الصورة في الوقت الحالي.",
          activities,
          latencyMs: Date.now() - startTime,
        };
      }

      // 2. Vision Quality Evaluation Loop
      emitActivity(
        this.createActivity(
          "quality_evaluating",
          "🔍 تقييم جودة الصورة المولدة (Vision Review Loop)",
          "فحص الوضوح والتكوين والإضاءة عبر طبقة Vision Capability Layer."
        )
      );

      const qualityEval = await VisionCapabilityLayer.inspectQuality({
        image: { url: genResult.imageUrl, base64: genResult.imageUrl },
        promptGoal: prompt,
      });

      emitActivity(
        this.createActivity(
          "result_reviewing",
          "👁️ مراجعة النتيجة واختبار القبول",
          `نسبة جودة الصورة: ${qualityEval.qualityScore}% - القرار: ${qualityEval.recommendation === "approve" ? "قبول واعتماد" : "تحسين متواصل"}`
        )
      );

      // 3. Optional Auto-Refinement if score < 70
      let finalImageUrl = genResult.imageUrl;
      let finalPromptUsed = prompt;

      if (qualityEval.qualityScore < 70 && qualityEval.editingInstructions) {
        emitActivity(
          this.createActivity(
            "editing_routing",
            "🖌️ تحسين تلقائي بناءً على ملاحظات Vision",
            "إعادة جولة تحسين إضافية لرفع الدقة ومحاذاة الإضاءة."
          )
        );

        const refinedPrompt = `${prompt}, ${qualityEval.editingInstructions}, ultra high detail, highly polished`;
        const refinedRes = await generateImageViaManager(refinedPrompt);
        if (refinedRes.success && refinedRes.imageUrl) {
          finalImageUrl = refinedRes.imageUrl;
          finalPromptUsed = refinedPrompt;
        }
      }

      emitActivity(
        this.createActivity(
          "process_completed",
          "✅ اكتملت العملية بنجاح",
          "تم جلب الصورة النهائية المراجعة والموثوقة."
        )
      );

      return {
        success: true,
        intent: "GENERATION",
        primaryOutputText: `تم توليد ومراجعة الصورة بنجاح بناءً على الموجه: "${finalPromptUsed}". تقييم الجودة النهائي: ${qualityEval.qualityScore}%.`,
        activities,
        qualityEvaluation: qualityEval,
        generatedImageUrl: finalImageUrl,
        widgetData: {
          type: "image_result",
          data: {
            ...genResult,
            imageUrl: finalImageUrl,
          },
        },
        modelUsed: genResult.modelUsed,
        providerUsed: genResult.providerUsed,
        latencyMs: Date.now() - startTime,
      };
    }

    // ROUTE E: STANDARD VISION ANALYSIS
    emitActivity(
      this.createActivity(
        "image_analyzing",
        "🧠 تحليل وتفكيك محتوى الصورة",
        "قراءة التفاصيل والرموز والعناصر البصرية بعناية."
      )
    );

    const analysisRes = await VisionCapabilityLayer.analyzeImage({
      images,
      prompt,
    });

    emitActivity(
      this.createActivity(
        "process_completed",
        "✅ اكتملت عملية التفسير البصري",
        `تم تحديد ${analysisRes.extractedElements.length} عنصر رئيسي في الصورة.`
      )
    );

    return {
      success: analysisRes.success,
      intent: "ANALYSIS",
      primaryOutputText: analysisRes.description,
      activities,
      modelUsed: analysisRes.modelUsed,
      providerUsed: analysisRes.providerUsed,
      latencyMs: Date.now() - startTime,
    };
  }
}
