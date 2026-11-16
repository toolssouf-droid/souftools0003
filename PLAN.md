# خطة تطوير منصة SoufTools AI (`PLAN.md`)

> توضّح هذه الوثيقة الحالة الحقيقية لمعالم المنصة استناداً إلى الكود الفعلي، مع التمييز الصريح بين ما هو **منفذ فعلياً**، **منفذ جزئياً**، **قيد التطوير/التنظيف**، و**خطة مستقبلية**.

---

## 1. الرؤية المعمارية المعتمدة حالياً
بناء منصة ذكاء اصطناعي ووكلاء مستقلة متعددة القنوات، تعتمد على **Next.js 15 (App Router)** مع **Turso / libSQL** عبر **Drizzle ORM** قاعدةً للبيانات الإنتاجية المستهدفة، و**Better Auth** للمصادقة الأساسية، وطابور مهام دائم، ومحرك تخزين ملفات خاص على الخادم، وحماية محيطية وداخلية متعددة الطبقات.

---

## 2. مصفوفة حالة المعالم (Status Matrix)

### ✅ منفذ فعلياً (Implemented in Codebase)
- **طبقة قاعدة البيانات على Turso / libSQL (`lib/db/`)**:
  - مخطط Drizzle (`sqlite-core`) في `lib/db/schema.ts`، مع تهيئة `MIGRATION_STATEMENTS` والتحقق الصارم `validateTursoEnv()` في `lib/db/migrate.ts` (رفض غياب `TURSO_DATABASE_URL` أو روابط `postgres://`).
  - نمط المستودعات المعزولة (21 مستودعاً في `lib/db/index.ts`) مع `executeWithRetry()` ومعاملات ذرية.
- **طابور المهام الخلفي (`lib/queue/workerQueue.ts`)**:
  - طابور دائم على جدول `worker_jobs` بدلالات `Claim / Lease` وتجديد المهلة وإعادة المحاولة الأسيّة.
- **تخزين الملفات الخاص المحلي (`lib/storage/objectStorage.ts`)**:
  - حفظ الملفات على نظام ملفات الخادم (`STORAGE_LOCAL_DIR` أو `.souftools_storage`) مع التحقق من الحصص، فحص Magic Bytes، وروابط تنزيل موقعة بـ **HMAC-SHA256** (`/api/v1/storage/upload`, `/api/v1/storage/download/[fileId]`, `/api/v1/storage/files`).
- **محرك الوكلاء المزدوج والأدوات الحقيقية (`lib/agent/`)**:
  - محرك الدردشة والاستدلال المعرفي (`agentRuntime.ts`) مع التصنيف السريع `zeroComputeTriage.ts` ومصنف النوايا الصارم `classifierEngine.ts`.
  - منسق الوكلاء المتعددين (`engine/soufAIEngine.ts`) مع مخطط DAG و11 وكيلاً متخصصاً (`engine/workers/*`) ونقاط استعادة دائمة في Turso وبث SSE مع الإيقاف والاستئناف.
  - تدعم مهام Nexus fencing tokens و`leaseGeneration`، وتُرفض الكتابات التابعة بعد فقدان الملكية. تمر إشارات الإلغاء إلى العمال وموجه النماذج، وتنفذ الأدوات عبر `NexusToolBridge`، وتربط سجلات التشغيل بـ`runId` والـ lease المالك. يغطي `npm run verify:nexus` هذه الحدود باختبارات محلية ومزودات موك؛ لا يتصل بمزود نماذج أو قاعدة إنتاج.
  - جرى التحقق محلياً من ترقية مخطط قديم واستعادة checkpoint. لم تُختبر هذه الترقية على قاعدة Turso إنتاجية.
- **الالتزام الصارم بتعيينات النماذج (`lib/router.ts`, `lib/adminConfigStore.ts`)**:
  - تدوير المفاتيح عبر `keyPoolManager`، حماية الـ IP (`responseCache`, `requestDispatcher`)، ومنع التبديل العشوائي لنماذج غير مفعّلة في لوحة التحكم.
- **الأمان المحيطي والحماية من الحقن (`lib/security/`, `middleware.ts`)**:
  - `SoufShield WAF`، فحص الأجسام المتداخلة (`inspectRequestBody`)، `modelArmorGuardrail`، عزل مخرجات الأدوات داخل `<untrusted_tool_data>`، منع SSRF (`ssrfGuard.ts`)، تقييد المعدل، وخزنة مفاتيح AES-256-GCM (`vault.ts`).
- **القنوات المتعددة والجدولة (`lib/whatsapp/`, `lib/telegram/`, `lib/scheduler/`)**:
  - حفظ جلسات واتساب في جدول `whatsapp_auth_sessions` بـ Turso، وعزل المجموعات في واتساب وتيليجرام، وحفظ اقتران تيليجرام وتوكنات OAuth المشفرة في Turso، وتنفيذ المهام المجدولة عبر `serverTaskRunner.ts`.
- **بيئة العزل (`lib/sandbox/nativeSandbox.ts`, `sandboxManager.ts`)**:
  - عزل الموارد والمسارات وفصل حزم Node.js خلف `/api/runtime/sandbox/*`.
- **مركز النماذج، تشخيص الأخطاء، والمراقبة**:
  - صفحات `/models` و`/models/compare`، تتبع الأخطاء في `runtime_errors` عبر `serverErrorManager`، ومراقبة النبض والاستعلامات (`watchdog.ts`, `queryProfiler.ts`).

---

### 🟡 منفذ جزئياً (Partially Implemented / Transitional State)
- **عزل وإنهاء الاعتماد على Firebase**:
  - تم نقل الجلسات الأساسية وإدارة المستخدمين إلى **Better Auth + Turso** (`lib/auth/betterAuth.ts`, `lib/auth/serverAuth.ts`)، ولا يُستخدم Firestore أو Firebase Storage لتخزين البيانات.
  - ومع ذلك، ما زالت حزمة `firebase` (`lib/firebase.ts`) مستخدمة جزئياً على جانب العميل في صفحات `/memory` و`/telegram/gmail-connect` و`/telegram/drive-connect` وضمن `unifiedAuth.ts` و`cloudSyncService.ts` و`behaviorEngine.ts`.
- **حوكمة الأسرار الاحتياطية في الكود**:
  - الأسرار الإنتاجية تقرأ من متغيرات البيئة على الخادم، لكن بعض الوحدات (`vault.ts`, `objectStorage.ts`, `serverAuth.ts`) ما زالت تحتوي قيماً احتياطية محلية للتطوير عند غياب متغيرات البيئة.
- **البيئة المعزولة (Native Sandbox) عبر أنظمة التشغيل**:
  - ضوابط Linux (`unshare`, `taskset`, `ulimit`) تعمل في بيئات Linux الداعمة لها مع سلوك تراجعي على البيئات التي لا تدعم `unshare` أو على Windows (`win32`).

---

### 🔄 قيد التطوير والتنظيف (In Progress / Cleanup Pending)
- **توحيد وإزالة بقايا مسميات PostgreSQL وملفات الترحيل القديمة**:
  - لا يزال الترحيل موثقاً ومصحوباً بأدوات التحقق (`scripts/migrate-pg-to-turso.ts`, `scripts/verify-turso-migration.ts`, `.turso_verify_mig/`).
  - لم تُعد تسمية بعض الملفات والحقول القديمة بعد، مثل `lib/whatsapp/postgresAuthState.ts`، حقول `postgresHealth`/`postgresVersion` في `lib/analytics/`، وسكربت `scripts/migrate.ps1` الذي ما زال يشير إلى `DATABASE_URL`.
- **التنظيف النهائي للمخلفات الشكلية والتكوينات المزدوجة**:
  - ملفات JSON القديمة في `/data/*` تُستخدم فقط للاستيراد الأوّلي في بعض الوحدات عند خلو جدول `settings`، لكنها لا تزال موجودة في المستودع.
  - وجود ملفين لـ Drizzle config (`/drizzle.config.ts` و`/lib/db/drizzle.config.ts`) وملفات نشر Firebase القديمة (`firebase.json`, `FIREBASE_DEPLOYMENT_GUIDE.md`).

---

### 📋 خطة مستقبلية (Planned / Future)
- **تخزين الكائنات السحابي (S3-Compatible Object Storage Backend)**: إضافة محول S3/R2 فعلي إلى `lib/storage/objectStorage.ts` كخيار إنتاجي بديل للقرص المحلي عند التوسع الأفقي (Multi-instance deployment).
- **إزالة Firebase SDK بالكامل**: استبدال ما تبقى من استدعاءات `lib/firebase.ts` في واجهات العميل الثلاث بالاعتماد الخالص على `Better Auth` وجلسات الخادم.
- **فرض فحوصات النوع والبناء الصارمة**: إزالة تجاوزات `ignoreBuildErrors` و`ignoreDuringBuilds` في `next.config.ts` بعد معالجة جميع تحذيرات TypeScript وESLint.
- **فصل العمال الخلفيين كخدمة مستقلة (Dedicated Worker Process)**: تشغيل مستهلك طابور `lib/queue/workerQueue.ts` كعملية خلفية مخصصة منفصلة عن خادم الويب في بيئات الإنتاج الكبيرة.
