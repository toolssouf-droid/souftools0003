# تعليمات الأمان وإدارة الأسرار والصلاحيات — `lib/security/AGENTS.md`

يسري هذا الملف على جميع وحدات الأمان والتشفير والصلاحيات في `lib/security/` و`lib/encryption.ts` وما يتصل بها. التزم أيضاً بـ `/AGENTS.md`.

---

## 1. إدارة الأسرار ومتغيرات البيئة (Server-Only Secrets)

- **ممنوع تسريب الأسرار للعميل**: المتغيرات التالية تبقى **حصراً في الخادم** ولا يُسمح أبداً بتصديرها عبر `NEXT_PUBLIC_*` أو تضمينها في مكونات `"use client"` أو إعادتها في استجابات API:
  - `GEMINI_API_KEY`، `GEMINI_API_KEYS`، ومفاتيح أي مزود ذكاء اصطناعي آخر.
  - `TURSO_AUTH_TOKEN`
  - `BETTER_AUTH_SECRET` و`SESSION_SECRET`
  - `MASTER_ENCRYPTION_KEY` و`DATA_ENCRYPTION_KEY` و`ENCRYPTION_SECRET`
  - `STORAGE_SIGNING_SECRET`
  - `ADMIN_MASTER_PASSWORD_HASH`
  - `CRON_SECRET` و`TELEGRAM_WEBHOOK_SECRET`
  - `GOOGLE_CLIENT_SECRET`، `GITHUB_CLIENT_SECRET`، `SMTP_PASS`، `RESEND_API_KEY`
- **ملاحظة أمنية حول القيم الاحتياطية في الكود**: تحتوي بعض الملفات القائمة (مثل `lib/security/vault.ts` و`lib/storage/objectStorage.ts` و`lib/auth/serverAuth.ts`) على مفاتيح اشتقاق/احتياط محلية للتطوير عند غياب متغيرات البيئة. يجب توثيق وجوب ضبط الأسرار الحقيقية في الإنتاج وعدم إضافة أي مفاتيح صلبة (`Hardcoded Secrets`) في أي كود جديد.
- **تزامن `.env.example`**: عند إضافة أي متغير بيئة جديد (عند طلب تطوير يتطلب ذلك)، يجب تعريفه في `.env.example` بدون قيم سرية.

---

## 2. تشفير المفاتيح وتوقيع الروابط (Cryptography & Key Vault)

- **خزنة المفاتيح (`lib/security/vault.ts`)**: تستخدم تشفير الغلاف **AES-256-GCM** عبر `MASTER_ENCRYPTION_KEY` / `DATA_ENCRYPTION_KEY` مع اشتقاق مفاتيح `HKDF-SHA256` لحفظ مفاتيح المزودين المشفرة في جدول `encrypted_vault_keys` بقاعدة Turso.
- **تشفير الإعدادات والتوكنات (`lib/encryption.ts`)**: يجب استخدامه لتشفير مفاتيح المزودين في `adminConfigStore.ts` وتوكنات OAuth في `TelegramRepository` قبل حفظها في Turso، وفك التشفير في الذاكرة فقط وقت الاستدعاء الصادر.
- **الروابط الموقعة (`lib/storage/objectStorage.ts`)**: توقَّع روابط تنزيل الملفات الخاصة بـ **HMAC-SHA256** مع زمن انتهاء صلاحية ومقارنة ثابتة الزمن `crypto.timingSafeEqual`.

---

## 3. الدفاع المحيطي وحماية النماذج (Perimeter & Guardrails)

- **SoufShield WAF (`lib/security/wafEngine.ts` + `middleware.ts`)**:
  - يفحص جميع الطلبات والـ Payload المتداخل (`inspectRequest`, `inspectRequestBody`) ضد: حقن SQL، حقن الأوامر RCE، XSS، Path Traversal، Prototype Pollution (`__proto__`, `constructor`)، واستكشاف ملفات `.env`/`.git`.
  - يضيف ترويسات الأمان (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, وغيرها) عبر `applySecurityHeaders`.
  - حافظ على دقة القواعد لتجنب الحظر الخاطئ لنقاشات البرمجة المشروعة داخل المحادثات.
- **استخبارات التهديدات (`lib/security/threatEngine.ts`)**: يستخرج عنوان IP الحقيقي، يكتشف أدوات الفحص والهجوم، ويسجل الحوادث في Turso (`analytics_security_events`) مع دعم الحظر الفوري وتدقيق المشرفين.
- **حماية النماذج (`lib/security/modelArmorGuardrail.ts`)**: يفحص محاولات كسر القيود (`Jailbreak`) واستخراج توجيهات النظام وتسريب البيانات عبر روابط Markdown، ويوفر `wrapUntrustedContent` لعزل المخرجات الخارجية داخل `<untrusted_tool_data>`.
- **منع SSRF (`lib/security/ssrfGuard.ts`)**: يرفض عناوين Loopback والشبكات الخاصة (`10.x`, `172.16-31.x`, `192.168.x`) وMetadata السحابية (`169.254.169.254`) وبروتوكولات غير HTTP/HTTPS.
- **تقييد المعدل (`lib/security/rateLimiter.ts`)**: يمنع استنزاف الموارد وهجمات التخمين.

---

## 4. فحص الصلاحيات والتدقيق (RBAC & Audit)

- لا تخفّض شروط التحقق في `lib/auth/adminRoles.ts` أو `lib/auth/serverAuth.ts`.
- تأكد من تسجيل قرارات الأمان الإدارية (الحظر، فك الحظر، تعديل المفاتيح/الأدوار) عبر `AuditRepository.logAction`.
