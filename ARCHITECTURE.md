# معمارية منصة SoufTools AI (`ARCHITECTURE.md`)

يوثّق هذا الملف البنية الفعلية الحالية لمنصة **SoufTools AI** استناداً إلى الكود المصدري المعتمد في المستودع.

---

## 1. النظرة المعمارية الشاملة

```
[Client UI: Next.js 15 App Router + React 19 + Tailwind CSS v4 + Zustand (UI state)]
       │
       ▼
[Edge / Perimeter Security: middleware.ts + SoufShield WAF (wafEngine.ts) + Locale Routing]
       │
       ▼
[Next.js API Layer: app/api/** (requireAuth / requireAdmin / Rate Limiter / Model Armor)]
       │
       ├──► [AI & Agent Core]
       │      ├─ lib/router.ts + lib/providers/* (38 chat/LLM + 2 audio + 1 embedding providers, KeyPool, Cache, Dispatcher)
       │      ├─ lib/agent/agentRuntime.ts (ToT, Reflexion, Classifier, Tool Router)
       │      └─ lib/agent/engine/soufAIEngine.ts (DAG TaskGraph + 11 Specialized Workers)
       │
       ├──► [Isolated Execution & Channels]
       │      ├─ lib/sandbox/sandboxManager.ts & nativeSandbox.ts (Linux Isolation / Jailed FS)
       │      ├─ lib/whatsapp/baileysService.ts (Persistent Singleton Socket)
       │      ├─ lib/telegram/telegramManager.ts (Webhook / Long Polling + Pairing)
       │      └─ lib/scheduler/serverTaskRunner.ts (Autonomous Claim/Lease Task Runner)
       │
       └──► [Data, Queue & Storage Separation]
              ├─ Database: Turso / libSQL + Drizzle ORM (lib/db/schema.ts, lib/db/index.ts)
              ├─ Job Queue: lib/queue/workerQueue.ts (worker_jobs table + Claim/Lease)
              └─ Object Storage: lib/storage/objectStorage.ts (Local FS + storage_objects + HMAC URLs)
```

---

## 2. الفصل بين قاعدة البيانات، طابور المهام، وتخزين الكائنات

### أ. قاعدة البيانات الدائمة (`/lib/db/*`)
- **المحرك الفعلي**: **Turso / libSQL** عبر `@libsql/client` و**Drizzle ORM** (`drizzle-orm/sqlite-core`).
- **الملفات الأساسية**:
  - `lib/db/schema.ts`: تعريف الجداول والفهارس والعلاقات بنمط SQLite (`text`, `integer` للـ `boolean` و`timestamp_ms` و`number`، و`real`، و`text(..., { mode: "json" })`).
  - `lib/db/migrate.ts`: دالة `validateTursoEnv()` (ترفض غياب `TURSO_DATABASE_URL` أو أي رابط `postgres://`، وتفرض `TURSO_AUTH_TOKEN` للروابط البعيدة) ومصفوفة `MIGRATION_STATEMENTS` التلقائية.
  - `lib/db/index.ts`: يفعّل `PRAGMA foreign_keys = ON` و`busy_timeout = 5000` (و`WAL` لملفات `file:`)، ويوفر `executeWithRetry()` و**21 مستودعاً معزولاً (Repository Pattern)**:
    `UserRepository`, `ConversationRepository`, `MemoryRepository`, `BehaviorRepository`, `StorageRepository`, `ProjectRepository`, `SettingsRepository`, `AuditRepository`, `AgentRepository`, `WorkerJobRepository`, `WatchHistoryRepository`, `ScheduledTaskRepository`, `NotificationRepository`, `UserLearningRepository`, `WhatsAppAuthRepository`, `WhatsAppPairedUsersRepository`, `UserSessionRepository`, `RuntimeSessionRepository`, `RuntimeErrorRepository`, `PushSubscriptionRepository`, `TelegramRepository`.
  - `lib/db/maintenance.ts`: `DatabaseMaintenanceService` للتنظيف الدوري للبيانات المنتهية.
- **ملاحظة الترحيل التاريخي**: توجد أدوات ترحيل من PostgreSQL إلى Turso (`scripts/migrate-pg-to-turso.ts`, `scripts/verify-turso-migration.ts`, `.turso_verify_mig/`) للاستخدام الترحيلي والتحققي فقط؛ ولا توجد أي حزم PostgreSQL (`pg`, `pglite`) مثبتة في `package.json`.

### ب. طابور المهام الخلفي (`/lib/queue/workerQueue.ts`)
- يعتمد على جدول `worker_jobs` عبر `WorkerJobRepository` (وليس على الذاكرة أو ملفات منفصلة).
- يدعم دلالات **Claim / Lease** (`claimNextJob`, `renewLease`, `completeJob`, `failJob`, `recoverStaleLeases`, `checkpoint`) مع إعادة محاولة أسيّة عند الإخفاق ومنع التضارب بين العمال.

### ج. تخزين الملفات والكائنات الخاص (`/lib/storage/objectStorage.ts`)
- **المكان الفعلي للبايتات**: نظام الملفات الخاص بالخادم (`STORAGE_LOCAL_DIR` أو `.souftools_storage`) — **ملاحظة**: لا يوجد تكامل فعلي مع S3 في الكود الحالي.
- **الحماية والبيانات الوصفية**:
  - التحقق من الحصص في جدول `user` (`storageUsedBytes` / `storageLimitBytes`) وحفظ البيانات الوصفية وSHA-256 في جدول `storage_objects` عبر `StorageRepository` داخل معاملة ذرية.
  - فحص Magic Bytes لمنع تزييف نوع الملف.
  - روابط تنزيل مؤقتة موقعة بـ **HMAC-SHA256** عبر:
    - `POST /api/v1/storage/upload`
    - `GET /api/v1/storage/download/[fileId]?token=...` (مع دعم Range Requests وترويسات الحماية `nosniff` و`CSP: sandbox` وفرض `attachment` للأنواع النشطة مثل HTML/SVG/JS).
    - `GET /api/v1/storage/files`

---

## 3. المصادقة وإدارة الصلاحيات (`lib/auth/*`)

- **الطبقة الأساسية (الخادم وTurso)**:
  - `lib/auth/betterAuth.ts`: Better Auth متصل بقاعدة Turso via `drizzleAdapter(..., { provider: "sqlite" })`.
  - `lib/auth/serverAuth.ts`: `resolveAuthUser`, `requireAuth`, `requireAdmin` مع دعم كوكي `souftools_auth_sig` الموقّع بـ HMAC والمحفوظ في جدول `session` (`UserSessionRepository`)، أو تحقق `ADMIN_MASTER_PASSWORD_HASH` via `lib/auth/adminRoles.ts`.
  - حظر قبول `x-user-email` / `x-user-id` أو كوكيز غير موقعة.
- **طبقة العميل المتبقية (Partial Legacy)**:
  - لا يزال `lib/firebase.ts` (Firebase Auth Client فقط؛ بدون Firestore/Storage) مستخدماً في `app/[locale]/memory/page.tsx`، `app/[locale]/telegram/gmail-connect/page.tsx`، `app/[locale]/telegram/drive-connect/page.tsx`، وضمن `lib/auth/unifiedAuth.ts` و`lib/sync/cloudSyncService.ts` و`lib/behavior/behaviorEngine.ts`.

---

## 4. محرك الذكاء الاصطناعي والوكلاء (`lib/router.ts`, `lib/agent/*`)

- **موجه النماذج (`lib/router.ts`)**:
  - يلتزم بالتكوينات المحفوظة في Turso (`lib/adminConfigStore.ts` عبر `SettingsRepository`).
  - يجمع بين `zeroComputeTriage`, `keyPoolManager` (توزيع تناوبي), `healthManager` (عزل مؤقت للنماذج/المفاتيح المتعثرة), `requestDispatcher`, و`responseCache`.
- **محرك الدردشة والاستدلال (`lib/agent/agentRuntime.ts`)**:
  - يمر بـ `classifierEngine.ts` (يلزم تهيئة المصنف في لوحة التحكم) و`toolRouter.ts` / `lib/agent/tools/toolRegistry.ts` لتنفيذ أدوات حقيقية (الوقت، الحساب، البحث، الرؤية، الملفات، الجدولة).
- **منسق المشاريع والوكلاء المتعددين (`lib/agent/engine/soufAIEngine.ts`)**:
  - يدير مخطط `TaskDependencyGraph` (`taskGraph.ts`) عبر 11 وكيلاً متخصصاً (`lib/agent/engine/workers/*`).
  - يحفظ المهام والخطوات ونقاط الاستعادة والأحداث في Turso (`agent_tasks`, `agent_steps`, `agent_checkpoints`, `agent_events`) مع بث SSE حي ودعم الإيقاف والاستئناف (`/api/v1/agent/stop`, `/api/v1/agent/resume`).
- **محرك SoufAI Nexus (`lib/agent/nexus/`)**:
  - يمرر `AbortSignal` من التشغيل إلى العمال وموجه النماذج والأدوات؛ لا يبدأ fallback جديداً بعد الإلغاء.
  - تمر استدعاءات الأدوات عبر `NexusToolBridge` للتحقق من المدخلات والصلاحيات والموافقات والمهل وتسجيل التنفيذ.
  - يحتفظ `ActiveNexusRunRegistry` بسجل التشغيل بهوية `runId` ويربطه بـ lease token وgeneration؛ التحديث والتنظيف وإيقاف المهمة يتحققون من ملكية التشغيل.
  - تحقق البنية التحتية عبر `npm run verify:nexus` باستخدام قاعدة libSQL محلية مؤقتة ومزودات نماذج وهمية، دون استدعاء LLM.
- **الذاكرة الموحدة (`lib/memory/*`)**: تشارك المعرفة والملف الشخصي عبر قنوات الويب وتيليجرام وواتساب داخل جدول `memories`.

---

## 5. بيئة التشغيل المعزولة (`lib/sandbox/*`)

- `lib/sandbox/nativeSandbox.ts` و`lib/sandbox/sandboxManager.ts`:
  - تنفذ عزلاً موضعياً على نظام Linux (`unshare`, `taskset`, `ulimit`, `resolveSafePath`, فحص الوصلات الرمزية `realpathSync`, تصفية متغيرات البيئة).
  - تحفظ حدود الساندبوكس وسجلات الجلسات في Turso (`SettingsRepository`, `RuntimeSessionRepository`).
  - تُستدعى حصراً عبر `/api/runtime/sandbox/*` لضمان عزل حزم الخادم عن المتصفح.

---

## 6. القنوات المتعددة والمراقبة والأمان

- **واتساب (`lib/whatsapp/baileysService.ts`, `lib/whatsapp/postgresAuthState.ts`)**: يحفظ مفاتيح Signal في جدول `whatsapp_auth_sessions` بـ Turso (مع الإبقاء على اسم الملف وبعض الدوال التوافقية قديماً)، ويقصر الرد على المحادثات الفردية مع Rate Limiting.
- **تيليجرام (`lib/telegram/telegramManager.ts`)**: يدعم Webhook وPolling والوسائط المتعددة، ويحفظ الاقتران وتوكنات Gmail/Drive المشفرة في Turso (`telegram_paired_users`, `telegram_oauth_tokens`).
- **الجدولة الخلفية (`lib/scheduler/serverTaskRunner.ts`)**: يستحوذ على المهام المستحقة من `scheduled_tasks` بنظام Claim/Lease وينفذها عبر القنوات المختلفة.
- **الأمان والمراقبة**:
  - `middleware.ts` + `lib/security/wafEngine.ts` + `threatEngine.ts` + `modelArmorGuardrail.ts` + `ssrfGuard.ts` + `rateLimiter.ts` + `vault.ts` (AES-256-GCM).
  - `lib/monitoring/watchdog.ts` + `queryProfiler.ts` + `lib/errors/errorManager.ts` (تخزين الأخطاء في `runtime_errors`).
