/**
 * SoufTools Vision Agent Tools
 * Defines image_analysis_tool and image_editing_tool
 */

import { VisionCapabilityLayer, VisionImageInput } from "@/lib/vision/visionCapabilityLayer";
import { generateImageViaManager } from "@/lib/providers/imageProviderManager";

export interface ImageAnalysisToolInput {
  images: Array<{ url?: string; base64?: string; mimeType?: string; name?: string }>;
  prompt?: string;
  mode?: "describe" | "detect_objects" | "quality_score" | "compare" | "ocr";
}

export interface ImageEditingToolInput {
  image: { url?: string; base64?: string; mimeType?: string };
  instructions: string;
  preserveSubject?: boolean;
}

/**
 * 1. General Image Analysis Tool
 */
export async function executeImageAnalysisTool(input: ImageAnalysisToolInput) {
  const { images = [], prompt = "", mode = "describe" } = input;

  if (!images || images.length === 0) {
    return {
      success: false,
      error: "يرجى تزويد صورة واحدة على الأقل للتحليل.",
    };
  }

  if (mode === "compare" || images.length > 1) {
    const compResult = await VisionCapabilityLayer.compareImages({
      images,
      criteria: prompt || "الجودة العامة والتوازن والتفاصيل",
    });

    return {
      success: compResult.success,
      tool: "image_analysis_tool",
      mode: "compare",
      bestImageIndex: compResult.bestImageIndex,
      summary: compResult.overallComparisonAr,
      evaluations: compResult.evaluations,
      selectionReasons: compResult.selectionReasonsAr,
      modelUsed: compResult.modelUsed,
      providerUsed: compResult.providerUsed,
      latencyMs: compResult.latencyMs,
    };
  }

  if (mode === "ocr") {
    const ocrResult = await VisionCapabilityLayer.extractInformation({
      image: images[0],
      extractType: "ocr",
    });

    return {
      success: ocrResult.success,
      tool: "image_analysis_tool",
      mode: "ocr",
      extractedText: ocrResult.text,
      confidence: ocrResult.confidence,
      modelUsed: ocrResult.modelUsed,
      providerUsed: ocrResult.providerUsed,
      latencyMs: ocrResult.latencyMs,
    };
  }

  if (mode === "quality_score") {
    const qualityResult = await VisionCapabilityLayer.inspectQuality({
      image: images[0],
      promptGoal: prompt,
    });

    return {
      success: qualityResult.success,
      tool: "image_analysis_tool",
      mode: "quality_score",
      score: qualityResult.qualityScore,
      highlights: qualityResult.highlights,
      flaws: qualityResult.flaws,
      recommendation: qualityResult.recommendation,
      modelUsed: qualityResult.modelUsed,
      providerUsed: qualityResult.providerUsed,
      latencyMs: qualityResult.latencyMs,
    };
  }

  // Default: General Image Understanding & Description
  const analysisResult = await VisionCapabilityLayer.analyzeImage({
    images,
    prompt,
    taskType: mode === "detect_objects" ? "object_detection" : "general",
  });

  return {
    success: analysisResult.success,
    tool: "image_analysis_tool",
    mode: "describe",
    description: analysisResult.description,
    extractedElements: analysisResult.extractedElements,
    mainSubject: analysisResult.mainSubject,
    detectedIssues: analysisResult.detectedIssues,
    modelUsed: analysisResult.modelUsed,
    providerUsed: analysisResult.providerUsed,
    latencyMs: analysisResult.latencyMs,
  };
}

/**
 * 2. Image Editing Tool with Pre-Analysis Protection
 */
export async function executeImageEditingTool(input: ImageEditingToolInput) {
  const { image, instructions, preserveSubject = true } = input;

  if (!image || (!image.url && !image.base64)) {
    return {
      success: false,
      error: "لم يتم تقديم صورة صالحة للتحسين والتعديل.",
    };
  }

  // Pre-Analysis to understand what to preserve
  const preAnalysis = await VisionCapabilityLayer.analyzeImage({
    images: [image],
    prompt: instructions,
  });

  const mainSubject = preAnalysis.mainSubject || "العنصر الرئيسي";

  // Build high-fidelity prompt
  const refinedPrompt = preserveSubject
    ? `Masterpiece photo edit: ${instructions}, keeping ${mainSubject} perfectly preserved, high quality lighting, crystal clear details, 8k resolution`
    : `Masterpiece photo edit: ${instructions}, high quality render, 8k resolution`;

  const editRes = await generateImageViaManager(refinedPrompt);

  return {
    success: editRes.success,
    tool: "image_editing_tool",
    originalSubjectPreserved: mainSubject,
    instructionsApplied: instructions,
    resultImageUrl: editRes.imageUrl,
    modelUsed: editRes.modelUsed,
    providerUsed: editRes.providerUsed,
    latencyMs: editRes.latencyMs,
  };
}
