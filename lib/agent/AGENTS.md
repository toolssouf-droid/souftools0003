# تعليمات محرك الوكلاء والذاكرة والمهام — `lib/agent/AGENTS.md`

يسري هذا الملف على جميع الملفات تحت `lib/agent/` والوحدات المرتبطة بها (`lib/memory/`, `lib/router.ts`, `lib/sandbox/`, `lib/tools/`). التزم أيضاً بـ `/AGENTS.md` و`/GEMINI.md`.

---

## 1. المعمارية الموحدة لمحرك الوكلاء (`SoufAI Nexus Engine`)

تتوحّد مسارات التشغيل تحت طبقة **SoufAI Nexus Engine (`lib/agent/nexus/`)** مع الحفاظ على التوافق الكامل للواجهات العامة:
1. **المنسق الرئيسي الموحد (`lib/agent/nexus/nexusEngine.ts` + واجهة `lib/agent/engine/soufAIEngine.ts`)**:
   - يدير التخطيط الديناميكي (`planner.ts`)، ومخطط المهام الموجّه DAG، والتنفيذ المتوازي والتسلسلي، والتفويض المنضبط (`delegation`)، وسجل الوكلاء المركزي (`agentRegistry.ts`)، وإطار المهارات الانتقائي (`skillsRegistry.ts` و`skillsCatalog.ts`)، وموجه النماذج الذكي (`modelRouter.ts`)، والتحكم الأمني (`securityController.ts`)، والاستمرارية ونقاط الاستعادة غير الصامتة (`persistenceManager.ts`).
   - يربط الوكلاء الـ 11 الأساسيين في `lib/agent/engine/workers/` (`coding`, `research`, `design`, `debug`, `testing`, `vision`, `file`, `sandbox`, `dependency`, `security`, `verification`) بالإضافة إلى 4 وكلاء متخصصين جدد (`architecture_analyst`, `database_engineer`, `workflow_automation`, `documentation_engineer`) عبر `lib/agent/nexus/workers.ts`.
   - يوحد الوصول لكتالوج أدوات البناء (`lib/agent/engine/toolRegistry.ts`) وكتالوج أدوات التشغيل (`lib/agent/tools/toolRegistry.ts`) عبر `lib/agent/nexus/toolBridge.ts`.
2. **محرك الدردشة والأدوات (`lib/agent/agentRuntime.ts`) ووكيل مساحة العمل (`lib/agent/coding/codingAgentEngine.ts`)**:
   - يمران عبر فحص الأمان `nexusSecurityController`، ويحمّلان المهارات الملائمة عند الطلب من `nexusSkillRegistry`، ويسجلان نقاط الاستعادة بصراحة (`fail-loud`) وأثر التقييم المنفصل `NexusEvaluationTrace` في Turso.
   - يعتمد `agentRuntime.ts` على مصفوفة النوايا `classifierEngine.ts` وفرضيات `Tree of Thoughts` / `Reflexion` وبث الأحداث عبر `agentTaskStore.ts`.

---

## 2. إلزامية الأدوات الحقيقية ومنع التزييف (Real Tool Mandate)

- **حظر التخمين**: لا تسمح للوكيل أو النموذج بتخمين الوقت الحالي، الحسابات الرياضية، نتائج البحث الحي، حالة النظام، أو محتوى الروابط والملفات. وجّه هذه الطلبات عبر `toolRouter.ts` / `toolRegistry.ts` و`zeroComputeTriage.ts`.
- **مصنف النوايا الصارم (`classifierEngine.ts`)**: لا تُضِف نماذج افتراضية صلبة داخل المصنف إذا لم يضبطه المدير؛ التزم بقاعدة رفض التشغيل الواضحة عند غياب تهيئة المصنف في لوحة التحكم.
- **الالتزام بموجه النماذج (`lib/router.ts` & `lib/adminConfigStore.ts`)**: التزم حصراً بالمزودات والنماذج والمفاتيح المفعّلة في إعدادات الإدارة المخزنة في Turso (`SettingsRepository`). يُمنع إضافة تبديل صامت غير مصرّح به إلى نماذج أخرى خارج التهيئة المعتمدة.

---

## 3. الحالة الدائمة، الإيقاف، والاستئناف (Durability & Checkpoints)

- يجب تسجيل حالة مهام الوكيل وخطواته وأحداثه ونقاط الاستعادة (`agent_tasks`, `agent_steps`, `agent_checkpoints`, `agent_events`) عبر `AgentRepository` في Turso، مع احترام مهلة الاستحواذ (`leaseOwner` / `leaseExpiresAt`).
- ادعم الإيقاف الآمن عبر `AbortController` (`SoufAIEngine.stopTask`) والاستئناف من نقاط الاستعادة (`resumeTask`) عبر مسارات `/api/v1/agent/stop` و`/api/v1/agent/resume`.
- للعمليات الخلفية الطويلة خارج طلب HTTP، استخدم طابور `lib/queue/workerQueue.ts` (`WorkerJobRepository`) أو الجدولة الموثقة في `lib/scheduler/serverTaskRunner.ts`.

---

## 4. الذاكرة المتقاطعة وعزل المدخلات (Memory & Anti-IPI)

- **الذاكرة الموحدة (`lib/memory/memoryService.ts` & `contextBuilder.ts`)**: يجب ربط جميع العمليات بـ `userId` الحقيقي والموثّق عبر `MemoryRepository` (دون تسريب ذكريات بين المستخدمين أو حفظها في `localStorage`).
- **مقاومة حقن الأوامر غير المباشر (Anti-IPI)**: يجب تغليف كل مخرجات البحث في الويب وقراءة الروابط وأي محتوى خارجي غير موثوق بوسوم العزل `<untrusted_tool_data>` (انظر `wrapUntrustedContent` في `/lib/security/modelArmorGuardrail.ts`) قبل تمريره إلى سياق النموذج.

---

## 5. بيئة التنفيذ المعزولة (Native Sandbox Separation)

- يدير `lib/sandbox/sandboxManager.ts` و`lib/sandbox/nativeSandbox.ts` بيئات التنفيذ المعزولة، مع تسجيل الجلسات في Turso (`RuntimeSessionRepository` و`SettingsRepository`).
- **فصل العميل عن الخادم**: يُمنع منعاً باتاً استيراد `nativeSandbox.ts` أو `sandboxManager.ts` أو وحدات Node (`fs`, `child_process`) داخل مكونات المتصفح أو كود العميل (`lib/agent/coding/toolManager.ts` أو غيره)؛ يجب تنفيذ كل عمليات الساندبوكس عبر مسارات `/api/runtime/sandbox/*`.
- **الحفاظ على قيود العزل**: حافظ على `resolveSafePath`، فحص الوصلات الرمزية `realpathSync`، وتصفية متغيرات البيئة في الساندبوكس بحيث لا تتسرب أي مفاتيح أو متغيرات اتصال خاصة بالخادم.
