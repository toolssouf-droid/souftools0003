# تعليمات قاعدة البيانات وDrizzle وTurso — `lib/db/AGENTS.md`

يسري هذا الملف على جميع الملفات داخل `lib/db/` وأي كود يتفاعل مع قاعدة البيانات أو المخططات أو الترحيل. يجب الالتزام به إلى جانب التعليمات العامة في `/AGENTS.md`.

---

## 1. المحرك المعتمد وإلزامية التهيئة (Turso / libSQL)

- **المحرك الوحيد للإنتاج والتطوير**: **Turso / libSQL** عبر `@libsql/client` و**Drizzle ORM** (`drizzle-orm/libsql` و`drizzle-orm/sqlite-core`).
- **ملفات التهيئة والمخطط**:
  - المخطط المركزي: `lib/db/schema.ts`
  - المستودعات والاتصال: `lib/db/index.ts`
  - التحقق من البيئة والـ DDL التلقائي: `lib/db/migrate.ts`
  - الصيانة والتنظيف: `lib/db/maintenance.ts`
  - إعداد Drizzle Kit: `drizzle.config.ts` و`lib/db/drizzle.config.ts` (`dialect: "turso"`)
- **رفض أي Fallback صامت**: تتحقق دالة `validateTursoEnv()` من وجود `TURSO_DATABASE_URL` وترمي خطأ صريحاً إذا كان مفقوداً أو إذا احتوى على `postgres://` أو `postgresql://`، وتشترط `TURSO_AUTH_TOKEN` للروابط البعيدة (`libsql://`, `https://`, `wss://`). لا تضف أبداً تراجعاً صامتاً إلى الذاكرة أو PostgreSQL أو PGlite أو Firestore.
- **ملفات libSQL المحلية**: عند استخدام مسار `file:...` محلياً، يُفعَّل `PRAGMA journal_mode = WAL;` و`PRAGMA foreign_keys = ON;` و`PRAGMA busy_timeout = 5000;`.

---

## 2. أنواع البيانات والعلاقات والفهارس في SQLite / Turso

لا تفترض أن أنواع أو تعبيرات PostgreSQL متوافقة مع Turso/libSQL:
- **الأنواع المعتمدة في `lib/db/schema.ts`**:
  - المعرّفات والنصوص: `text("col")` (لا يوجد نوع `uuid` أصلي).
  - القيم المنطقية: `integer("col", { mode: "boolean" })`.
  - التواريخ والطوابع الزمنية: `integer("col", { mode: "timestamp_ms" })`.
  - الأرقام الصحيحة والعشرية: `integer("col", { mode: "number" })` و`real("col")`.
  - الكائنات والمصفوفات JSON: `text("col", { mode: "json" }).$type<...>()` (يُخزن كنص JSON؛ لا تستخدم `JSONB` أو عوامل PostgreSQL مثل `@>` أو `->>` إلا إذا تحققت من توافق SQLite).
- **العلاقات والمفاتيح الأجنبية**: استخدم `.references(() => parent.id, { onDelete: "cascade" })` حيث يلزم، مع بقاء `PRAGMA foreign_keys = ON` مفعّلاً عند الاتصال. عند إدراج سجلات مرتبطة (مثل محادثات أو مشاريع أو تخزين)، تأكد من وجود سجل المستخدم أولاً (مثل استدعاء `UserRepository.upsertUser`).
- **الفهارس والقيود الفريدة**: عرّف `index(...)` و`uniqueIndex(...)` في المصفوفة الثالثة لـ `sqliteTable`، وطابقها في `MIGRATION_STATEMENTS` داخل `lib/db/migrate.ts` بصيغة `CREATE INDEX IF NOT EXISTS`.
- **توافق SQLite في الاستعلامات**:
  - لا تستخدم `pg_sleep` أو `ILIKE` أو `SERIAL` أو `ON CONFLICT` دون تحديد الأعمدة الهدف الصحيحة.
  - استخدم `onConflictDoUpdate` مع `target` مطابق لفهرس فريد أو مفتاح أساسي موجود فعلياً.
  - عند تمرير قوائم كبيرة لـ `inArray`، قسّمها إلى دفعات لتفادي حد المعاملات في SQLite.

---

## 3. المعاملات، إعادة المحاولة، ونمط المستودعات (Repositories & Transactions)

- **نمط المستودعات حصراً**: جميع عمليات القراءة والكتابة من التطبيق والـ API يجب أن تمر عبر المستودعات المصدّرة من `lib/db/index.ts` (مثل `UserRepository`, `ConversationRepository`, `MemoryRepository`, `BehaviorRepository`, `StorageRepository`, `ProjectRepository`, `SettingsRepository`, `AuditRepository`, `AgentRepository`, `WorkerJobRepository`, `WatchHistoryRepository`, `ScheduledTaskRepository`, `NotificationRepository`, `UserLearningRepository`, `WhatsAppAuthRepository`, `WhatsAppPairedUsersRepository`, `UserSessionRepository`, `RuntimeSessionRepository`, `RuntimeErrorRepository`, `PushSubscriptionRepository`, `TelegramRepository`, و`DatabaseMaintenanceService`).
- **تهيئة المخطط وإعادة المحاولة**: استخدم `getReadyDb()` لضمان تشغيل `ensureMigrationsRun()` قبل الاستعلام، واستخدم `executeWithRetry()` للعمليات الحساسة ضد أخطاء `SQLITE_BUSY` / `SQLITE_LOCKED` أو انقطاعات الشبكة العابرة (`Hrana`).
- **المعاملات الذرية (`database.transaction`)**: أي عملية تعدل أكثر من جدول أو تحدث رصيداً/حصة مع سجل (مثل خصم/زيادة `storageUsedBytes` مع `storage_objects`، أو حفظ ملفات مشروع مع `projects`، أو حذف محادثة ورسائلها) يجب أن تُنفَّذ داخل `database.transaction(async (tx) => ...)`.
- **دلالات Claim / Lease**: يجب الحفاظ على ذرية الاستحواذ على المهام وتجديد المهلة (`leaseOwner`, `leaseExpiresAt`) في `WorkerJobRepository` و`AgentRepository` و`ScheduledTaskRepository` لمنع التنفيذ المزدوج.

---

## 4. الفصل بين قاعدة البيانات، طابور المهام، وتخزين الملفات

- **قاعدة البيانات (`lib/db/*`)**: تخزن السجلات المهيكلة، الجلسات، الإعدادات المشفرة، وبيانات وصف الملفات. لا تخزن ملفات ثنائية ضخمة (Blobs) داخل جداول Turso.
- **طابور المهام (`lib/queue/workerQueue.ts`)**: يدير دورة حياة الوظائف الطويلة في جدول `worker_jobs` (`enqueue`, `claimNextJob`, `renewLease`, `completeJob`, `failJob`, `recoverStaleLeases`, `checkpoint`).
- **تخزين الكائنات (`lib/storage/objectStorage.ts`)**: يخزن البايتات الفعلية على القرص الخاص (`STORAGE_LOCAL_DIR` أو `.souftools_storage`) ويُسجل البيانات الوصفية والحصة في `storage_objects` عبر `StorageRepository`.

---

## 5. سياسة ملفات PostgreSQL القديمة والترحيل

- يُمنع إضافة مكتبات PostgreSQL (`pg`, `postgres`, `@electric-sql/pglite`) أو ربط أي خدمة جديدة بمتغير `DATABASE_URL`.
- تبقى ملفات مثل `scripts/migrate-pg-to-turso.ts`، `scripts/verify-turso-migration.ts`، مجلد `.turso_verify_mig/`، وبعض التسميات المتبقية لأغراض الترحيل والتوافق الموثق فقط، ولا تُحذف إلا بطلب صريح.
- عند تعديل المخطط أو المستودعات، حدّث `lib/db/schema.ts` و`MIGRATION_STATEMENTS` في `lib/db/migrate.ts` معاً، وتحقق عبر `npx tsx scripts/verify-turso-migration.ts` (أو تشغيل التهجير على قاعدة اختبار محلية) قبل إنهاء المهمة.
