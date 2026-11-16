# SoufTools AI Platform (منصة SoufTools للذكاء الاصطناعي)

## 📌 نظرة عامة (Overview)
منصة **SoufTools AI** هي منصة ويب متكاملة للذكاء الاصطناعي والوكلاء متعددي القنوات، مبنية باستخدام **Next.js 15 (App Router)**، **React 19**، **TypeScript**، و**Tailwind CSS v4**، مع قاعدة بيانات **Turso / libSQL** عبر **Drizzle ORM** ومحرك تخزين ملفات خاص على الخادم، وتدعم العربية والإنجليزية ولغات متعددة مع توافق كامل لاتجاه **RTL/LTR**.

---

## 🚀 الميزات والقدرات الرئيسية (Core Features)

### 1. نظام النماذج الذكية المتعددة وموجه الحوسبة (`lib/router.ts`)
- **دعم أكثر من 40 مزوداً للذكاء الاصطناعي**: التكامل الرسمي مع Gemini عبر `@google/genai`، إضافة إلى OpenAI, Anthropic, Groq, DeepSeek, Mistral, OpenRouter, Ollama وغيرها عبر REST.
- **فئات النماذج (`SOUFAI_MODELS`)**: Spark, Core, Pro, Ultra، إضافة إلى سجل المواصفات في `lib/models/modelRegistry.ts` ونموذج التصنيف الداخلي المخفي (`classifier`).
- **سياسة التوجيه الصارمة**: الالتزام الحصري بالمزودات والنماذج والمفاتيح المفعّلة من مدير النظام في لوحة التحكم (المخزنة مشفرة في Turso).

### 2. محرك الوكلاء المستقلين (`lib/agent/`)
- **وكيل الدردشة والاستدلال (`agentRuntime.ts`)**: يدعم دورة التفكير الإدراكية (تفكيك الهدف، فرضيات `Tree of Thoughts`، المراجعة الذاتية `Reflexion`) مع الفرز السريع `zeroComputeTriage` وإلزامية استدعاء الأدوات الحقيقية.
- **منسق المشاريع متعدد الوكلاء (`engine/soufAIEngine.ts`)**: يدير مخطط `taskGraph.ts` عبر 11 وكيلاً متخصصاً (`coding`, `research`, `design`, `debug`, `testing`, `vision`, `file`, `sandbox`, `dependency`, `security`, `verification`) مع نقاط استعادة دائمة في Turso.

### 3. الربط متعدد القنوات (Omnichannel: Web, WhatsApp, Telegram)
- **واتساب (`lib/whatsapp/baileysService.ts`)**: اتصال Baileys يحفظ مفاتيح الجلسة في جدول `whatsapp_auth_sessions` بقاعدة Turso مع عزل المجموعات وتقييد المعدل.
- **تيليجرام (`lib/telegram/telegramManager.ts`)**: يدعم الأوامر والوسائط والاقتران وتوكنات Google Drive/Gmail المشفرة في Turso (`telegram_paired_users`, `telegram_oauth_tokens`).
- **الذاكرة الموحدة (`lib/memory/memoryService.ts`)**: مشاركة السياق وتفضيلات المستخدم عبر القنوات من جدول `memories` في Turso.

### 4. الأدوات، الجدولة، والساندبوكس
- **توليد الملفات والأدوات (`lib/agent/tools/`, `lib/tools/`)**: أدوات الوقت العالمي، الآلة الحاسبة، البحث الحي، قراءة الروابط، وتوليد ملفات PDF/Word/Excel/Code وصور.
- **الجدولة الخلفية (`lib/scheduler/serverTaskRunner.ts`)**: تنفيذ المهام المستحقة من `scheduled_tasks` عبر الويب وواتساب وتيليجرام.
- **بيئة التنفيذ المعزولة (`lib/sandbox/nativeSandbox.ts`)**: عزل Linux ومراقبة الموارد وفحص المسارات عبر `/api/runtime/sandbox/*`.

---

## 🛠️ البنية التقنية (Tech Stack & Architecture)

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5
- **Styling & UI**: Tailwind CSS v4 (`app/globals.css`) + `lucide-react` + `motion/react`
- **Database & Persistence**:
  - **Turso / libSQL** (`@libsql/client`) + **Drizzle ORM** (`drizzle-orm/sqlite-core`).
  - نمط المستودعات المعزولة (**Repository Pattern**) في `lib/db/index.ts`.
  - طابور المهام الخلفي في `lib/queue/workerQueue.ts` (جدول `worker_jobs`).
- **Private Object Storage**:
  - تخزين محلي خاص على قرص الخادم (`lib/storage/objectStorage.ts` في `.souftools_storage`) مع فحص Magic Bytes وروابط موقعة بـ **HMAC-SHA256** وحفظ الوصف في Turso (`storage_objects`).
- **Authentication**:
  - **Better Auth** (`lib/auth/betterAuth.ts`) + جلسات HMAC موقّعة في Turso (`lib/auth/serverAuth.ts`) ونظام RBAC (`user` / `admin` / `super_admin`)، مع بقاء استخدام جزئي لـ Firebase Client Auth في بعض واجهات العميل الثانوية.
- **Security**:
  - تشفير المفاتيح بـ **AES-256-GCM** (`lib/security/vault.ts`)، جدار الحماية **SoufShield WAF** (`wafEngine.ts`)، حماية النماذج (`modelArmorGuardrail.ts`)، منع SSRF (`ssrfGuard.ts`)، وعزل مخرجات الأدوات داخل `<untrusted_tool_data>`.
