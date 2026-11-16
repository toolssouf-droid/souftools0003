/**
 * Provider API Key formats and syntax verification helpers (All 41 AI Providers + Tools)
 */

export interface ProviderKeyFormat {
  providerId: string;
  name: string;
  prefix?: string;
  pattern?: RegExp;
  example: string;
  descriptionAr: string;
  optionalKey?: boolean;
}

export const PROVIDER_KEY_FORMATS: Record<string, ProviderKeyFormat> = {
  gemini: {
    providerId: "gemini",
    name: "Google AI (Gemini)",
    pattern: /^(AIza[A-Za-z0-9_-]{20,}|AQ\.[A-Za-z0-9._-]{10,})$/,
    example: "AIzaS... أو AQ....",
    descriptionAr: "يدعم مفاتيح Google التقليدية (AIzaS...) ومفاتيح Auth الجديدة (AQ...)",
  },
  mistral: {
    providerId: "mistral",
    name: "Mistral AI",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "mst_... أو سلسلة من 32+ حرفاً",
    descriptionAr: "يتكون من 32 حرفاً أو أكثر من منصة Mistral La Plateforme",
  },
  openai: {
    providerId: "openai",
    name: "OpenAI",
    prefix: "sk-",
    pattern: /^sk-(proj-)?[a-zA-Z0-9_-]{20,}$/,
    example: "sk-proj-... أو sk-...",
    descriptionAr: "يبدأ بـ sk- أو sk-proj- من منصة OpenAI API",
  },
  anthropic: {
    providerId: "anthropic",
    name: "Anthropic",
    prefix: "sk-ant-",
    pattern: /^sk-ant-[a-zA-Z0-9_-]{20,}$/,
    example: "sk-ant-api03-...",
    descriptionAr: "يبدأ بـ sk-ant- من منصة Anthropic Console",
  },
  groq: {
    providerId: "groq",
    name: "Groq",
    prefix: "gsk_",
    pattern: /^gsk_[a-zA-Z0-9_-]{20,}$/,
    example: "gsk_...",
    descriptionAr: "يبدأ بـ gsk_ من منصة Groq Cloud",
  },
  deepseek: {
    providerId: "deepseek",
    name: "DeepSeek",
    prefix: "sk-",
    pattern: /^sk-[a-zA-Z0-9_-]{20,}$/,
    example: "sk-...",
    descriptionAr: "يبدأ بـ sk- من منصة DeepSeek Platform",
  },
  openrouter: {
    providerId: "openrouter",
    name: "OpenRouter",
    prefix: "sk-or-v1-",
    pattern: /^sk-or-v1-[a-zA-Z0-9_-]{20,}$/,
    example: "sk-or-v1-...",
    descriptionAr: "يبدأ بـ sk-or-v1- من منصة OpenRouter",
  },
  cohere: {
    providerId: "cohere",
    name: "Cohere",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "سلسلة من 40 حرفاً",
    descriptionAr: "يتكون من 40 حرفاً تقريباً من منصة Cohere Dashboard",
  },
  together: {
    providerId: "together",
    name: "Together AI",
    pattern: /^[a-zA-Z0-9_.-]{20,}$/,
    example: "سلسلة من 32+ حرفاً",
    descriptionAr: "يتكون من 32-64 حرفاً من منصة Together AI",
  },
  xai: {
    providerId: "xai",
    name: "xAI (Grok)",
    prefix: "xai-",
    pattern: /^xai-[a-zA-Z0-9_-]{20,}$/,
    example: "xai-...",
    descriptionAr: "يبدأ بـ xai- من منصة xAI Console",
  },
  perplexity: {
    providerId: "perplexity",
    name: "Perplexity AI",
    prefix: "pplx-",
    pattern: /^pplx-[a-zA-Z0-9_-]{20,}$/,
    example: "pplx-...",
    descriptionAr: "يبدأ بـ pplx- من منصة Perplexity API",
  },
  alibaba: {
    providerId: "alibaba",
    name: "Alibaba Cloud (Qwen)",
    prefix: "sk-",
    pattern: /^sk-[a-zA-Z0-9_-]{20,}$/,
    example: "sk-...",
    descriptionAr: "يبدأ بـ sk- من Alibaba Model Studio (DashScope)",
  },
  cerebras: {
    providerId: "cerebras",
    name: "Cerebras",
    prefix: "csk-",
    pattern: /^csk-[a-zA-Z0-9_-]{20,}$/,
    example: "csk-...",
    descriptionAr: "يبدأ بـ csk- من منصة Cerebras Inference",
  },
  sambanova: {
    providerId: "sambanova",
    name: "SambaNova",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "سلسلة UUID أو رمز من 32+ حرفاً",
    descriptionAr: "مفتاح API من منصة SambaNova Cloud",
  },
  siliconflow: {
    providerId: "siliconflow",
    name: "SiliconFlow",
    prefix: "sk-",
    pattern: /^sk-[a-zA-Z0-9_-]{20,}$/,
    example: "sk-...",
    descriptionAr: "يبدأ بـ sk- من منصة SiliconFlow",
  },
  fireworks: {
    providerId: "fireworks",
    name: "Fireworks AI",
    prefix: "fw_",
    pattern: /^(fw_[a-zA-Z0-9_-]{16,}|[a-zA-Z0-9_-]{24,})$/,
    example: "fw_...",
    descriptionAr: "يبدأ عادةً بـ fw_ من منصة Fireworks AI",
  },
  deepinfra: {
    providerId: "deepinfra",
    name: "DeepInfra",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "سلسلة من 32 حرفاً",
    descriptionAr: "مفتاح API من منصة DeepInfra",
  },
  ai21: {
    providerId: "ai21",
    name: "AI21 Labs",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "سلسلة من 32 حرفاً",
    descriptionAr: "مفتاح API من منصة AI21 Studio",
  },
  bedrock: {
    providerId: "bedrock",
    name: "Amazon Bedrock",
    pattern: /^(ABSK\S+|bedrock-api-key-\S+|(AKIA|ASIA)[A-Z0-9]{16}:[^\s:]{20,}(?::[a-z]{2}-[a-z-]+-\d)?)$/i,
    example: "AKIA...:SECRET_KEY:us-east-1 أو ABSK...",
    descriptionAr: "يدعم اعتماد AWS IAM بصيغة ACCESS_KEY:SECRET_KEY:REGION أو مفتاح Bedrock API يبدأ بـ ABSK",
  },
  nvidia: {
    providerId: "nvidia",
    name: "NVIDIA NIM",
    prefix: "nvapi-",
    pattern: /^nvapi-[a-zA-Z0-9_-]{20,}$/,
    example: "nvapi-...",
    descriptionAr: "يبدأ بـ nvapi- من منصة NVIDIA Build / NIM",
  },
  nebius: {
    providerId: "nebius",
    name: "Nebius AI",
    pattern: /^[^\s]{20,}$/,
    example: "مفتاح API من Nebius AI Studio",
    descriptionAr: "مفتاح JWT أو رمز API من منصة Nebius AI Studio",
  },
  moonshot: {
    providerId: "moonshot",
    name: "Moonshot AI (Kimi)",
    prefix: "sk-",
    pattern: /^sk-[a-zA-Z0-9_-]{20,}$/,
    example: "sk-...",
    descriptionAr: "يبدأ بـ sk- من منصة Moonshot AI",
  },
  bytedance: {
    providerId: "bytedance",
    name: "ByteDance (Doubao)",
    pattern: /^[a-zA-Z0-9._-]{20,}$/,
    example: "UUID من Volcengine Ark",
    descriptionAr: "مفتاح Ark API من منصة Volcengine / ByteDance",
  },
  minimax: {
    providerId: "minimax",
    name: "MiniMax",
    pattern: /^[^\s]{20,}$/,
    example: "sk-api-... أو JWT Token",
    descriptionAr: "مفتاح API أو رمز JWT من منصة MiniMax",
  },
  zhipu: {
    providerId: "zhipu",
    name: "Zhipu AI (GLM)",
    pattern: /^[a-zA-Z0-9._-]{20,}$/,
    example: "id.secret",
    descriptionAr: "مفتاح Zhipu BigModel بصيغة keyId.secret",
  },
  ollama: {
    providerId: "ollama",
    name: "Ollama (محلي)",
    optionalKey: true,
    pattern: /^.*$/,
    example: "ollama-local (اختياري)",
    descriptionAr: "يعمل محلياً عبر الخادم (http://localhost:11434) ولا يتطلب مفتاح سحابة",
  },
  cloudflare: {
    providerId: "cloudflare",
    name: "Cloudflare Workers AI",
    pattern: /^([a-f0-9]{16,64}[:|][a-zA-Z0-9_-]{20,}|[a-zA-Z0-9_-]{20,})$/i,
    example: "ACCOUNT_ID:API_TOKEN",
    descriptionAr: "أدخل معرف الحساب والتوكن بصيغة ACCOUNT_ID:API_TOKEN (أو التوكن وحده إذا كان CLOUDFLARE_ACCOUNT_ID مضبوطاً)",
  },
  huggingface: {
    providerId: "huggingface",
    name: "Hugging Face",
    prefix: "hf_",
    pattern: /^hf_[a-zA-Z0-9]{20,}$/,
    example: "hf_...",
    descriptionAr: "يبدأ بـ hf_ من إعدادات Access Tokens في Hugging Face",
  },
  hyperbolic: {
    providerId: "hyperbolic",
    name: "Hyperbolic",
    pattern: /^[^\s]{20,}$/,
    example: "eyJ...",
    descriptionAr: "رمز Bearer / JWT من منصة Hyperbolic",
  },
  inference: {
    providerId: "inference",
    name: "Inference.net",
    prefix: "inference-",
    pattern: /^(inference-[a-zA-Z0-9_-]{16,}|[a-zA-Z0-9_-]{20,})$/,
    example: "inference-...",
    descriptionAr: "مفتاح API من منصة Inference.net",
  },
  lepton: {
    providerId: "lepton",
    name: "Lepton AI",
    pattern: /^[a-zA-Z0-9_-]{16,}$/,
    example: "رمز Workspace من Lepton AI",
    descriptionAr: "مفتاح Workspace API Token من منصة Lepton AI",
  },
  novita: {
    providerId: "novita",
    name: "Novita AI",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "sk_... أو UUID",
    descriptionAr: "مفتاح API من لوحة Novita AI",
  },
  friendliai: {
    providerId: "friendliai",
    name: "FriendliAI",
    prefix: "flp_",
    pattern: /^(flp_[a-zA-Z0-9_-]{16,}|[a-zA-Z0-9_-]{20,})$/,
    example: "flp_...",
    descriptionAr: "Personal Access Token يبدأ بـ flp_ من Friendli Suite",
  },
  scaleway: {
    providerId: "scaleway",
    name: "Scaleway AI",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "UUID Secret Key من Scaleway",
    descriptionAr: "مفتاح IAM Secret Key من Scaleway Generative APIs",
  },
  predibase: {
    providerId: "predibase",
    name: "Predibase",
    prefix: "pb_",
    pattern: /^(pb_[a-zA-Z0-9_-]{16,}|[a-zA-Z0-9_-]{20,})$/,
    example: "pb_...",
    descriptionAr: "مفتاح API من منصة Predibase",
  },
  baseten: {
    providerId: "baseten",
    name: "Baseten",
    pattern: /^[a-zA-Z0-9._-]{20,}$/,
    example: "مفتاح API من Baseten",
    descriptionAr: "مفتاح API من إعدادات Baseten",
  },
  replicate: {
    providerId: "replicate",
    name: "Replicate",
    prefix: "r8_",
    pattern: /^r8_[a-zA-Z0-9_-]{20,}$/,
    example: "r8_...",
    descriptionAr: "يبدأ بـ r8_ من إعدادات API Tokens في Replicate",
  },
  vercel_gw: {
    providerId: "vercel_gw",
    name: "Vercel AI Gateway",
    prefix: "vck_",
    pattern: /^(vck_[a-zA-Z0-9_-]{16,}|[a-zA-Z0-9_.-]{20,})$/,
    example: "vck_...",
    descriptionAr: "يبدأ بـ vck_ من لوحة Vercel AI Gateway",
  },
  elevenlabs: {
    providerId: "elevenlabs",
    name: "ElevenLabs",
    pattern: /^(sk_[a-f0-9]{32,}|[a-zA-Z0-9_-]{24,})$/,
    example: "sk_...",
    descriptionAr: "مفتاح ElevenLabs للصوت وتحويل النص إلى كلام",
  },
  assemblyai: {
    providerId: "assemblyai",
    name: "AssemblyAI",
    pattern: /^[a-f0-9]{24,64}$/i,
    example: "سلسلة Hex من 32 حرفاً",
    descriptionAr: "مفتاح API لتفريغ الصوت من لوحة AssemblyAI",
  },
  voyage: {
    providerId: "voyage",
    name: "Voyage AI",
    prefix: "pa-",
    pattern: /^pa-[a-zA-Z0-9_-]{20,}$/,
    example: "pa-...",
    descriptionAr: "يبدأ بـ pa- من لوحة Voyage AI للتضمين الدلالي",
  },
  tavily: {
    providerId: "tavily",
    name: "Tavily Search",
    prefix: "tvly-",
    pattern: /^tvly-[a-zA-Z0-9_-]{10,}$/,
    example: "tvly-...",
    descriptionAr: "يبدأ بـ tvly- من منصة Tavily Search API",
  },
  exa: {
    providerId: "exa",
    name: "Exa Neural Search",
    pattern: /^[a-zA-Z0-9_-]{15,}$/,
    example: "سلسلة أبجدية رقمية من 20+ حرفاً",
    descriptionAr: "مفتاح صيغة UUID أو سلسلة رقمية من منصة Exa AI",
  },
  serper: {
    providerId: "serper",
    name: "Serper Google Search",
    pattern: /^[a-zA-Z0-9_-]{20,}$/,
    example: "سلسلة 40 حرفاً",
    descriptionAr: "يتكون من 40 حرفاً من منصة Serper.dev",
  },
  jina: {
    providerId: "jina",
    name: "Jina Reader",
    prefix: "jina_",
    pattern: /^jina_[a-zA-Z0-9_-]{10,}$/,
    example: "jina_...",
    descriptionAr: "يبدأ بـ jina_ من منصة Jina AI",
  },
  firecrawl: {
    providerId: "firecrawl",
    name: "Firecrawl",
    prefix: "fc-",
    pattern: /^fc-[a-zA-Z0-9_-]{10,}$/,
    example: "fc-...",
    descriptionAr: "يبدأ بـ fc- من منصة Firecrawl",
  },
  e2b: {
    providerId: "e2b",
    name: "E2B Sandbox",
    prefix: "e2b_",
    pattern: /^e2b_[a-zA-Z0-9_-]{16,}$/,
    example: "e2b_...",
    descriptionAr: "يبدأ بـ e2b_ من لوحة E2B Dashboard",
  },
};

export function validateKeySyntax(providerId: string, key: string): { valid: boolean; messageAr?: string } {
  const cleanProviderId = (providerId || "").trim().toLowerCase();
  const format = PROVIDER_KEY_FORMATS[cleanProviderId];

  if (format?.optionalKey) {
    return { valid: true };
  }

  if (!key || !key.trim()) {
    return { valid: false, messageAr: "المفتاح فارغ" };
  }

  const trimmed = key.trim();
  if (/demo[-_ ]?key/i.test(trimmed)) {
    return { valid: false, messageAr: "لا يمكن استخدام مفتاح تجريبي وهمي" };
  }

  if (!format) {
    if (trimmed.length >= 8) {
      return { valid: true };
    }
    return { valid: false, messageAr: "صيغة المفتاح قصيرة جداً (أقل من 8 أحرف)" };
  }

  if (cleanProviderId === "gemini") {
    if (trimmed.startsWith("AIza") || trimmed.startsWith("AQ.")) {
      if (/^(AIza[A-Za-z0-9_-]{20,}|AQ\.[A-Za-z0-9._-]{10,})$/.test(trimmed)) {
        return { valid: true };
      }
      return { valid: false, messageAr: "صيغة مفتاح Google Gemini غير صحيحة. يجب أن يكون مفتاحاً صالحاً يبدأ بـ AIzaS أو AQ." };
    }
    return { valid: false, messageAr: "مفتاح Google Gemini يجب أن يبدأ بـ AIzaS أو AQ." };
  }

  if (format.prefix && format.pattern && format.pattern.source.startsWith(`^${format.prefix}`) && !trimmed.startsWith(format.prefix)) {
    return {
      valid: false,
      messageAr: `صيغة المفتاح غير متطابقة. المفتاح لـ ${format.name} يفترض أن يبدأ بـ "${format.prefix}"`,
    };
  }

  if (format.pattern && !format.pattern.test(trimmed)) {
    return {
      valid: false,
      messageAr: `صيغة المفتاح غير صحيحة لـ ${format.name}. (المثال المتوقع: ${format.example})`,
    };
  }

  return { valid: true };
}
