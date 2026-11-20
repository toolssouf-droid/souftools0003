# SoufTools AI — منصة الذكاء الاصطناعي والوكلاء متعددة القنوات

منصة ويب متكاملة للذكاء الاصطناعي وتنسيق الوكلاء البرمجيين والبحثيين، مبنية بـ **Next.js 15 (App Router)** و**TypeScript** و**Turso (libSQL) + Drizzle ORM**، مع دعم كامل للغة العربية واتجاه **RTL/LTR** وربط متعدد القنوات عبر الويب و**واتساب** و**تيليجرام**.

---

## المعمارية والتقنيات الفعلية (Verified Tech Stack)

- **إطار العمل والواجهة**: Next.js `15.5.23` (App Router)، React `19`، TypeScript `5`.
- **التنسيق والحركة**: Tailwind CSS v4 (`@import "tailwindcss";` في `app/globals.css`)، `lucide-react`، و`motion/react`.
- **قاعدة البيانات المستهدفة والرئيسية**: **Turso / libSQL** عبر `@libsql/client` و**Drizzle ORM** (`drizzle-orm/sqlite-core`) بنمط المستودعات المعزولة (`lib/db/index.ts`).
  - *ملاحظة*: تم ترحيل طبقة قاعدة البيانات من PostgreSQL/PGlite إلى Turso؛ وتبقى سكربتات الترحيل والتحقق (`scripts/migrate-pg-to-turso.ts`، `scripts/verify-turso-migration.ts`) لأغراض الترحيل والتوافق التاريخي.
- **طابور المهام الخلفية وتخزين الكائنات**:
  - **طابور المهام**: `lib/queue/workerQueue.ts` يعتمد على جدول `worker_jobs` في Turso بنظام `Claim / Lease`.
  - **تخزين الملفات الخاص**: `lib/storage/objectStorage.ts` يحفظ الملفات محلياً على قرص الخادم (`STORAGE_LOCAL_DIR` أو `.souftools_storage`) مع فحص Magic Bytes وروابط تنزيل موقعة بـ HMAC-SHA256، ويحفظ بيانات الوصف والحصص في Turso (`storage_objects`). يلزم مسار دائم وقابل للكتابة في الإنتاج؛ بيئات serverless دون قرص دائم لا تدعم رفع ملفات مستديم حالياً.
- **الذكاء الاصطناعي والوكلاء**:
  - موجه المزودين (`lib/router.ts` و`lib/providers/index.ts`) يسجل 38 مزود دردشة/LLM، ومزودين للصوت، ومزوداً للتضمينات. يستخدم واجهات المزودين الفعلية (Gemini SDK، OpenAI Responses، Anthropic Messages، Cohere Chat v2، Bedrock Converse، Replicate Predictions، وواجهات OpenAI-compatible)، مع جلب حي للنماذج المتاحة في الحساب.
  - محرك محادثة وتفكير استدلالي (`lib/agent/agentRuntime.ts`) مع فرز نوايا (`classifierEngine.ts`, `zeroComputeTriage.ts`) وأدوات حقيقية (وقت، حاسبة، بحث ويب، توليد ملفات وصور، ساندبوكس).
  - منسق وكلاء هندسيين (`lib/agent/engine/soufAIEngine.ts`) يضم 11 وكيلاً متخصصاً (`lib/agent/engine/workers/*`) مع نقاط استعادة دائمة في Turso.
- **المصادقة والصلاحيات**:
  - المصادقة الأساسية للخادم عبر **Better Auth** (`lib/auth/betterAuth.ts` مع محول Turso) وجلسات موقعة (`lib/auth/serverAuth.ts`) ونظام صلاحيات (`user` / `admin` / `super_admin`).
  - *حالة انتقال جزئية*: لا تزال حزمة `firebase` (`lib/firebase.ts`) مستوردة في بعض مسارات العميل الثانوية (`/memory`، `/telegram/gmail-connect`، `/telegram/drive-connect`، `unifiedAuth.ts`).
- **القنوات والأتمتة والأمان**:
  - واتساب عبر `@whiskeysockets/baileys` بحفظ الجلسة في `whatsapp_auth_sessions` بقاعدة Turso.
  - تيليجرام (Webhook وPolling، اقتران المستخدمين، وتوكنات Gmail/Drive المشفرة في Turso).
  - جدولة المهام الخلفية (`lib/scheduler/serverTaskRunner.ts` و`/api/cron/agent-scheduler`).
  - جدار حماية التطبيقات **SoufShield WAF**، `modelArmorGuardrail`، منع SSRF، وتشفير المفاتيح بـ **AES-256-GCM** (`lib/security/vault.ts`).

### إبقاء خادم التطبيق نشطاً

يوفر `GET /api/health` فحص حياة خفيفاً لا يتصل بقاعدة البيانات أو خدمات الذكاء الاصطناعي. يرسل Workflow في `.github/workflows/keep-server-alive.yml` طلباً مجدولاً ويسجل نتيجة HTTP؛ اضبط متغير المستودع `HEALTHCHECK_URL` في GitHub Actions على عنوان التطبيق الفعلي المنتهي بـ `/api/health`. يعمل الجدول بعد إضافة الـ Workflow إلى الفرع الافتراضي، ويمكن اختباره يدوياً عبر `workflow_dispatch`.

يستخدم GitHub cron التعبير `*/14 * * * *`، وهو ليس فاصلاً ثابتاً منقضياً: الطلبات تقع عند الدقائق 00 و14 و28 و42 و56، ثم تكون الفجوة إلى الساعة التالية 4 دقائق.

---

## الإعداد والتشغيل المحلي (Setup & Scripts)

### 1. تثبيت الاعتماديات
```bash
npm install
```

### 2. إعداد متغيرات البيئة (`.env.local`)
انسخ `.env.example` واضبط المتغيرات الأساسية على الخادم:
- **قاعدة البيانات (إلزامي)**:
  - `TURSO_DATABASE_URL`: رابط Turso Cloud (`libsql://...` أو `https://...`) أو مسار محلي مثل `file:./.turso_local/souftools.db`.
  - `TURSO_AUTH_TOKEN`: مطلوب عند استخدام رابط Turso Cloud بعيد.
  - إذا ظهر HTTP 404 من Turso، تحقّق من أن الرابط يشير إلى قاعدة نشطة وأن الرمز صادر من قاعدة البيانات نفسها؛ لا يستخدم التطبيق قاعدة بديلة عند تعذر الاتصال.
- **الذكاء الاصطناعي**: `GEMINI_API_KEY` (أو `GEMINI_API_KEYS` لتوزيع الحمولة).
- **المصادقة والتشفير والأمان**: `BETTER_AUTH_SECRET`، ويفضّل ضبط `APP_URL` أو `BETTER_AUTH_URL` على نطاق الإنتاج؛ عند غيابهما يستخدم النظام `https://souftools0003.enzonic.dev` في روابط إعادة التعيين، `SESSION_SECRET`، `MASTER_ENCRYPTION_KEY` (أو `DATA_ENCRYPTION_KEY`)، `ENCRYPTION_SECRET`، `STORAGE_SIGNING_SECRET`، `ADMIN_EMAIL`، `ADMIN_MASTER_PASSWORD_HASH`، `CRON_SECRET`.
- **البريد (إلزامي لإرسال رموز التحقق وروابط الاستعادة)**: إعداد SMTP (`SMTP_USER` و`SMTP_PASS` مع `SMTP_HOST`/`SMTP_PORT`) أو `RESEND_API_KEY`. **اختياري (القنوات وOAuth)**: `TELEGRAM_BOT_TOKEN`، `TELEGRAM_WEBHOOK_SECRET`، `GOOGLE_CLIENT_ID`/`SECRET`، `GITHUB_CLIENT_ID`/`SECRET`.

### 3. الأوامر المتاحة
```bash
# تشغيل خادم التطوير على المنفذ 3000
npm run dev

# فحص جودة الكود (ESLint)
npm run lint

# بناء نسخة الإنتاج وتشغيلها
npm run build
npm run start

# مزامنة/فحص مخطط Drizzle مع Turso
npx drizzle-kit push

# التحقق من ترحيل البيانات إلى Turso
npx tsx scripts/verify-turso-migration.ts

# التحقق من مصادقة ومزامنة الأجهزة
npm run verify:sync

# التحقق من استعادة جلسة الخادم وصلاحية المسؤول
npm run verify:auth
```

---

## خريطة التعليمات والوثائق (Documentation Map)

- `/AGENTS.md`: القواعد العامة لجميع وكلاء البرمجة والتسلسل الهرمي للتعليمات.
- `/GEMINI.md`: قواعد استخدام `@google/genai` والنماذج وتدوير المفاتيح.
- `/lib/db/AGENTS.md`: قواعد Turso / libSQL وDrizzle والمستودعات.
- `/lib/agent/AGENTS.md`: قواعد محرك الوكلاء والذاكرة والساندبوكس.
- `/app/api/AGENTS.md`: قواعد مسارات API والمصادقة والتحقق ومنع IDOR.
- `/lib/security/AGENTS.md`: قواعد الأمان والأسرار والتشفير.
- `/ARCHITECTURE.md` | `/PLAN.md` | `/PROGRESS.md`: تفاصيل البنية المعمارية وخطة التنفيذ وسجل التقدم الفعلي.
