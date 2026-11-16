/**
 * SoufAI Encyclopedic Knowledge Base & Cognitive Sparks Engine
 * Curated repository of deep intellectual, algorithmic, scientific, and cognitive insights
 * Used by the Behavioral Notification Engine to generate high-value, curiosity-driven prompts.
 */

export interface KnowledgeSpark {
  id: string;
  category: "ai_algorithms" | "cognitive_science" | "software_architecture" | "physics_math" | "productivity_psychology" | "historical_breakthroughs";
  categoryAr: string;
  title: string;
  summary: string;
  actionableTakeaway: string;
  tags: string[];
  depthLevel: "foundational" | "intermediate" | "advanced";
  triggerContexts: string[]; // Keywords in user activity that make this spark highly relevant
}

export const ENCYCLOPEDIC_KNOWLEDGE_BASE: KnowledgeSpark[] = [
  {
    id: "spark-mab-01",
    category: "ai_algorithms",
    categoryAr: "خوارزميات الذكاء الاصطناعي",
    title: "معضلة الاستكشاف مقابل الاستغلال (Multi-Armed Bandit)",
    summary: "في أنظمة التعلم الآلي، يواجه النموذج دائماً معضلة: هل يستغل أفضل خيار معروف لتحقيق أعلى ربح فوري (Exploitation)، أم يستكشف خيارات جديدة قد تخفي نتائج أفضل بكثير (Exploration)؟",
    actionableTakeaway: "طبق مبدأ Thompson Sampling في قراراتك اليومية: خصص 20% من وقتك لتجربة أفكار غير مألوفة.",
    tags: ["reinforcement_learning", "algorithms", "decision_making"],
    depthLevel: "advanced",
    triggerContexts: ["خوارزمية", "ذكاء اصطناعي", "algorithm", "learning", "model", "optimization"]
  },
  {
    id: "spark-zeigarnik-02",
    category: "cognitive_science",
    categoryAr: "العلوم المعرفية والسلوكية",
    title: "تأثير زايجارنيك (Zeigarnik Effect) والقوة الذهنية للمهام غير المكتملة",
    summary: "اكتشفت عالمة النفس بلوما زايجارنيك أن الدماغ يحتفظ بالمهام غير المكتملة في حالة تأهب دائم وتوتر إيجابي حتى تُغلق تلك الحلقة (Open Loop).",
    actionableTakeaway: "إذا شعرت بتسويف، ابدأ بمجرد فتح الملف أو كتابة سطر واحد؛ فالدماغ سيتولى الضغط الداخلي لإكمال المهمة.",
    tags: ["psychology", "focus", "productivity"],
    depthLevel: "foundational",
    triggerContexts: ["مهمة", "تسويف", "تركيز", "مشروع", "انتاجية", "todo", "task"]
  },
  {
    id: "spark-fogg-03",
    category: "productivity_psychology",
    categoryAr: "علم النفس السلوكي",
    title: "معادلة فوغ السلوكية (B = MAP)",
    summary: "يقوم نموذج جامعة ستانفورد على أن أي سلوك لا يحدث إلا باجتماع 3 عوامل في نفس اللحظة: الدافع (Motivation)، والقدرة أو السهولة (Ability)، والمحفز المباشر (Prompt).",
    actionableTakeaway: "عندما تفشل في بناء عادة أو إنهاء عمل، لا تلم الدافع فقط، بل بسط الخطوة الأولى حتى تصبح مقاومة البدء صفراً.",
    tags: ["behavior", "habits", "motivation"],
    depthLevel: "intermediate",
    triggerContexts: ["عادة", "سلوك", "دافع", "تنظيم", "عادة يومية"]
  },
  {
    id: "spark-shannon-04",
    category: "physics_math",
    categoryAr: "الرياضيات ونظرية المعلومات",
    title: "إنتروبيا شانون (Shannon Entropy): قياس المفاجأة في البيانات",
    summary: "أرسى كلود شانون أساس العصر الرقمي بتعريف المعلومة بأنها 'مقدار تقليل عدم اليقين'. الرسالة التي تخبرك بما تعرفه بالفعل تحمل صفراً من المعلومات.",
    actionableTakeaway: "كلما كان السؤال أو الكود الذي تكتبه أكثر دقة واختصاراً، زادت كثافة القيمة وخفت الإنتروبيا المشوشة.",
    tags: ["information_theory", "math", "data"],
    depthLevel: "advanced",
    triggerContexts: ["بيانات", "كود", "data", "math", "information", "شبكات"]
  },
  {
    id: "spark-conway-05",
    category: "software_architecture",
    categoryAr: "هندسة البرمجيات والنظم",
    title: "قانون كونواي (Conway's Law) وتأثير هيكل الفرق على الكود",
    summary: "ينص القانون على أن أي منظومة تصمم نظاماً برمجياً سينتهي بها الأمر بإنتاج هيكل معماري يطابق قنوات التواصل داخل المنظمة نفسها.",
    actionableTakeaway: "قبل إعادة كتابة أو تقسيم نظامك إلى خدمات مصغرة (Microservices)، نظم أولاً حدود المسؤوليات والتواصل بين أعضاء الفريق.",
    tags: ["architecture", "software_engineering", "systems"],
    depthLevel: "intermediate",
    triggerContexts: ["برمجة", "هندسة", "تطوير", "architecture", "microservices", "clean_code"]
  },
  {
    id: "spark-pareto-06",
    category: "productivity_psychology",
    categoryAr: "علم النفس السلوكي والإنتاجية",
    title: "توزيع باريتو وقوة الـ 20% الحاسمة",
    summary: "في النظم المعقدة، 80% من النتائج تنبع من 20% من المدخلات الحيوية. في هندسة الكود، 80% من الأعطال تنشأ من 20% من الوحدات الأكثر تعقيداً.",
    actionableTakeaway: "حدد الـ 20% من الشيفرة أو المهام التي تشكل العمود الفقري لإنتاجيتك وركز طاقتك الذهنية عليها أولاً.",
    tags: ["pareto", "efficiency", "optimization"],
    depthLevel: "foundational",
    triggerContexts: ["وقت", "أداء", "تحسين", "تخطيط", "أولويات"]
  },
  {
    id: "spark-transformer-07",
    category: "ai_algorithms",
    categoryAr: "خوارزميات الذكاء الاصطناعي",
    title: "معمارية المحولات وآلية الانتباه الذاتي (Self-Attention)",
    summary: "غيرت ورقة 'Attention Is All You Need' عالم الحوسبة، عبر تمكين النماذج من وزن العلاقات بين جميع الكلمات بالتوازي بدلاً من المعالجة التسلسلية البطيئة.",
    actionableTakeaway: "في التفكير وحل المشكلات، اربط كل عنصر بالسياق العام الكلي في آن واحد بدلاً من التفكير الخطي المحدود.",
    tags: ["deep_learning", "nlp", "transformers", "attention"],
    depthLevel: "advanced",
    triggerContexts: ["ذكاء اصطناعي", "نماذج", "gemini", "llm", "ai", "transformer"]
  },
  {
    id: "spark-hebb-08",
    category: "cognitive_science",
    categoryAr: "العلوم المعرفية والأعصاب",
    title: "قاعدة هيب (Hebbian Plasticity): الخلايا التي تومض معاً تترابط معاً",
    summary: "تتعلم الشبكات العصبية الحيوية عبر تقوية الوصلات المشبكية بين الخلايا التي تنشط بشكل متزامن، وهو الأساس الحقيقي لكل من التعلم البشري والاصطناعي.",
    actionableTakeaway: "الربط المتكرر بين بيئة عمل معينة وحالة التركيز العميق يبني مسارات عصبية تجعل الدخول في التدفق الذهني تلقائياً.",
    tags: ["neuroscience", "learning", "habits"],
    depthLevel: "intermediate",
    triggerContexts: ["تعلم", "عادات", "تركيز", "ذاكرة", "أعصاب"]
  }
];
