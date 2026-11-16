// lib/models/modelRegistry.ts
/**
 * SoufTools Central Model Registry
 * The single source of truth for model specifications, capabilities, limits,
 * tools integration, and routing priority across the entire platform.
 */

export interface ModelToolCapability {
  id: "sandbox" | "files" | "web" | "vision" | "image" | "search" | "terminal" | "preview";
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  available: boolean;
  requiresSession: boolean;
  safetyLevel: "standard" | "elevated" | "restricted";
}

export interface ModelCapabilities {
  context_window: number;
  context_window_label: string;
  vision: boolean;
  vision_notes_ar: string;
  vision_notes_en: string;
  tools: boolean;
  reasoning: boolean;
  reasoning_level: "fast" | "standard" | "high" | "deep_research";
  coding: boolean;
  coding_level: "basic" | "competent" | "expert" | "state_of_the_art";
  web: boolean;
  image: boolean;
  files: boolean;
  structured_output: boolean;
  streaming: boolean;
}

export interface ModelLimits {
  max_context_tokens: number;
  max_output_tokens: number;
  rate_limits: {
    rpm: number; // requests per minute
    tpm: number; // tokens per minute
    rpd: number; // requests per day
  };
  tool_limits: {
    max_parallel_tools: number;
    sandbox_timeout_seconds: number;
    max_file_size_mb: number;
  };
  agent_limits: {
    max_steps_per_task: number;
    max_execution_minutes: number;
  };
  usage_limits: {
    free_daily_messages: number;
    pro_tier_unlimited: boolean;
  };
}

export interface ModelConfigurationSchema {
  default_temperature: number;
  min_temperature: number;
  max_temperature: number;
  default_top_p: number;
  supports_system_instructions: boolean;
  default_max_output_tokens: number;
  allowed_safety_thresholds: string[];
}

export interface SoufModelRegistryEntry {
  model_id: "spark" | "core" | "pro" | "coder" | "ultra";
  display_name: string;
  provider: string;
  version: string;
  status: "operational" | "degraded" | "maintenance";
  routing_priority: number;
  identity: {
    archetype: "speed" | "balance" | "depth" | "engineering" | "apex";
    accentColor: string;
    badgeAr: string;
    badgeEn: string;
    taglineAr: string;
    taglineEn: string;
    descriptionAr: string;
    descriptionEn: string;
    idealForAr: string[];
    idealForEn: string[];
  };
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  supported_tools: ModelToolCapability[];
  configuration_schema: ModelConfigurationSchema;
  features: { ar: string; en: string }[];
}

export const SOUF_MODEL_REGISTRY: Record<string, SoufModelRegistryEntry> = {
  spark: {
    model_id: "spark",
    display_name: "SoufAI Spark",
    provider: "Google Gemini 2.5 Flash & Provider Pool",
    version: "v2.5-flash (2026)",
    status: "operational",
    routing_priority: 1,
    identity: {
      archetype: "speed",
      accentColor: "#f59e0b",
      badgeAr: "الأسرع",
      badgeEn: "Ultra Fast",
      taglineAr: "سرعة خارقة واستجابة فورية للأفكار والتلخيص",
      taglineEn: "Lightning fast sub-100ms latency for queries and rapid text processing",
      descriptionAr: "النموذج المصمم للسرعة الفائقة والردود اللحظية، مثالي لتلخيص المقالات، الترجمة المباشرة، والإجابة عن الاستفسارات البسيطة وتوفير الحصة دون أي تأخير.",
      descriptionEn: "Engineered for maximum velocity and instantaneous execution. Perfect for on-the-fly summaries, translations, quick definitions, and light multi-turn conversations.",
      idealForAr: [
        "الردود الفورية وتلخيص المقالات والنصوص الطويلة",
        "الاستفسارات المعرفية والأسئلة السريعة المباشرة",
        "التدقيق اللغوي والترجمة متعددة اللغات",
        "توليد الأفكار السريعة والعصف الذهني اللحظي"
      ],
      idealForEn: [
        "Instant summarization of articles and long documentation",
        "Direct knowledge lookup & quick Q&A",
        "Grammar checking, rewriting and multi-language translation",
        "Rapid brainstorming and lightweight structuring"
      ]
    },
    capabilities: {
      context_window: 1048576, // 1M tokens
      context_window_label: "1,048,576 Token (~750,000 كلمة)",
      vision: true,
      vision_notes_ar: "دعم فحص الصور السريع وقراءة المستندات الممسوحة ضوئياً",
      vision_notes_en: "Fast visual inspection and scanned document OCR",
      tools: true,
      reasoning: true,
      reasoning_level: "fast",
      coding: true,
      coding_level: "competent",
      web: true,
      image: true,
      files: true,
      structured_output: true,
      streaming: true
    },
    limits: {
      max_context_tokens: 1048576,
      max_output_tokens: 8192,
      rate_limits: {
        rpm: 120,
        tpm: 2000000,
        rpd: 15000
      },
      tool_limits: {
        max_parallel_tools: 3,
        sandbox_timeout_seconds: 30,
        max_file_size_mb: 25
      },
      agent_limits: {
        max_steps_per_task: 8,
        max_execution_minutes: 3
      },
      usage_limits: {
        free_daily_messages: 50,
        pro_tier_unlimited: true
      }
    },
    supported_tools: [
      { id: "web", nameAr: "البحث في الويب", nameEn: "Web Grounding", descriptionAr: "استرجاع معلومات حية ومحدثة من محركات البحث العالمية", descriptionEn: "Retrieve real-time web references and grounding sources", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "files", nameAr: "نظام الملفات SoufFile", nameEn: "SoufFile System", descriptionAr: "قراءة وتوليد ملفات نصوص ومستندات وصيغ مرنة", descriptionEn: "Read and generate markdown, text, and flexible documents", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "search", nameAr: "محرك البحث الفوري", nameEn: "Instant Search", descriptionAr: "بحث سريع ودقيق عن الحقائق والتواريخ", descriptionEn: "Fast, accurate fact-checking and timestamped lookup", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "vision", nameAr: "التحليل البصري الخفيف", nameEn: "Light Vision", descriptionAr: "استخراج النصوص ووصف الصور والرسوم البيانية البسيطة", descriptionEn: "Extract text and describe visual diagrams", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "image", nameAr: "توليد الصور", nameEn: "Image Generation", descriptionAr: "إنشاء تصاميم وصور فنية عبر نماذج التوليد", descriptionEn: "Generate imagery using diffusion & prompt pipeline", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "sandbox", nameAr: "بيئة الساندبوكس السريعة", nameEn: "Fast Sandbox", descriptionAr: "تشغيل سكربتات خفيفة وحسابات برمجية سريعة", descriptionEn: "Execute light scripts and calculation benchmarks", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "terminal", nameAr: "الطرفية السريعة", nameEn: "Quick Terminal", descriptionAr: "أوامر استعلامية خفيفة وقراءة المخرجات", descriptionEn: "Read-only inspection and lightweight commands", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "preview", nameAr: "المعاينة التفاعلية", nameEn: "Live Preview", descriptionAr: "معاينة واجهات ومخرجات النصوص والكود", descriptionEn: "Render formatted HTML and client-side components", available: true, requiresSession: false, safetyLevel: "standard" }
    ],
    configuration_schema: {
      default_temperature: 0.7,
      min_temperature: 0.0,
      max_temperature: 1.0,
      default_top_p: 0.95,
      supports_system_instructions: true,
      default_max_output_tokens: 4096,
      allowed_safety_thresholds: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE"]
    },
    features: [
      { ar: "زمن استجابة أولي يقل عن 80 ميلي ثانية", en: "Sub-80ms first token time-to-first-byte" },
      { ar: "نافذة سياق عملاقة تتسع لأكثر من 1,000,000 توكن", en: "1 Million token context window" },
      { ar: "توفير فائق لاستهلاك الحصة والمفاتيح للعمليات المتكررة", en: "Highly token-efficient for bulk repetitive workflows" }
    ]
  },

  core: {
    model_id: "core",
    display_name: "SoufAI Core",
    provider: "Google Gemini 2.5 Flash Balanced",
    version: "v2.5-flash-balanced (2026)",
    status: "operational",
    routing_priority: 2,
    identity: {
      archetype: "balance",
      accentColor: "#0ea5e9",
      badgeAr: "المتوازن",
      badgeEn: "Balanced Standard",
      taglineAr: "المحرك الأساسي اليومي المتوازن بين الذكاء والسرعة",
      taglineEn: "The reliable daily workhorse balancing intelligence, speed, and precision",
      descriptionAr: "النموذج القياسي لمنظومة SoufTools، يجمع بين قوة التفكير والسرعة العالية مع دعم شامل لكافة الأدوات والمهام المتعددة بدون تعقيد.",
      descriptionEn: "The default versatile foundation for general reasoning, content authoring, data synthesis, and day-to-day multi-tool operations.",
      idealForAr: [
        "كتابة المقالات والتقارير والرسائل الاحترافية",
        "التحليل المقارن واستخلاص الحقائق من الوثائق",
        "التخطيط والمساعدة المعرفية اليومية المتوازنة",
        "تنفيذ أوامر الأدوات وسحب البيانات الذكية"
      ],
      idealForEn: [
        "Professional reporting, emails, and multi-paragraph essays",
        "Comparative analysis and structured document synthesis",
        "Daily productivity workflows and task planning",
        "Orchestrating tools, calculations, and data lookups"
      ]
    },
    capabilities: {
      context_window: 1048576,
      context_window_label: "1,048,576 Token (~750,000 كلمة)",
      vision: true,
      vision_notes_ar: "فهم عالي الدقة للصور والمخططات والرسوم البيانية وجداول البيانات",
      vision_notes_en: "High precision understanding of charts, diagrams, tables and UI mockups",
      tools: true,
      reasoning: true,
      reasoning_level: "standard",
      coding: true,
      coding_level: "expert",
      web: true,
      image: true,
      files: true,
      structured_output: true,
      streaming: true
    },
    limits: {
      max_context_tokens: 1048576,
      max_output_tokens: 8192,
      rate_limits: {
        rpm: 60,
        tpm: 1500000,
        rpd: 10000
      },
      tool_limits: {
        max_parallel_tools: 5,
        sandbox_timeout_seconds: 60,
        max_file_size_mb: 50
      },
      agent_limits: {
        max_steps_per_task: 15,
        max_execution_minutes: 5
      },
      usage_limits: {
        free_daily_messages: 35,
        pro_tier_unlimited: true
      }
    },
    supported_tools: [
      { id: "sandbox", nameAr: "بيئة الساندبوكس Native", nameEn: "Native Sandbox", descriptionAr: "عزل أمني كامل مع دعم Node.js و Python ومعالجة الملفات", descriptionEn: "Full secure isolation supporting Node.js, Python and file tasks", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "files", nameAr: "نظام الملفات SoufFile", nameEn: "SoufFile System", descriptionAr: "إدارة وإنشاء وقراءة كافة أنواع الملفات والمشاريع", descriptionEn: "Create, inspect, and organize workspace files", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "web", nameAr: "البحث والتوثيق الحي", nameEn: "Live Web Research", descriptionAr: "استخراج المعلومات مع توثيق المصادر والروابط", descriptionEn: "Extract live information with verified citations", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "vision", nameAr: "الرؤية البصرية الشاملة", nameEn: "Multimodal Vision", descriptionAr: "تحليل صور عالي الدقة واستخراج الجداول والبيانات", descriptionEn: "High-resolution diagram and visual data parsing", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "image", nameAr: "توليد وتعديل الصور", nameEn: "Image Synthesis", descriptionAr: "توليد صور واقعية ورسوم توضيحية احترافية", descriptionEn: "Generate crisp illustrations and realistic renders", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "search", nameAr: "البحث الذكي المتعدد", nameEn: "Multi-Engine Search", descriptionAr: "بحث متزامن عبر جوجل ومحركات بحث متخصصة", descriptionEn: "Concurrent search querying Google and privacy engines", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "terminal", nameAr: "طرفية الأوامر الآمنة", nameEn: "Secure Terminal", descriptionAr: "تنفيذ حزم bash و npm وفحص مخرجات الخادم", descriptionEn: "Run bash commands, npm installs, and inspection scripts", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "preview", nameAr: "معاينة الويب المباشرة", nameEn: "Live Web Preview", descriptionAr: "معاينة تطبيقات الويب والصفحات عبر منفذ 3000 الداخلي", descriptionEn: "Render dynamic web apps and components", available: true, requiresSession: false, safetyLevel: "standard" }
    ],
    configuration_schema: {
      default_temperature: 0.7,
      min_temperature: 0.0,
      max_temperature: 1.0,
      default_top_p: 0.95,
      supports_system_instructions: true,
      default_max_output_tokens: 8192,
      allowed_safety_thresholds: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE"]
    },
    features: [
      { ar: "توازن ذهبي بين زمن الاستجابة وجودة الصياغة المنطقية", en: "Optimal equilibrium between response latency and reasoning depth" },
      { ar: "دعم كامل ومستقر لجميع أدوات النظام والبحث التفاعلي", en: "Full, stable support across all system tools and live research" },
      { ar: "استقرار متواصل مع نسبة توافر تتجاوز 99.9%", en: "Continuous operational uptime with automated multi-provider failover" }
    ]
  },

  pro: {
    model_id: "pro",
    display_name: "SoufAI Pro",
    provider: "Google Gemini 3.1 Pro Deep Reasoning",
    version: "v3.1-pro-reasoning (2026)",
    status: "operational",
    routing_priority: 3,
    identity: {
      archetype: "depth",
      accentColor: "#a855f7",
      badgeAr: "الأقوى",
      badgeEn: "Deep Reasoning",
      taglineAr: "تفكير تكتيكي وبحث معمق للمسائل المعقدة والاستراتيجية",
      taglineEn: "Tactical reasoning and deep analysis for research and strategic problems",
      descriptionAr: "النموذج الاحترافي المخصص للمهام الصعبة والمقالات الأكاديمية المطولة، مع قدرات استثنائية في الربط المنطقي بين مئات المصادر وحل المعادلات والمسائل المعقدة.",
      descriptionEn: "Built for intensive multi-layer problem solving, academic-grade research syntheses, hypothesis evaluation, and complex contextual reasoning over massive corpora.",
      idealForAr: [
        "الأبحاث العلمية والتحليلات الاستراتيجية والمراجعات النقدية",
        "فهم ومقارنة المستندات المعقدة والعقود القانونية والمذكرات",
        "حل المسائل الرياضية والمنطقية متعددة الخطوات",
        "كتابة الكتب الإلكترونية والأدلة الشاملة ذات الجودة العالية"
      ],
      idealForEn: [
        "Scientific research, strategic feasibility studies, and critical synthesis",
        "Deep multi-document analysis, legal contract auditing, and policy evaluation",
        "Multi-step mathematical, logical, and causal chain problem solving",
        "Comprehensive guides, whitepapers, and long-form publications"
      ]
    },
    capabilities: {
      context_window: 2097152, // 2M tokens
      context_window_label: "2,097,152 Token (~1,500,000 كلمة)",
      vision: true,
      vision_notes_ar: "تحليل بصري متقدم يشمل مقاطع الفيديو والمستندات المتعددة الصفحات",
      vision_notes_en: "Advanced multimodal comprehension across multi-page PDFs and video feeds",
      tools: true,
      reasoning: true,
      reasoning_level: "deep_research",
      coding: true,
      coding_level: "expert",
      web: true,
      image: true,
      files: true,
      structured_output: true,
      streaming: true
    },
    limits: {
      max_context_tokens: 2097152,
      max_output_tokens: 16384,
      rate_limits: {
        rpm: 40,
        tpm: 1000000,
        rpd: 5000
      },
      tool_limits: {
        max_parallel_tools: 8,
        sandbox_timeout_seconds: 120,
        max_file_size_mb: 100
      },
      agent_limits: {
        max_steps_per_task: 25,
        max_execution_minutes: 10
      },
      usage_limits: {
        free_daily_messages: 15,
        pro_tier_unlimited: true
      }
    },
    supported_tools: [
      { id: "web", nameAr: "البحث الموسع والموثوق", nameEn: "Deep Web Research", descriptionAr: "مسح مصادر متعددة وتدقيق المعلومات وتحليل المراجع", descriptionEn: "Multi-source crawling, cross-verification and deep analysis", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "files", nameAr: "محرك المستندات المعقدة", nameEn: "Complex File Engine", descriptionAr: "فهرسة ومعالجة ملفات PDF ضخمة وجداول بيانات متعددة", descriptionEn: "Index and process massive PDFs and multi-sheet datasets", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "vision", nameAr: "الرؤية البصرية العميقة", nameEn: "Deep Vision Analysis", descriptionAr: "فحص المستندات المصورة بدقة مع التعرف على الرسوم البيانية المعقدة", descriptionEn: "High-density diagram breakdown, OCR and infographic extraction", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "sandbox", nameAr: "بيئة الساندبوكس للتحليل", nameEn: "Analytics Sandbox", descriptionAr: "تنفيذ حسابات علمية ومحاكاة بيانات عبر بيئة معزولة", descriptionEn: "Run data simulations, statistical modeling and Python scripts", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "search", nameAr: "البحث الأكاديمي الشامل", nameEn: "Comprehensive Search", descriptionAr: "تصفية النتائج وحصاد الأوراق البحثية والمصادر الموثوقة", descriptionEn: "Filter academic repositories and authoritative domain index", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "terminal", nameAr: "الطرفية المعزولة", nameEn: "Isolated Terminal", descriptionAr: "تنفيذ أوامر تحليل ومعالجة البيانات بأمان", descriptionEn: "Safe shell environment for data parsing pipelines", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "preview", nameAr: "المعاينة التفاعلية", nameEn: "Live Interactive Preview", descriptionAr: "عرض التقارير والرسوم البيانية الديناميكية التفاعلية", descriptionEn: "Render interactive charts, data grids and visual reports", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "image", nameAr: "استنساخ وإنتاج الصور", nameEn: "Pro Image Studio", descriptionAr: "توليد أصول بصرية بجودة فوتوغرافية احترافية", descriptionEn: "Photorealistic rendering and artistic concept creation", available: true, requiresSession: false, safetyLevel: "standard" }
    ],
    configuration_schema: {
      default_temperature: 0.5,
      min_temperature: 0.0,
      max_temperature: 1.0,
      default_top_p: 0.95,
      supports_system_instructions: true,
      default_max_output_tokens: 16384,
      allowed_safety_thresholds: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE"]
    },
    features: [
      { ar: "أضخم نافذة سياق في الصناعة: 2,097,152 توكن (~1.5 مليون كلمة)", en: "Industry-leading 2M token context window" },
      { ar: "تفكير استنتاجي متعدد المراحل مع تدقيق ذاتي للتناقضات", en: "Multi-stage deductive reasoning with self-consistency verification" },
      { ar: "قدرة استثنائية على تلخيص ومقارنة مئات الصفحات في طلب واحد", en: "Synthesize and cross-examine hundreds of pages in a single turn" }
    ]
  },

  coder: {
    model_id: "coder",
    display_name: "SoufAI Coder",
    provider: "Google Gemini Full-Stack Software Engineer",
    version: "v2.5-coder-engine (2026)",
    status: "operational",
    routing_priority: 4,
    identity: {
      archetype: "engineering",
      accentColor: "#10b981",
      badgeAr: "الكود والهندسة",
      badgeEn: "Software Engineer",
      taglineAr: "النموذج المتخصص في كتابة وهندسة البرمجيات وبناء التطبيقات",
      taglineEn: "Specialized AI engine for full-stack software engineering and architecture",
      descriptionAr: "المحرك البرمجي المخصص لتطوير التطبيقات الكاملة، كتابة الكود النظيف، تصحيح الأخطاء المعقدة، والتكامل التام مع Native Sandbox لتشغيل الأوامر ومعاينة الخوادم الحية.",
      descriptionEn: "A purpose-built software engineering intelligence engineered to generate production-ready codebases, resolve runtime errors, design architectures, and interact with the native sandbox terminal.",
      idealForAr: [
        "بناء تطبيقات الويب الكاملة (Next.js, React, Node.js, Tailwind)",
        "تصميم قواعد البيانات والمخططات وعمليات الـ Migration",
        "فحص الثغرات الأمنية وتصحيح أخطاء الـ Build و الـ Runtime",
        "تنفيذ الأوامر البرمجية والتحكم بالساندبوكس المعزول مباشرة"
      ],
      idealForEn: [
        "Building end-to-end full-stack web applications (Next.js, React, Node, Tailwind)",
        "Schema architecture, migrations, and database indexing",
        "Automated root-cause debugging, build fixes and security audits",
        "Direct Native Sandbox orchestration, npm commands, and shell execution"
      ]
    },
    capabilities: {
      context_window: 1048576,
      context_window_label: "1,048,576 Token (~750,000 كلمة)",
      vision: true,
      vision_notes_ar: "تحليل صور تصاميم UI/UX وتحويل الواجهات إلى كود React فوري",
      vision_notes_en: "Inspect Figma/UI mockups and compile them directly to React code",
      tools: true,
      reasoning: true,
      reasoning_level: "high",
      coding: true,
      coding_level: "state_of_the_art",
      web: true,
      image: true,
      files: true,
      structured_output: true,
      streaming: true
    },
    limits: {
      max_context_tokens: 1048576,
      max_output_tokens: 16384,
      rate_limits: {
        rpm: 50,
        tpm: 1200000,
        rpd: 8000
      },
      tool_limits: {
        max_parallel_tools: 10,
        sandbox_timeout_seconds: 300, // 5 min
        max_file_size_mb: 100
      },
      agent_limits: {
        max_steps_per_task: 30,
        max_execution_minutes: 15
      },
      usage_limits: {
        free_daily_messages: 25,
        pro_tier_unlimited: true
      }
    },
    supported_tools: [
      { id: "sandbox", nameAr: "بيئة الساندبوكس الأصلية (Native)", nameEn: "Native Sandbox Engine", descriptionAr: "عزل كامل مع إمكانية تشغيل Node, Python, C++, Rust وبناء الحزم", descriptionEn: "Full container isolation running node, python, rust, package managers", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "terminal", nameAr: "الطرفية البرمجية التفاعلية", nameEn: "Interactive Dev Terminal", descriptionAr: "تشغيل أوامر bash, git, npm, pnpm ومشاهدة المخرجات الحية", descriptionEn: "Execute bash scripts, git operations, and stream stdout/stderr", available: true, requiresSession: true, safetyLevel: "elevated" },
      { id: "files", nameAr: "محرر ومولد الملفات SoufFile", nameEn: "SoufFile Workspace", descriptionAr: "إنشاء وتعديل ملفات الكود والشجرة البرمجية مباشرة", descriptionEn: "Direct file tree creation, multi-file edits, and diff patching", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "preview", nameAr: "المعاينة الحية للتطبيقات", nameEn: "Live Sandbox Preview", descriptionAr: "معاينة تطبيقات الويب مباشرة داخل iFrame آمن مع رصد الأخطاء", descriptionEn: "Render running web app inside isolated sandboxed frame", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "web", nameAr: "بحث التوثيق البرمجي", nameEn: "API & Docs Grounding", descriptionAr: "استخراج أحدث توثيقات المكتبات والـ SDKs وتجنب الـ Deprecations", descriptionEn: "Crawl up-to-date documentation and prevent deprecated syntax", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "vision", nameAr: "الرؤية البصرية للواجهات", nameEn: "UI Screen-to-Code Vision", descriptionAr: "تحويل لقطات الشاشة وتصاميم الهواتف إلى واجهات كود متطابقة", descriptionEn: "Convert wireframes, mockups and screens to pixel-accurate code", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "search", nameAr: "البحث عن حلول الأخطاء", nameEn: "Error Code Search", descriptionAr: "البحث عن رسائل الأعطال في StackOverflow و GitHub Issues", descriptionEn: "Search runtime exception traces across open-source bug trackers", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "image", nameAr: "توليد أيقونات وأصول UI", nameEn: "UI Asset Synthesis", descriptionAr: "توليد أيقونات وخلفيات ورسومات للمشاريع البرمجية", descriptionEn: "Synthesize icons, banners, and textures for codebases", available: true, requiresSession: false, safetyLevel: "standard" }
    ],
    configuration_schema: {
      default_temperature: 0.2, // low for precise code syntax
      min_temperature: 0.0,
      max_temperature: 0.8,
      default_top_p: 0.9,
      supports_system_instructions: true,
      default_max_output_tokens: 16384,
      allowed_safety_thresholds: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE"]
    },
    features: [
      { ar: "توليد كود إنتاجي متوافق مع معايير TypeScript الصارمة و Next.js 15+", en: "Generates production-ready, strictly-typed code for modern stacks" },
      { ar: "تكامل مباشر مع Native Sandbox لتشغيل الأوامر الحقيقية دون محاكاة", en: "Deep integration with native sandbox executing real shell commands" },
      { ar: "تصحيح ذاتي للأخطاء البرمجية عبر مراجعة مخرجات الطرفية و lint", en: "Self-correcting build loop inspecting compiler and lint errors" }
    ]
  },

  ultra: {
    model_id: "ultra",
    display_name: "SoufAI Ultra",
    provider: "Google Gemini 2.5 Pro Ultra Flagship",
    version: "v2.5-ultra-flagship (2026)",
    status: "operational",
    routing_priority: 5,
    identity: {
      archetype: "apex",
      accentColor: "#f43f5e",
      badgeAr: "الأفضل والأعلى ذكاءً",
      badgeEn: "Flagship Apex",
      taglineAr: "قمة الذكاء الاصطناعي، التفكير الفائق، والوكيل الذاتي المستقل",
      taglineEn: "The pinnacle of artificial intelligence, autonomous agency, and deep cognition",
      descriptionAr: "النموذج الرائد والأعلى قدرة في منظومة SoufTools، يمتلك أعلى درجات الذكاء التوليدي والاستدلال المنطقي المعقد، ومصمم لقيادة الوكلاء الذاتيين متعددين الخطوات وحل أعقد التحديات التقنية والعلمية.",
      descriptionEn: "The premier flagship tier powering autonomous multi-step agent graphs, deep cross-disciplinary scientific research, sophisticated architectural synthesis, and maximum contextual depth.",
      idealForAr: [
        "إدارة وتوجيه الوكلاء الأذكياء متعددي الخطوات ذاتياً (Autonomous Agent Loops)",
        "أعقد التحديات التحليلية والعلمية والرياضية التي تعجز عنها النماذج الأخرى",
        "التخطيط الاستراتيجي الشامل واتخاذ القرارات متعددة المتغيرات",
        "المشاريع الحساسة التي تتطلب صفر أخطاء وأعلى درجات الدقة والعمق"
      ],
      idealForEn: [
        "Autonomous multi-step agent workflows and self-orchestrating task graphs",
        "The most demanding cross-disciplinary challenges requiring deep cognitive synthesis",
        "Strategic decision analysis with multi-variable probabilistic optimization",
        "Mission-critical engineering tasks demanding maximum precision and zero hallucination"
      ]
    },
    capabilities: {
      context_window: 2097152, // 2M tokens
      context_window_label: "2,097,152 Token (~1,500,000 كلمة)",
      vision: true,
      vision_notes_ar: "أعلى دقة تحليل وسائط بصرية ووثائق معقدة وفيديوهات",
      vision_notes_en: "Highest visual fidelity for fine-grained diagram, video and document parsing",
      tools: true,
      reasoning: true,
      reasoning_level: "deep_research",
      coding: true,
      coding_level: "state_of_the_art",
      web: true,
      image: true,
      files: true,
      structured_output: true,
      streaming: true
    },
    limits: {
      max_context_tokens: 2097152,
      max_output_tokens: 32768,
      rate_limits: {
        rpm: 30,
        tpm: 1000000,
        rpd: 3000
      },
      tool_limits: {
        max_parallel_tools: 12,
        sandbox_timeout_seconds: 600, // 10 min
        max_file_size_mb: 250
      },
      agent_limits: {
        max_steps_per_task: 50,
        max_execution_minutes: 30
      },
      usage_limits: {
        free_daily_messages: 10,
        pro_tier_unlimited: true
      }
    },
    supported_tools: [
      { id: "sandbox", nameAr: "بيئة الساندبوكس الشاملة", nameEn: "Full Native Sandbox", descriptionAr: "عزل فائق مع أعلى تخصيص للذاكرة والمعالج والأدوات", descriptionEn: "Ultra-isolated runtime with maximum memory, CPU and filesystem quotas", available: true, requiresSession: true, safetyLevel: "restricted" },
      { id: "terminal", nameAr: "طرفية الوكيل الذاتي", nameEn: "Autonomous Agent Terminal", descriptionAr: "تنفيذ سلاسل أوامر معقدة والتحقق الذاتي من النتائج", descriptionEn: "Execute chained commands with autonomous verification", available: true, requiresSession: true, safetyLevel: "restricted" },
      { id: "web", nameAr: "البحث الأكاديمي والتحليلي العميق", nameEn: "Deep Cognitive Web Crawl", descriptionAr: "استكشاف مئات الروابط وبناء الرسوم البيانية المعرفية", descriptionEn: "Traverse complex web graphs and build comprehensive knowledge trees", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "files", nameAr: "مستودع الملفات المتعدد", nameEn: "Enterprise File Repository", descriptionAr: "إدارة مشاريع كاملة بمئات الملفات والوثائق", descriptionEn: "Manage multi-repository trees, binary assets and large documents", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "vision", nameAr: "الرؤية البصرية الفائقة", nameEn: "Ultra Multimodal Intelligence", descriptionAr: "فهم دقيق للصور المجهرية والمخططات الهندسية المعمارية", descriptionEn: "High-resolution perception for architectural blueprints and schematics", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "search", nameAr: "محرك التوثيق الشامل", nameEn: "Deep Citation Engine", descriptionAr: "توثيق متعدد المصادر مع فحص صحة المراجع والبيانات", descriptionEn: "Multi-layered citation verification with source hallucination checks", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "preview", nameAr: "معاينة المنظومات المتقدمة", nameEn: "Full System Preview", descriptionAr: "معاينة تطبيقات متكاملة مع قواعد بيانات ومنافذ متعددة", descriptionEn: "Render full-stack web applications and micro-service previews", available: true, requiresSession: false, safetyLevel: "standard" },
      { id: "image", nameAr: "استوديو الصور الإبداعي المتقدم", nameEn: "Creative Studio Suite", descriptionAr: "توليد صور فنية بدقة 4K مع تحكم كامل بالأسلوب الفني", descriptionEn: "4K asset generation with granular style guidance and render pipeline", available: true, requiresSession: false, safetyLevel: "standard" }
    ],
    configuration_schema: {
      default_temperature: 0.4,
      min_temperature: 0.0,
      max_temperature: 1.0,
      default_top_p: 0.95,
      supports_system_instructions: true,
      default_max_output_tokens: 32768,
      allowed_safety_thresholds: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE"]
    },
    features: [
      { ar: "أعلى قدرة استدلالية على الإطلاق في جميع اختبارات Benchmark العالمية", en: "Highest reasoning capabilities across industry-standard benchmarks" },
      { ar: "دعم سياق استثنائي بحجم 2,097,152 توكن مع أقصى دقة استرجاع", en: "2 Million token context window with near-perfect retrieval needle-in-haystack" },
      { ar: "القلب النابض لمحرك الوكيل الذاتي SoufAI Agent Engine", en: "Primary cognitive driver for autonomous multi-step SoufAI agent executions" }
    ]
  }
};

/**
 * Helper to fetch a model by ID
 */
export function getModelById(id: string): SoufModelRegistryEntry | null {
  const clean = (id || "").toLowerCase().trim();
  return SOUF_MODEL_REGISTRY[clean] || null;
}

/**
 * Helper to get all registered models sorted by priority
 */
export function getAllModels(): SoufModelRegistryEntry[] {
  return Object.values(SOUF_MODEL_REGISTRY).sort((a, b) => a.routing_priority - b.routing_priority);
}

/**
 * Smart Task Recommendation Engine
 * Analyzes task intent and keywords, evaluates capabilities and efficiency,
 * and recommends the ideal model with concrete, factual reasoning.
 */
export function recommendModelForTask(taskText: string): {
  recommendedId: "spark" | "core" | "pro" | "coder" | "ultra";
  alternativeId?: "spark" | "core" | "pro" | "coder" | "ultra";
  confidence: number;
  reasonsAr: string[];
  reasonsEn: string[];
  detectedTaskType: string;
} {
  const text = (taskText || "").toLowerCase().trim();

  // 1. Coding / Full-stack Software Engineering
  const codingKeywords = [
    "كود", "برمجة", "تطبيق", "موقع", "صفحة", "خوارزمية", "api", "react", "next.js", "nextjs",
    "python", "javascript", "typescript", "bug", "ثغرة", "خطأ", "سيرفر", "قاعدة بيانات", "sql",
    "backend", "frontend", "sandbox", "طرفية", "terminal", "npm", "saas", "git", "css", "html"
  ];
  const isCoding = codingKeywords.some(k => text.includes(k));

  if (isCoding) {
    // If very complex fullstack/agent -> Coder or Ultra
    if (text.includes("saas") || text.includes("معقد") || text.includes("نظام متكامل") || text.includes("architect")) {
      return {
        recommendedId: "coder",
        alternativeId: "ultra",
        confidence: 96,
        reasonsAr: [
          "المهمة تتطلب كتابة كود وهندسة برمجيات وبناء ملفات حقيقية.",
          "يمتلك SoufAI Coder وصولاً مباشراً إلى بيئة الساندبوكس المعزولة (Native Sandbox) لتشغيل وفحص الكود.",
          "تم ضبط درجة الحرارة والدقة في نموذج Coder لمنع الأخطاء النحوية والبرمجية."
        ],
        reasonsEn: [
          "The task involves full-stack software development, code generation, and multi-file architecture.",
          "SoufAI Coder is directly wired to the Native Sandbox runtime for compilation and terminal commands.",
          "Tuned for deterministic, clean TypeScript and framework syntax."
        ],
        detectedTaskType: "coding_engineering"
      };
    }
    return {
      recommendedId: "coder",
      alternativeId: "core",
      confidence: 92,
      reasonsAr: [
        "تم رصد استفسار برمجي أو تطويري.",
        "نموذج Coder مدرب ومخصص لحل المشكلات البرمجية ومراجعة الكود.",
        "يدعم المعاينة الحية للواجهات والتحقق من سلامة الأوامر."
      ],
      reasonsEn: [
        "Detected programming or debugging requirements.",
        "Coder model is optimized for software engineering and automated review.",
        "Supports live preview and sandbox execution."
      ],
      detectedTaskType: "coding_standard"
    };
  }

  // 2. High-speed, instant summarization or simple queries
  const speedKeywords = [
    "سريع", "لخص", "تلخيص", "مباشر", "بسرعة", "ترجم", "ترجمة", "تدقيق", "تصحيح لغوي", "معنى",
    "تعريف", "فكرة سريعة", "fast", "summary", "summarize", "quick", "translate"
  ];
  const isSpeed = speedKeywords.some(k => text.includes(k));

  if (isSpeed && text.length < 300) {
    return {
      recommendedId: "spark",
      alternativeId: "core",
      confidence: 95,
      reasonsAr: [
        "المهمة تركز على السرعة الفورية والردود اللحظية.",
        "يتميز SoufAI Spark بأقل زمن استجابة (أقل من 80ms) لتوفير الوقت واستهلاك التوكنز.",
        "مثالي لتلخيص المقالات، الترجمة اللغوية، والأسئلة المباشرة دون إبطاء."
      ],
      reasonsEn: [
        "The task prioritizes ultra-fast turnaround and instant response.",
        "SoufAI Spark delivers sub-80ms first-token latency, maximizing speed and efficiency.",
        "Ideal for rapid summaries, on-the-fly translation, and immediate answers."
      ],
      detectedTaskType: "instant_speed"
    };
  }

  // 3. Ultra complex, strategic, multi-step autonomous agent
  const ultraKeywords = [
    "وكيل", "agent", "مستقل", "استراتيجي", "معقد جدا", "بحث علمي", "أطروحة", "رياضيات متقدمة",
    "تحليل شامل", "multi-step", "autonomous", "دراسة جدوى", "استثمار", "تخطيط استراتيجي"
  ];
  const isUltra = ultraKeywords.some(k => text.includes(k));

  if (isUltra) {
    return {
      recommendedId: "ultra",
      alternativeId: "pro",
      confidence: 94,
      reasonsAr: [
        "المهمة تتطلب تفكيراً استنتاجياً عميقاً وحل مشكلات متعددة المراحل.",
        "SoufAI Ultra يمتلك أقصى قدرة استدلالية وأكبر نافذة سياق (2 مليون توكن).",
        "النموذج الوحيد المجهز لقيادة الوكلاء الذاتيين متعددي الخطوات بأعلى درجات الموثوقية."
      ],
      reasonsEn: [
        "The task demands multi-step autonomous reasoning and rigorous deductive depth.",
        "SoufAI Ultra provides apex intelligence and a 2M token context window.",
        "Equipped to drive autonomous agent loops with self-verifying consistency."
      ],
      detectedTaskType: "apex_reasoning"
    };
  }

  // 4. Research, long documents, academic writing -> Pro
  const proKeywords = [
    "بحث", "مقال طويل", "تحليل", "مقارنة", "دراسة", "pdf", "وثيقة", "عقد", "كتاب", "تقرير مفصل",
    "تاريخي", "فلسفي", "أكاديمي", "research", "paper", "deep"
  ];
  const isPro = proKeywords.some(k => text.includes(k));

  if (isPro || text.length > 300) {
    return {
      recommendedId: "pro",
      alternativeId: "core",
      confidence: 90,
      reasonsAr: [
        "المهمة تتطلب تحليلاً دقيقاً ومطولاً مع صياغة ذات جودة عالية.",
        "يمتلك SoufAI Pro نافذة سياق تصل إلى 2 مليون توكن لاستيعاب مئات الصفحات.",
        "دعم كامل للبحث العميق وتدقيق المصادر واستخلاص الحقائق."
      ],
      reasonsEn: [
        "The task requires in-depth research, long-form synthesis, and robust reasoning.",
        "SoufAI Pro features a 2M token window to digest massive multi-page documents.",
        "Deeply grounded in multi-source citation and structured comparative analysis."
      ],
      detectedTaskType: "deep_research"
    };
  }

  // 5. Default -> Core (Balanced Daily Driver)
  return {
    recommendedId: "core",
    alternativeId: "spark",
    confidence: 88,
    reasonsAr: [
      "مهمة قياسية متوازنة تناسب النموذج اليومي الأساسي.",
      "SoufAI Core يوفر التوازن الأمثل بين سرعة الرد وجودة التفكير.",
      "يدعم كافة أدوات المنظومة والبحث اللحظي مع موثوقية تشغيل عالية."
    ],
    reasonsEn: [
      "Standard balanced task ideal for the daily workhorse engine.",
      "SoufAI Core delivers the optimal ratio of fast latency to reasoning quality.",
      "Comprehensive tool support with dependable everyday performance."
    ],
    detectedTaskType: "balanced_general"
  };
}
