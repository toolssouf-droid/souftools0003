# إرشادات تكامل نماذج الذكاء الاصطناعي وGemini (`GEMINI.md`)

يسري هذا الملف على جميع استدعاءات نماذج **Gemini** وموجه النماذج الذكي في منصة **SoufTools AI**، ويعمل بالتكامل مع التعليمات العامة في `/AGENTS.md` وتعليمات الوكلاء في `/lib/agent/AGENTS.md`.

---

## 1. قواعد استدعاء SDK وإدارة المفاتيح (Server-Side Only)

- **الخادم حصراً**: جميع استدعاءات `@google/genai` (`GoogleGenAI`) تتم في جانب الخادم فقط (`app/api/*` أو `lib/*`). يُمنع تماماً استيراد SDK أو قراءة `GEMINI_API_KEY` في مكونات العميل (`"use client"`).
- **المكتبة الرسمية المعتمدة**: استخدم `@google/genai` حصراً وتجنب المكتبات القديمة المهملة.
- **مصادر المفاتيح**:
  - متغيرات البيئة: `GEMINI_API_KEY` و`GEMINI_API_KEYS`.
  - إعدادات لوحة التحكم المشفرة في Turso (`admin_keys_config` عبر `lib/adminConfigStore.ts` و`lib/security/vault.ts`).
  - يدعم الموجه `lib/router.ts` توزيع المفاتيح التناوبي عبر `keyPoolManager`.

---

## 2. النماذج النشطة وسياسة التوجيه الصارمة (Models & Strict Routing)

### أ. النماذج المعتمدة في الكود الفعلي (`lib/providers/index.ts` و `lib/router.ts`)
- **في سجل المزودات الافتراضي (`SOUFAI_MODELS` و`AI_PROVIDERS.gemini`)**:
  - `gemini-3.7-flash` (الافتراضي السريع والمتوازن لـ `spark`, `core`, `ultra`)
  - `gemini-3.1-pro-preview` (الافتراضي للمهام المعقدة `pro`)
  - `gemini-3.1-flash-lite`، `gemini-3-flash-preview`، `gemini-flash-lite-latest`، `gemini-3.5-flash-lite`، `gemini-3.8-flash`، `gemini-flash-latest`
- **حماية الأسماء الملغاة (`resolveSafeChatModel` في `lib/router.ts`)**: يوجّه الموجه أي تسميات قديمة مثل `1.5-pro`/`2.5-pro` إلى `gemini-3.1-pro-preview`، و`1.5-flash`/`2.5-flash` إلى `gemini-3.7-flash` لتفادي أخطاء `404 NOT_FOUND`.
- **طبقة الرؤية الحاسوبية (`lib/vision/visionCapabilityLayer.ts`)**: تستخدم `gemini-3.7-flash` و`gemini-2.5-pro` ضمن قائمة النماذج البصرية المدعومة.
- **تنبيه تطابق بيانات التعريف**: ما زال ملف `lib/models/modelRegistry.ts` يحتوي في نصوص العرض (`provider`/`version`) على إشارات مثل `v2.5-flash`؛ المرجع الفعلي للتشغيل والتوجيه هو `lib/providers/index.ts` و`lib/router.ts` وإعدادات الإدارة في Turso.

### ب. الالتزام الصارم بتعيينات الإدارة (Strict Admin-Configured Policy)
- **لا تبديل غير مصرّح به**: عندما يعيّن مدير النظام مزودات أو نماذج معينة (`finalAssignments` و`activeModels`) في لوحة التحكم، يلتزم `lib/router.ts` بها حصراً ولا يُبدّل إلى نماذج أخرى خارج القائمة المفعّلة.
- **نموذج التصنيف الداخلي (`classifierEngine.ts`)**: يشترط تعيين مزود ونموذج ومفتاح ونشاط (`status !== "disabled"`) في لوحة التحكم، ويرفض التشغيل برسالة خطأ صريحة عند غياب التهيئة.

---

## 3. المرونة، الحماية من الحظر، وأداء الـ API

- **تدوير المفاتيح وعزل الأعطال**: يدير `keyPoolManager` التوزيع التناوبي عند أخطاء `429` أو `403`، بينما يدير `healthManager` فترات التهدئة (`Quarantine`) للنماذج المتعثرة دون حجب النموذج بسبب خطأ مفتاح غير صالح.
- **حماية الـ IP وتقليل الكمون**: يمر الاستدعاء عبر `requestDispatcher` (لتباعد الطلبات)، و`responseCache` (لاستعلامات الدردشة القابلة للتخزين المؤقت)، و`zeroComputeTriage` (لتقليل الحوسبة والأدوات غير الضرورية).
- **تسجيل الأخطاء**: تُسجل إخفاقات الاتصال والنماذج في Turso (`runtime_errors`) عبر `serverErrorManager`.

---

## 4. الأمان وجودة المخرجات (Language, Real Tools & Guardrails)

- **اللغة**: الرد للمستخدم باللغة المطلوبة وفق سياق اللغة (`createLocaleContext` / `buildMultilingualSystemPrompt`) مع الحفاظ على دقة المصطلحات التقنية وأكواد البرمجة.
- **إلزامية الأدوات الحقيقية**: يُحظر تخمين الوقت، العمليات الحسابية، أو نتائج البحث الحي؛ يجب تمريرها عبر `toolRouter` / `toolRegistry`.
- **الدفاع ضد حقن الأوامر (Prompt Injection)**:
  - تمر مدخلات المحادثة عبر `inspectRequestBody` و`inspectPromptGuardrails` (`lib/security/modelArmorGuardrail.ts`).
  - تُغلف كل نتائج البحث وقراءة الروابط بوسوم `<untrusted_tool_data>` عبر `wrapUntrustedContent` مع توجيه صريح بتجاهل أي تعليمات محقونة داخلها.
