/**
 * Provider catalog: 38 chat/LLM providers, 2 audio providers, and 1 embedding provider.
 */

export interface AIProviderDef {
  id: string;
  name: string;
  category: "llm" | "audio" | "vision" | "code" | "embedding";
  models: string[];
  baseUrl?: string;
  requiresKey: boolean;
  docUrl: string;
}

export interface SoufAIModelDef {
  id: "spark" | "core" | "pro" | "ultra" | "classifier" | string;
  nameAr: string;
  nameEn: string;
  badge: string;
  icon: string;
  speed: string;
  quality: string;
  descriptionAr: string;
  descriptionEn: string;
  role?: "user_chat" | "classifier" | string;
  hidden?: boolean;
  defaultProviders: {
    providerId: string;
    model: string;
    priority: number;
    routingMode?: "round_robin" | "priority";
  }[];
}

export const SOUFAI_MODELS: Record<string, SoufAIModelDef> = {
  spark: {
    id: "spark",
    nameAr: "SoufAI Spark",
    nameEn: "SoufAI Spark",
    badge: "الأسرع",
    icon: "⚡",
    speed: "فائقة جداً (50ms)",
    quality: "عالية (Fast)",
    descriptionAr: "النموذج الخاطف للردود السريعة، الاستفسارات البسيطة وتلخيص النصوص",
    descriptionEn: "Lightning fast model for quick queries, summaries and instant answers",
    defaultProviders: [
      { providerId: "gemini", model: "gemini-3.7-flash", priority: 1, routingMode: "priority" },
      { providerId: "groq", model: "openai/gpt-oss-20b", priority: 2, routingMode: "round_robin" },
      { providerId: "deepseek", model: "deepseek-chat", priority: 3, routingMode: "priority" },
    ]
  },
  core: {
    id: "core",
    nameAr: "SoufAI Core",
    nameEn: "SoufAI Core",
    badge: "المتوازن",
    icon: "🔵",
    speed: "سريعة جداً (100ms)",
    quality: "ممتازة (Standard)",
    descriptionAr: "النموذج الأساسي المتوازن للاستخدام اليومي، الكتابة والتحليل",
    descriptionEn: "The balanced daily driver for writing, reasoning and everyday tasks",
    defaultProviders: [
      { providerId: "gemini", model: "gemini-3.7-flash", priority: 1, routingMode: "priority" },
      { providerId: "groq", model: "openai/gpt-oss-120b", priority: 2, routingMode: "round_robin" },
      { providerId: "openai", model: "gpt-4o-mini", priority: 3, routingMode: "priority" },
    ]
  },
  pro: {
    id: "pro",
    nameAr: "SoufAI Pro",
    nameEn: "SoufAI Pro",
    badge: "الأقوى",
    icon: "💎",
    speed: "متوسطة (300ms)",
    quality: "جبارة (Reasoning Pro)",
    descriptionAr: "نموذج احترافي للمهام الصعبة، التفكير المنطقي وكتابة المقالات الطويلة",
    descriptionEn: "Professional model built for deep reasoning, research and complex articles",
    defaultProviders: [
      { providerId: "gemini", model: "gemini-3.1-pro-preview", priority: 1, routingMode: "priority" },
      { providerId: "anthropic", model: "claude-3-5-sonnet-latest", priority: 2, routingMode: "priority" },
      { providerId: "openai", model: "gpt-4o", priority: 3, routingMode: "round_robin" },
    ]
  },
  ultra: {
    id: "ultra",
    nameAr: "SoufAI Ultra",
    nameEn: "SoufAI Ultra",
    badge: "الأفضل",
    icon: "🚀",
    speed: "فائقة (150ms)",
    quality: "أعلى دقة وذكاء",
    descriptionAr: "أقوى نموذج ذكاء اصطناعي للمهام المعقدة جداً، التحليل المعمق واستخلاص النتائج",
    descriptionEn: "The ultimate flagship model for highly complex analytical problems",
    defaultProviders: [
      { providerId: "gemini", model: "gemini-3.7-flash", priority: 1, routingMode: "priority" },
      { providerId: "deepseek", model: "deepseek-reasoner", priority: 2, routingMode: "priority" },
      { providerId: "openai", model: "o1", priority: 3, routingMode: "priority" },
    ]
  },
  classifier: {
    id: "classifier",
    nameAr: "نموذج التصنيف الداخلي (Classifier)",
    nameEn: "Hidden Classifier Model",
    badge: "مصنف داخلي 🔒",
    icon: "🎯",
    speed: "فائقة (50ms)",
    quality: "تصنيف فوري (10 توكنات)",
    descriptionAr: "سجل خاص بدور (classifier) — غير مرئي للمستخدمين نهائياً، مخصص لفرز وتصنيف استفسارات المستخدمين قبل دخول حلقة الوكيل إلى: (simple / tools / complex).",
    descriptionEn: "Internal system classifier model (role: classifier) — completely hidden from end-users, for 10-token triage.",
    role: "classifier",
    hidden: true,
    defaultProviders: []
  }
};

export const AI_PROVIDERS: AIProviderDef[] = [
  { id: "gemini", name: "Google AI (Gemini)", category: "llm", models: ["gemini-3-flash-preview", "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"], requiresKey: true, docUrl: "https://ai.google.dev" },
  { id: "openai", name: "OpenAI", category: "llm", models: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"], requiresKey: true, docUrl: "https://platform.openai.com" },
  { id: "anthropic", name: "Anthropic", category: "llm", models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"], requiresKey: true, docUrl: "https://anthropic.com" },
  { id: "groq", name: "Groq", category: "llm", models: ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"], requiresKey: true, docUrl: "https://groq.com" },
  { id: "deepseek", name: "DeepSeek", category: "llm", models: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"], requiresKey: true, docUrl: "https://deepseek.com" },
  { id: "mistral", name: "Mistral AI", category: "llm", models: ["mistral-large-latest", "pixtral-12b-2409", "codestral-latest"], requiresKey: true, docUrl: "https://mistral.ai" },
  { id: "xai", name: "xAI (Grok)", category: "llm", models: ["grok-2-latest", "grok-beta"], requiresKey: true, docUrl: "https://x.ai" },
  { id: "perplexity", name: "Perplexity AI", category: "llm", models: ["sonar-pro", "sonar", "sonar-reasoning"], requiresKey: true, docUrl: "https://perplexity.ai" },
  { id: "alibaba", name: "Alibaba Cloud (Qwen)", category: "llm", models: ["qwen-max", "qwen-plus", "qwen2.5-coder-32b"], requiresKey: true, docUrl: "https://alibabacloud.com" },
  { id: "openrouter", name: "OpenRouter", category: "llm", models: ["auto", "anthropic/claude-3.5-sonnet", "deepseek/deepseek-r1"], requiresKey: true, docUrl: "https://openrouter.ai" },
  { id: "together", name: "Together AI", category: "llm", models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"], requiresKey: true, docUrl: "https://together.ai" },
  { id: "cerebras", name: "Cerebras", category: "llm", models: ["llama3.1-8b", "llama3.1-70b"], requiresKey: true, docUrl: "https://cerebras.ai" },
  { id: "sambanova", name: "SambaNova", category: "llm", models: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1-Distill-Llama-70B"], requiresKey: true, docUrl: "https://sambanova.ai" },
  { id: "siliconflow", name: "SiliconFlow", category: "llm", models: ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1"], requiresKey: true, docUrl: "https://siliconflow.cn" },
  { id: "fireworks", name: "Fireworks AI", category: "llm", models: ["accounts/fireworks/models/llama-v3p3-70b-instruct"], requiresKey: true, docUrl: "https://fireworks.ai" },
  { id: "deepinfra", name: "DeepInfra", category: "llm", models: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct"], requiresKey: true, docUrl: "https://deepinfra.com" },
  { id: "cohere", name: "Cohere", category: "llm", models: ["command-r-plus", "command-r", "embed-multilingual-v3.0"], requiresKey: true, docUrl: "https://cohere.com" },
  { id: "ai21", name: "AI21 Labs", category: "llm", models: ["jamba-1.5-large", "jamba-1.5-mini"], requiresKey: true, docUrl: "https://ai21.com" },
  { id: "bedrock", name: "Amazon Bedrock", category: "llm", models: ["anthropic.claude-3-5-sonnet-20241022-v2:0", "amazon.nova-pro-v1:0", "meta.llama3-70b-instruct-v1:0"], requiresKey: true, docUrl: "https://aws.amazon.com/bedrock" },
  { id: "nvidia", name: "NVIDIA NIM", category: "llm", models: ["meta/llama-3.3-70b-instruct"], requiresKey: true, docUrl: "https://build.nvidia.com" },
  { id: "nebius", name: "Nebius AI", category: "llm", models: ["meta-llama/Llama-3.3-70B-Instruct-fast"], requiresKey: true, docUrl: "https://nebius.com" },
  { id: "moonshot", name: "Moonshot AI (Kimi)", category: "llm", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"], requiresKey: true, docUrl: "https://moonshot.cn" },
  { id: "bytedance", name: "ByteDance (Doubao)", category: "llm", models: ["doubao-pro-128k", "doubao-lite"], requiresKey: true, docUrl: "https://volcengine.com" },
  { id: "minimax", name: "MiniMax", category: "llm", models: ["MiniMax-Text-01", "abab6.5g-chat", "abab6.5t-chat"], requiresKey: true, docUrl: "https://minimaxi.com" },
  { id: "zhipu", name: "Zhipu AI (GLM)", category: "llm", models: ["glm-4-plus", "glm-4-flash"], requiresKey: true, docUrl: "https://open.bigmodel.cn" },
  { id: "ollama", name: "Ollama", category: "llm", models: ["llama3.3", "qwen2.5", "deepseek-r1"], requiresKey: false, docUrl: "https://ollama.ai" },
  { id: "cloudflare", name: "Cloudflare Workers AI", category: "llm", models: ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"], requiresKey: true, docUrl: "https://developers.cloudflare.com/workers-ai" },
  { id: "huggingface", name: "Hugging Face", category: "llm", models: ["meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-72B-Instruct"], requiresKey: true, docUrl: "https://huggingface.co" },
  { id: "hyperbolic", name: "Hyperbolic", category: "llm", models: ["meta-llama/Llama-3.3-70B-Instruct"], requiresKey: true, docUrl: "https://hyperbolic.xyz" },
  { id: "inference", name: "Inference.net", category: "llm", models: ["meta-llama/llama-3.3-70b-instruct"], requiresKey: true, docUrl: "https://inference.net" },
  { id: "lepton", name: "Lepton AI", category: "llm", models: ["llama3-70b"], requiresKey: true, docUrl: "https://lepton.ai" },
  { id: "novita", name: "Novita AI", category: "llm", models: ["meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-r1"], requiresKey: true, docUrl: "https://novita.ai" },
  { id: "friendliai", name: "FriendliAI", category: "llm", models: ["meta-llama-3.3-70b-instruct"], requiresKey: true, docUrl: "https://friendli.ai" },
  { id: "scaleway", name: "Scaleway AI", category: "llm", models: ["llama-3.1-70b-instruct"], requiresKey: true, docUrl: "https://scaleway.com" },
  { id: "predibase", name: "Predibase", category: "llm", models: ["llama-3-70b-finetuned"], requiresKey: true, docUrl: "https://predibase.com" },
  { id: "baseten", name: "Baseten", category: "llm", models: ["mistral-7b-custom", "llama-3-custom"], requiresKey: true, docUrl: "https://baseten.co" },
  { id: "replicate", name: "Replicate", category: "llm", models: ["meta/meta-llama-3-70b-instruct", "deepseek-ai/deepseek-r1"], requiresKey: true, docUrl: "https://replicate.com" },
  { id: "vercel_gw", name: "Vercel AI Gateway", category: "llm", models: ["openai/gpt-4o", "anthropic/claude-3-5-sonnet"], requiresKey: true, docUrl: "https://vercel.com" },
  { id: "elevenlabs", name: "ElevenLabs", category: "audio", models: ["eleven_multilingual_v2", "eleven_turbo_v2_5", "scribe_v1"], requiresKey: true, docUrl: "https://elevenlabs.io" },
  { id: "assemblyai", name: "AssemblyAI", category: "audio", models: ["universal", "slam-1", "nano", "conformer-2"], requiresKey: true, docUrl: "https://assemblyai.com" },
  { id: "voyage", name: "Voyage AI", category: "embedding", models: ["voyage-3", "voyage-3-lite", "voyage-code-3"], requiresKey: true, docUrl: "https://voyageai.com" }
];
