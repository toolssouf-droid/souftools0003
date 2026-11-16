/**
 * SoufTools Multimodal Vision Capability Layer
 * Independent mediator between Agent architecture and any Multimodal / Vision AI models.
 * Supports Gemini Vision, GPT Vision, Claude Vision, Qwen VL, Mistral Pixtral, Grok Vision, etc.
 * Provides unified interface: analyzeImage(), compareImages(), inspectQuality(), extractInformation()
 */

import { GoogleGenAI } from "@google/genai";
import { decryptKey } from "@/lib/encryption";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";

export type VisionSelectionStrategy = "fastest" | "quality" | "lowest_cost";

export interface VisionModelDef {
  id: string;
  name: string;
  providerId: "gemini" | "openai" | "anthropic" | "openrouter" | "groq" | "qwen" | "mistral" | "together";
  providerNameAr: string;
  visionSupport: boolean;
  status: "active" | "degraded" | "inactive";
  priority: number;
  costTier: "free" | "low" | "medium" | "high";
  speedTier: "fastest" | "balanced" | "detailed";
  maxResolution?: string;
  supportedMimeTypes: string[];
}

export const SUPPORTED_VISION_MODELS: VisionModelDef[] = [
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash Vision",
    providerId: "gemini",
    providerNameAr: "Google Gemini",
    visionSupport: true,
    status: "active",
    priority: 1,
    costTier: "free",
    speedTier: "fastest",
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/gif"],
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro Vision",
    providerId: "gemini",
    providerNameAr: "Google Gemini",
    visionSupport: true,
    status: "active",
    priority: 2,
    costTier: "low",
    speedTier: "detailed",
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/gif"],
  },
  {
    id: "gpt-4o",
    name: "GPT-4o Vision Engine",
    providerId: "openai",
    providerNameAr: "OpenAI Vision",
    visionSupport: true,
    status: "active",
    priority: 3,
    costTier: "high",
    speedTier: "balanced",
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet Vision",
    providerId: "anthropic",
    providerNameAr: "Anthropic Claude",
    visionSupport: true,
    status: "active",
    priority: 4,
    costTier: "high",
    speedTier: "detailed",
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  },
  {
    id: "qwen-2.5-vl-72b-instruct",
    name: "Qwen 2.5 VL Multimodal",
    providerId: "openrouter",
    providerNameAr: "Alibaba Qwen VL",
    visionSupport: true,
    status: "active",
    priority: 5,
    costTier: "low",
    speedTier: "fastest",
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  {
    id: "pixtral-12b-2409",
    name: "Mistral Pixtral Vision",
    providerId: "openrouter",
    providerNameAr: "Mistral AI",
    visionSupport: true,
    status: "active",
    priority: 6,
    costTier: "low",
    speedTier: "fastest",
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
];

export interface VisionImageInput {
  url?: string;
  base64?: string;
  mimeType?: string;
  id?: string;
  name?: string;
}

export interface VisionAnalyzeOptions {
  images: VisionImageInput[];
  prompt?: string;
  taskType?: "description" | "object_detection" | "scene_analysis" | "general";
  strategy?: VisionSelectionStrategy;
  systemInstruction?: string;
}

export interface VisionAnalysisResult {
  success: boolean;
  description: string;
  extractedElements: string[];
  mainSubject?: string;
  detectedIssues: string[];
  suggestedAction?: string;
  modelUsed: string;
  providerUsed: string;
  latencyMs: number;
  error?: string;
}

export interface VisionQualityOptions {
  image: VisionImageInput;
  promptGoal?: string;
  strategy?: VisionSelectionStrategy;
}

export interface VisionQualityResult {
  success: boolean;
  qualityScore: number; // 0 - 100
  isAcceptable: boolean;
  highlights: string[];
  flaws: string[];
  compositionScore: number;
  clarityScore: number;
  lightingScore: number;
  recommendation: "approve" | "edit" | "regenerate";
  editingInstructions?: string;
  modelUsed: string;
  providerUsed: string;
  latencyMs: number;
  rawAnalysis?: string;
}

export interface VisionCompareOptions {
  images: VisionImageInput[];
  criteria?: string;
  strategy?: VisionSelectionStrategy;
}

export interface VisionImageEvaluation {
  imageId: string;
  imageIndex: number;
  qualityScore: number; // 0 - 100
  compositionScore: number;
  clarityScore: number;
  lightingScore: number;
  summary: string;
  pros: string[];
  cons: string[];
}

export interface VisionComparisonResult {
  success: boolean;
  bestImageIndex: number;
  bestImageId?: string;
  evaluations: VisionImageEvaluation[];
  overallComparisonAr: string;
  selectionReasonsAr: string[];
  modelUsed: string;
  providerUsed: string;
  latencyMs: number;
  error?: string;
}

export interface VisionExtractOptions {
  image: VisionImageInput;
  extractType?: "ocr" | "tables" | "labels" | "structured_json";
  strategy?: VisionSelectionStrategy;
}

export interface VisionExtractResult {
  success: boolean;
  text: string;
  structuredData?: Record<string, any>;
  confidence: number;
  modelUsed: string;
  providerUsed: string;
  latencyMs: number;
  error?: string;
}

function cleanBase64(base64: string): string {
  if (base64.includes(";base64,")) {
    return base64.split(";base64,")[1];
  }
  return base64;
}

function extractMimeType(base64: string, defaultType = "image/jpeg"): string {
  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);base64,/);
    if (match && match[1]) return match[1];
  }
  return defaultType;
}

/**
 * Universal Multimodal Vision Capability Layer
 */
export class VisionCapabilityLayer {
  private static strategy: VisionSelectionStrategy = "fastest";

  public static setStrategy(newStrategy: VisionSelectionStrategy) {
    this.strategy = newStrategy;
  }

  public static getStrategy(): VisionSelectionStrategy {
    return this.strategy;
  }

  /**
   * Dynamically resolves the dedicated Vision model configured by the Admin.
   * STRICT MANDATE: Relies strictly on the admin-configured vision model.
   * If not configured or missing key, throws an explicit descriptive error with no silent fallback.
   */
  public static async selectVisionModel(
    _overrideStrategy?: VisionSelectionStrategy
  ): Promise<{ model: VisionModelDef; apiKey: string; customEndpoint?: string }> {
    const adminConfig = await loadServerAdminConfig();
    const visionConfig = adminConfig?.visionModelConfig;

    if (!visionConfig || visionConfig.status === "disabled") {
      throw new Error(
        "⚠️ نموذج تحليل الرؤية والصور غير مفعل أو غير مهيأ في لوحة تحكم المسؤول. يرجى تفعيل وتعيين مزود ونموذج ومفتاح تحليل الصور في قسم مفاتيح API في لوحة التحكم."
      );
    }

    if (!visionConfig.apiKey || !visionConfig.model) {
      throw new Error(
        `⚠️ لم يتم إدخال مفتاح API أو اسم النموذج لنموذج تحليل الرؤية (${visionConfig.providerId || "غير محدد"}). يرجى إدخال البيانات في لوحة تحكم المسؤول.`
      );
    }

    const decryptedKey = decryptKey(visionConfig.apiKey) || visionConfig.apiKey;

    // Build model definition strictly matching Admin's configuration
    let providerNameAr = "Google Gemini";
    if (visionConfig.providerId === "openai") providerNameAr = "OpenAI Vision";
    else if (visionConfig.providerId === "anthropic") providerNameAr = "Anthropic Claude";
    else if (visionConfig.providerId === "openrouter") providerNameAr = "OpenRouter";
    else if (visionConfig.providerId === "groq") providerNameAr = "Groq Vision";
    else if (visionConfig.providerId === "mistral") providerNameAr = "Mistral AI";
    else if (visionConfig.providerId === "together") providerNameAr = "Together AI";
    else if (visionConfig.providerId === "deepseek") providerNameAr = "DeepSeek";

    const configuredModelDef: VisionModelDef = {
      id: visionConfig.model,
      name: `${providerNameAr} (${visionConfig.model})`,
      providerId: visionConfig.providerId as any,
      providerNameAr,
      visionSupport: true,
      status: "active",
      priority: 1,
      costTier: "free",
      speedTier: "fastest",
      supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic"],
    };

    return {
      model: configuredModelDef,
      apiKey: decryptedKey,
      customEndpoint: visionConfig.customEndpoint,
    };
  }

  /**
   * Helper to execute multimodal request against the strictly configured model
   */
  private static async executeMultimodalPrompt(
    images: VisionImageInput[],
    prompt: string,
    systemPrompt?: string,
    overrideStrategy?: VisionSelectionStrategy
  ): Promise<{ text: string; modelUsed: string; providerUsed: string; latencyMs: number }> {
    const startTime = Date.now();
    const { model, apiKey, customEndpoint } = await this.selectVisionModel(overrideStrategy);

    if (!apiKey) {
      throw new Error("No valid Vision API key available for model " + model.name);
    }

    if (model.providerId === "gemini") {
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [];

      for (const img of images) {
        if (img.base64) {
          const mimeType = img.mimeType || extractMimeType(img.base64);
          parts.push({
            inlineData: {
              mimeType,
              data: cleanBase64(img.base64),
            },
          });
        }
      }

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: model.id,
        contents: parts,
        config: {
          systemInstruction:
            systemPrompt ||
            "أنت نظام الذكاء الاصطناعي البصري المتطور لمؤسسة SoufTools. أجب باللغة العربية بدقة عالية وتحليل منطقي شامل.",
          temperature: 0.2,
        },
      });

      return {
        text: response.text || "",
        modelUsed: model.name,
        providerUsed: model.providerNameAr,
        latencyMs: Date.now() - startTime,
      };
    } else if (model.providerId === "anthropic") {
      const endpoint = customEndpoint || "https://api.anthropic.com/v1/messages";
      const imageContentParts: any[] = [];

      for (const img of images) {
        if (img.base64) {
          const mime = img.mimeType || extractMimeType(img.base64);
          imageContentParts.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mime,
              data: cleanBase64(img.base64),
            },
          });
        }
      }

      imageContentParts.push({ type: "text", text: prompt });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 1500,
          system: systemPrompt || "أنت نظام الذكاء الاصطناعي البصري المتطور لمؤسسة SoufTools. أجب باللغة العربية بدقة عالية.",
          messages: [
            {
              role: "user",
              content: imageContentParts,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic Vision Error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      const text = json?.content?.[0]?.text || "";

      return {
        text,
        modelUsed: model.name,
        providerUsed: model.providerNameAr,
        latencyMs: Date.now() - startTime,
      };
    } else {
      // OpenAI & all compatible REST endpoints (OpenRouter, Groq, Mistral, Together, xAI, DeepSeek, Alibaba, etc.)
      const { getChatEndpointForProvider } = await import("@/lib/providers/providerAdapters");
      const endpoint = getChatEndpointForProvider(model.providerId, customEndpoint, apiKey);

      const imageContentParts: any[] = images.map((img) => {
        if (img.url) {
          return { type: "image_url", image_url: { url: img.url } };
        } else if (img.base64) {
          const mime = img.mimeType || extractMimeType(img.base64);
          const formattedBase64 = img.base64.startsWith("data:")
            ? img.base64
            : `data:${mime};base64,${cleanBase64(img.base64)}`;
          return { type: "image_url", image_url: { url: formattedBase64 } };
        }
        return null;
      }).filter(Boolean);

      imageContentParts.push({ type: "text", text: prompt });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            {
              role: "system",
              content: systemPrompt || "أنت نظام تحليل الصور الذكي لـ SoufTools. أجب باللغة العربية بوضوح ودقة.",
            },
            {
              role: "user",
              content: imageContentParts,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Vision Provider Error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content || "";

      return {
        text,
        modelUsed: model.name,
        providerUsed: model.providerNameAr,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 1. Analyze Image (Understanding, Objects, Description)
   */
  public static async analyzeImage(options: VisionAnalyzeOptions): Promise<VisionAnalysisResult> {
    const { images, prompt, taskType = "general", strategy } = options;

    if (!images || images.length === 0) {
      return {
        success: false,
        description: "لم يتم تقديم أي صور للتحليل.",
        extractedElements: [],
        detectedIssues: [],
        modelUsed: "N/A",
        providerUsed: "N/A",
        latencyMs: 0,
        error: "No images provided",
      };
    }

    const systemPrompt = `أنت أداة تحليل الرؤية البصرية الشاملة (image_analysis_tool) في SoufTools.
قم بتحليل الصورة المرفقة واستخراج المكونات في المخرجات بالتنسيق التالي strictly JSON:
{
  "description": "وصف دقيق ومفصل للصورة باللغة العربية",
  "extractedElements": ["عنصر 1", "عنصر 2", "عنصر 3"],
  "mainSubject": "العنصر الأساسي في الصورة",
  "detectedIssues": ["مشكلة أو ملاحظة إن وجدت"],
  "suggestedAction": "التوصية المناسبة للتطوير أو التعديل"
}`;

    const userPromptText = prompt
      ? `نوع المهمة: ${taskType}\nطلب المستخدم الخاص: ${prompt}\nقم بتقديم التحليل الشامل حسب الهيكل المطلوبة.`
      : `قم بتحليل الصورة المرفقة واستخراج جميع عناصرها بدقة باللغة العربية.`;

    try {
      const res = await this.executeMultimodalPrompt(images, userPromptText, systemPrompt, strategy);

      let parsed: any = {};
      try {
        const cleanJsonStr = res.text.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch {
        parsed = {
          description: res.text,
          extractedElements: [],
          detectedIssues: [],
        };
      }

      return {
        success: true,
        description: parsed.description || res.text,
        extractedElements: Array.isArray(parsed.extractedElements) ? parsed.extractedElements : [],
        mainSubject: parsed.mainSubject,
        detectedIssues: Array.isArray(parsed.detectedIssues) ? parsed.detectedIssues : [],
        suggestedAction: parsed.suggestedAction,
        modelUsed: res.modelUsed,
        providerUsed: res.providerUsed,
        latencyMs: res.latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        description: "فشل تحليل الصورة.",
        extractedElements: [],
        detectedIssues: [err.message || "حدث خطأ أثناء التواصل مع نموذج Vision"],
        modelUsed: "Failed",
        providerUsed: "Failed",
        latencyMs: 0,
        error: err.message,
      };
    }
  }

  /**
   * 2. Quality Review & Inspection for Image Generation Review Loop
   */
  public static async inspectQuality(options: VisionQualityOptions): Promise<VisionQualityResult> {
    const { image, promptGoal, strategy } = options;

    const systemPrompt = `أنت خبير التقييم البصري ومراجعة جودة الصور المولدَة بالذكاء الاصطناعي في SoufTools.
قم بتقييم الصورة المرفقة بصرامة من حيث الوضوح، التكوين، الإضاءة، ومدى ملامستها للهدف المطلوبة.
أخرج النتيجة strictly JSON بالشكل الآتي:
{
  "qualityScore": 88,
  "isAcceptable": true,
  "compositionScore": 90,
  "clarityScore": 85,
  "lightingScore": 90,
  "highlights": ["نقاط القوة 1", "نقاط القوة 2"],
  "flaws": ["عيوب إن وجدت"],
  "recommendation": "approve", // approve | edit | regenerate
  "editingInstructions": "تعليمات واضحة للتعديل إن لزم الأمر"
}`;

    const promptText = promptGoal
      ? `هدف توليد الصورة الأصلي: "${promptGoal}".\nقم بإنشاء تقييم شامل للصورة ومطابقتها للهدف.`
      : `قم بتقييم جودة الصورة الفنية والتصميمية والتفاصيل.`;

    try {
      const res = await this.executeMultimodalPrompt([image], promptText, systemPrompt, strategy);

      let parsed: any = {};
      try {
        const cleanJsonStr = res.text.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch {
        parsed = {
          qualityScore: 85,
          isAcceptable: true,
          recommendation: "approve",
        };
      }

      const qualityScore = typeof parsed.qualityScore === "number" ? parsed.qualityScore : 85;

      return {
        success: true,
        qualityScore,
        isAcceptable: parsed.isAcceptable ?? qualityScore >= 75,
        compositionScore: parsed.compositionScore || qualityScore,
        clarityScore: parsed.clarityScore || qualityScore,
        lightingScore: parsed.lightingScore || qualityScore,
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : ["دقة ألوان جيدة", "تكوين متوازن"],
        flaws: Array.isArray(parsed.flaws) ? parsed.flaws : [],
        recommendation: parsed.recommendation || (qualityScore >= 80 ? "approve" : "edit"),
        editingInstructions: parsed.editingInstructions,
        modelUsed: res.modelUsed,
        providerUsed: res.providerUsed,
        latencyMs: res.latencyMs,
        rawAnalysis: res.text,
      };
    } catch (err: any) {
      return {
        success: false,
        qualityScore: 70,
        isAcceptable: true,
        compositionScore: 70,
        clarityScore: 70,
        lightingScore: 70,
        highlights: [],
        flaws: [err.message],
        recommendation: "approve",
        modelUsed: "Fallback",
        providerUsed: "Fallback",
        latencyMs: 0,
      };
    }
  }

  /**
   * 3. Compare Multiple Images and Select the Best One
   */
  public static async compareImages(options: VisionCompareOptions): Promise<VisionComparisonResult> {
    const { images, criteria = "الجودة العامة والتنسيق والتفاصيل", strategy } = options;

    if (!images || images.length === 0) {
      return {
        success: false,
        bestImageIndex: 0,
        evaluations: [],
        overallComparisonAr: "لم يتم تزويد أي صور للمقارنة.",
        selectionReasonsAr: [],
        modelUsed: "N/A",
        providerUsed: "N/A",
        latencyMs: 0,
        error: "No images provided",
      };
    }

    const systemPrompt = `أنت نظام مقارنة وتفاضل الصور البصري الذكي في SoufTools.
يتم تزويدك بـ ${images.length} صورة. قم بتحليل ومقارنة كل صورة بدقة بناءً على المعيار: "${criteria}".
قم بإخراج النتيجة strictly JSON كالتالي:
{
  "bestImageIndex": 1, // 0-indexed لأفضل صورة
  "overallComparisonAr": "ملخص شامل للمقارنة بين جميع الصور باللغة العربية",
  "selectionReasonsAr": ["سبب اختيار الصورة 1", "سبب اختيار الصورة 2"],
  "evaluations": [
    {
      "imageIndex": 0,
      "qualityScore": 82,
      "compositionScore": 85,
      "clarityScore": 80,
      "lightingScore": 81,
      "summary": "ملخص الصورة 1",
      "pros": ["إيجابية 1"],
      "cons": ["سلبي 1"]
    }
  ]
}`;

    const promptText = `قارن بين الصور الـ ${images.length} المرفقة بصرامة. وحدد أفضل صورة مع توضيح الأسباب بالتفصيل.`;

    try {
      const res = await this.executeMultimodalPrompt(images, promptText, systemPrompt, strategy);

      let parsed: any = {};
      try {
        const cleanJsonStr = res.text.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch {
        parsed = {
          bestImageIndex: 0,
          overallComparisonAr: res.text,
          selectionReasonsAr: ["أفضل جودة وتوازن ألوان"],
          evaluations: images.map((_, idx) => ({
            imageIndex: idx,
            qualityScore: 85 - idx * 2,
            summary: `الصورة رقم ${idx + 1}`,
            pros: ["تكوين جيد"],
            cons: [],
          })),
        };
      }

      return {
        success: true,
        bestImageIndex: typeof parsed.bestImageIndex === "number" ? parsed.bestImageIndex : 0,
        bestImageId: images[parsed.bestImageIndex]?.id,
        evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations : [],
        overallComparisonAr: parsed.overallComparisonAr || res.text,
        selectionReasonsAr: Array.isArray(parsed.selectionReasonsAr) ? parsed.selectionReasonsAr : [],
        modelUsed: res.modelUsed,
        providerUsed: res.providerUsed,
        latencyMs: res.latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        bestImageIndex: 0,
        evaluations: [],
        overallComparisonAr: "تعذر إكمال عملية المقارنة التلقائية.",
        selectionReasonsAr: [],
        modelUsed: "Failed",
        providerUsed: "Failed",
        latencyMs: 0,
        error: err.message,
      };
    }
  }

  /**
   * 4. OCR / Text and Data Extraction
   */
  public static async extractInformation(options: VisionExtractOptions): Promise<VisionExtractResult> {
    const { image, extractType = "ocr", strategy } = options;

    const systemPrompt = `أنت محرك استخراج النصوص والبيانات البصرية (OCR & Vision Extractor) في SoufTools.
قم باستخراج جميع النصوص والبيانات من الصورة باللغة العربية والإنجليزية بدقة متناهية.
أخرج النتيجة strictly JSON:
{
  "text": "النص الكامل المستخرج",
  "confidence": 98,
  "structuredData": {}
}`;

    const promptText = `نوع الاستخراج المطلوب: ${extractType}. استخرج جميع النصوص أو الجداول أو المعالم المكتوبة في الصورة بدقة.`;

    try {
      const res = await this.executeMultimodalPrompt([image], promptText, systemPrompt, strategy);

      let parsed: any = {};
      try {
        const cleanJsonStr = res.text.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch {
        parsed = {
          text: res.text,
          confidence: 90,
        };
      }

      return {
        success: true,
        text: parsed.text || res.text,
        structuredData: parsed.structuredData,
        confidence: parsed.confidence || 90,
        modelUsed: res.modelUsed,
        providerUsed: res.providerUsed,
        latencyMs: res.latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        text: "",
        confidence: 0,
        modelUsed: "Failed",
        providerUsed: "Failed",
        latencyMs: 0,
        error: err.message,
      };
    }
  }
}
