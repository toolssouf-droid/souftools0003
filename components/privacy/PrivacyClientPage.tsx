"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Lock,
  Eye,
  Key,
  Database,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  Search,
  Sliders,
  Trash2,
  Layers,
  Cpu,
  Fingerprint,
  Printer,
  ChevronDown,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { WaveBackground } from "@/components/ui/WaveBackground";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

export function PrivacyClientPage({ locale }: { locale: string }) {
  const isRtl = isRtlLocale(locale);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const lastUpdatedDate = isRtl ? "24 أغسطس 2026" : "August 24, 2026";

  const sections = [
    {
      id: "intro",
      icon: ShieldCheck,
      titleAr: "1. المقدمة والالتزام بالخصوصية",
      titleEn: "1. Introduction & Privacy Commitment",
      descAr:
        "في منصة SoufTools، نعتبر خصوصية بياناتك وأمان محادثاتك واستفساراتك البرمجية أولوية قصوى لا تقبل المساومة. توضح هذه الوثيقة الشاملة كيف نقوم بجمع، حماية، معالجة، وإدارة بياناتك عند استخدام نماذج SoufAI وأدوات الوكيل الذكي والخدمات المرتبطة بها.",
      descEn:
        "At SoufTools, the privacy of your data, conversations, and coding queries is our utmost non-negotiable priority. This comprehensive policy outlines how we collect, protect, process, and govern your information when using SoufAI models, autonomous agent capabilities, and related services.",
      pointsAr: [
        "نحن لا نبيع بياناتك الشخصية أو محتوى استفساراتك لأي طرف ثالث إطلاقاً.",
        "تتم معالجة جميع الاستدعاءات المشفرة عبر خوادمنا الآمنة دون كشف هويتك للمزودين الخارجيين.",
        "نلتزم بأعلى معايير حماية البيانات العالمية متوافقة مع لوائح GDPR و CCPA.",
      ],
      pointsEn: [
        "We never sell your personal data or conversation content to any third parties.",
        "All model queries are processed via secure server-side proxies without exposing your identity.",
        "We adhere to rigorous global data security benchmarks complying with GDPR and CCPA standards.",
      ],
    },
    {
      id: "data-collected",
      icon: Database,
      titleAr: "2. البيانات التي نقوم بجمعها",
      titleEn: "2. Information We Collect",
      descAr:
        "نقوم بجمع الحد الأدنى والضروري فقط من المعلومات لتقديم خدمات الذكاء الاصطناعي بكفاءة واستقرار عالي:",
      descEn:
        "We collect only the strictly necessary minimum data required to deliver reliable and responsive AI platform capabilities:",
      subsectionsAr: [
        {
          title: "أ. بيانات الحساب والهوية:",
          text: "البريد الإلكتروني، الاسم التعريفي، ومعرف المستخدم الآمن (UID) الصادر عن مزود المصادقة (Google / Firebase Auth).",
        },
        {
          title: "ب. محتوى المحادثات والمدخلات:",
          text: "الرسائل النصية، الأكواد البرمجية، والصور أو المستندات المرفقة التي تقدمها طواعية أثناء التفاعل مع نماذج SoufAI أو الوكيل الذكي.",
        },
        {
          title: "ج. بيانات الذاكرة وسياق المشاريع (SoufAI Memory):",
          text: "المعلومات والتفضيلات التقنية التي تختار حفظها في نظام الذاكرة الذكية لتخصيص الردود القادمة (يمكن تعديلها أو مسحها في أي وقت).",
        },
        {
          title: "د. البيانات التقنية والتشغيلية:",
          text: "سجلات زمن الاستجابة، عدد الاستدعاءات، رمز حالة النموذج، والتقارير التشخيصية مجهولة الهوية لتحسين استقرار خوارزميات التبديل الآلي (Fallback).",
        },
      ],
      subsectionsEn: [
        {
          title: "A. Account & Identity Data:",
          text: "Email address, display name, and secure unique user ID (UID) issued by the authentication provider (Google / Firebase Auth).",
        },
        {
          title: "B. Conversations & User Prompts:",
          text: "Text messages, source code snippets, and optional image/file attachments voluntarily provided during interaction with SoufAI models or tools.",
        },
        {
          title: "C. AI Memory & Context Data (SoufAI Memory):",
          text: "Explicit preferences and project context saved within the AI memory engine to personalize subsequent answers (fully editable and erasable).",
        },
        {
          title: "D. Technical & Operational Telemetry:",
          text: "Latency metrics, execution attempt counts, status codes, and anonymized diagnostic logs used to optimize automatic failover algorithms.",
        },
      ],
    },
    {
      id: "data-usage",
      icon: Cpu,
      titleAr: "3. كيف نستخدم بياناتك ونعالجها",
      titleEn: "3. How We Process & Use Your Information",
      descAr:
        "تُستخدم بياناتك حصرياً لأغراض تشغيلية وتقنية مباشرة لتقديم تجربة الذكاء الاصطناعي الفائقة:",
      descEn:
        "Your data is used strictly for operational and direct functional purposes to power your AI platform experience:",
      pointsAr: [
        "توليد الإجابات الذكية، صياغة الأكواد، وتحليل المستندات عبر النموذج المناسب الذي تختاره.",
        "تنفيذ أدوات الوكيل الذكي المطلوبة (مثل البحث الحي في الويب، تشغيل الـ Sandbox السحابي، أو فحص الأخطاء البرمجية).",
        "تفعيل نظام التوجيه الذكي والتبديل التلقائي (Fallback Routing) لضمان عدم انقطاع الخدمة عند ضغط النماذج.",
        "حفظ استمرارية جلسات العمل وسجل المحادثات ليتاح لك الرجوع إليها من أي جهاز.",
        "حماية النظام من الاستخدام الضار، الهجمات السيبرانية، ومحاولات كسر الحماية.",
      ],
      pointsEn: [
        "Generating intelligence responses, coding artifacts, and research summaries via your selected model tier.",
        "Executing requested autonomous agent tools (live web synthesis, sandboxed runtime verification, code debugging).",
        "Powering real-time fallback routing across redundant infrastructure to guarantee service uptime.",
        "Preserving conversation continuity and session archives across authenticated devices.",
        "Safeguarding platform infrastructure against abuse, automated attacks, and security vulnerabilities.",
      ],
    },
    {
      id: "security",
      icon: Lock,
      titleAr: "4. الأمان وتشفير البيانات",
      titleEn: "4. Security & Encryption Standards",
      descAr:
        "نطبق هيكلية أمان متعددة الطبقات لحماية كافة البيانات في النقل والتخزين:",
      descEn:
        "We implement multi-layered enterprise-grade security protocols protecting all in-transit and at-rest assets:",
      subsectionsAr: [
        {
          title: "تشفير النقل (In-Transit Encryption):",
          text: "تتم جميع الاتصالات عبر بروتوكول TLS 1.3 / HTTPS فائق الأمان بتشفير 256-bit لمنع أي تنصت أو اعتراض للبيانات.",
        },
        {
          title: "حماية المفاتيح السرية في الخادم (Server-Side Isolation):",
          text: "مفاتيح API والمزودين لا تُرسل ولا تُكشف أبداً للمتصفح، ويتم تشفيرها في قاعدة البيانات السحابية بخوارزميات تشفير آمنة.",
        },
        {
          title: "بيئات التشغيل المعزولة (Sandboxed Execution):",
          text: "تشغيل الأكواد ومعاينتها يتم داخل حاويات سحابية معزولة تماماً (E2B Sandboxes) تُدمَّر تلقائياً فور انتهاء الجلسة لمنع أي تسريب.",
        },
      ],
      subsectionsEn: [
        {
          title: "In-Transit Cryptography:",
          text: "All browser and server communications utilize strict TLS 1.3 / HTTPS 256-bit encryption pipelines.",
        },
        {
          title: "Server-Side Key Isolation:",
          text: "All provider API keys are strictly server-side isolated, encrypted at rest, and never exposed to the client-side bundle.",
        },
        {
          title: "Isolated Sandboxed Workspaces:",
          text: "Code executions and previews run in ephemeral micro-containers (E2B Sandboxes) that are securely recycled after session termination.",
        },
      ],
    },
    {
      id: "memory-control",
      icon: Fingerprint,
      titleAr: "5. التحكم التام في الذاكرة وسجل المحادثات",
      titleEn: "5. User Control Over AI Memory & History",
      descAr:
        "تمنحك منصة SoufTools سيطرة كاملة ومباشرة بنقرة واحدة على كافة البيانات المخزنة:",
      descEn:
        "SoufTools grants you immediate, granular, one-click governance over all your retained data:",
      pointsAr: [
        "حذف فوري للمحادثات: يمكنك حذف أي جلسة محادثة بشكل نهائي من صفحة 'سجل المحادثات' أو شريط الدردشة.",
        "إدارة الذاكرة الذكية: من صفحة 'الذاكرة'، يمكنك تفعيل/تعطيل ذاكرة الذكاء الاصطناعي كلياً، أو تعديل/حذف عناصر ذاكرة محددة، أو مسح الذاكرة بالكامل.",
        "عدم استخدام بياناتك لتدريب النماذج العامة: نحن لا نستخدم استفساراتك الخاصة أو أكوادك البرمجية لتدريب نماذج الذكاء الاصطناعي العامة.",
      ],
      pointsEn: [
        "Immediate Session Deletion: Permanently purge any conversation from your Chat History or live chat thread at any moment.",
        "Granular Memory Governance: Enable/disable global AI memory, inspect itemized facts, edit context, or purge all memory from the Memory page.",
        "Zero Public Model Training: Your private prompts, attachments, and codebases are not used to train public baseline AI models.",
      ],
    },
    {
      id: "third-parties",
      icon: Layers,
      titleAr: "6. المزودون الخارجيون وخدمات الأطراف الثالثة",
      titleEn: "6. Third-Party AI Providers & APIs",
      descAr:
        "لتوفير ميزة التبديل الذكي بين 40+ مزود ومحرك بحث، يتعامل خادمنا مع واجهات برمجية خارجية موثوقة:",
      descEn:
        "To provide instant fallback across 40+ model providers and web synthesis engines, our backend interfaces with trusted enterprise APIs:",
      subsectionsAr: [
        {
          title: "مزودو الذكاء الاصطناعي (AI Infrastructure):",
          text: "يتم إرسال نصوص الاستعلامات عبر وكيل خادمنا المشفر (Server Proxy) بدون ربطها باسمك أو بريدك الإلكتروني الشخصي.",
        },
        {
          title: "محركات البحث وقارئ الروابط (Web Tools):",
          text: "أدوات مثل Tavily و Exa و Serper و Jina تستقبل نصوص البحث العامة لاستخراج الحقائق والروابط الحية فقط.",
        },
        {
          title: "خدمات المصادقة والتخزين (Firebase / Google Cloud):",
          text: "تُستخدم لحفظ الحسابات والبيانات بقواعد أمان صارمة (Firestore Security Rules) تمنع وصول أي مستخدم لبيانات مستخدم آخر.",
        },
      ],
      subsectionsEn: [
        {
          title: "AI Model Infrastructure:",
          text: "Prompt payloads are dispatched via authenticated server-side proxies stripped of personal user identifiers.",
        },
        {
          title: "Web Research & Extraction APIs:",
          text: "Search services (Tavily, Exa, Serper, Jina Reader) receive topical search queries solely to aggregate public search results.",
        },
        {
          title: "Database & Authentication (Firebase / Google Cloud):",
          text: "Manages session persistence and identity via isolated security rules ensuring strict zero-cross-account access.",
        },
      ],
    },
    {
      id: "cookies",
      icon: Eye,
      titleAr: "7. ملفات تعريف الارتباط والتخزين المحلي",
      titleEn: "7. Cookies & Local Storage Usage",
      descAr:
        "نستخدم ملفات تعريف الارتباط (Cookies) والتخزين المحلي (LocalStorage) لأغراض وظيفية محضة:",
      descEn:
        "We utilize essential cookies and browser local storage strictly for functional app mechanics:",
      pointsAr: [
        "الحفاظ على حالة تسجيل الدخول وتجديد جلسة الأمان المشفرة (Auth Tokens).",
        "حفظ تفضيلاتك للواجهة مثل اللغة المفتاحة (العربية / الإنجليزية) ووضع المظهر وحالة القوائم الجانبية.",
        "تخزين مؤقت وسريع للجلسات النشطة لتسريع فتح المحادثات ومنع التأخير.",
        "نحن لا نستخدم ملفات تعريف ارتباط لتتبعك عبر مواقع الويب الخارجية أو لأغراض إعلانية مستهدفة.",
      ],
      pointsEn: [
        "Maintaining your authenticated session state and security tokens.",
        "Remembering interface preferences such as active language (AR/EN), color themes, and navigation states.",
        "Client-side caching for instant UI response and seamless session resumption.",
        "We do not deploy third-party advertising cookies or cross-site tracking beacons.",
      ],
    },
    {
      id: "rights",
      icon: Key,
      titleAr: "8. حقوقك القانونية وحرية التصرف في بياناتك",
      titleEn: "8. Your Legal Privacy Rights (GDPR & CCPA)",
      descAr:
        "بموجب قوانين حماية الخصوصية المعمول بها عالمياً، تتمتع بالحقوق الكاملة التالية:",
      descEn:
        "Under international data privacy legislation (including GDPR and CCPA), you are entitled to the following rights:",
      pointsAr: [
        "حق الوصول: طلب نسخة كاملة من البيانات والمعلومات المرتبطة بحسابك.",
        "حق التصحيح: تعديل وتحديث أي بيانات أو تفضيلات غير دقيقة.",
        "حق الحذف النهائي (حق النسيان): طلب الإلغاء والحذف الشامل لحسابك وكافة سجلاتك وذاكرتك من خوادمنا دون رجعة.",
        "حق تقييد المعالجة: تعطيل حفظ الذاكرة أو سجلات المحادثات في أي وقت من الإعدادات.",
      ],
      pointsEn: [
        "Right of Access: Request a structured export of all records associated with your account.",
        "Right to Rectification: Modify or correct any personal or contextual data directly.",
        "Right to Erasure (Right to be Forgotten): Request complete, permanent deletion of your account and related data.",
        "Right to Restrict Processing: Disable memory logging or session caching at will.",
      ],
    },
    {
      id: "contact",
      icon: Mail,
      titleAr: "9. تحديث السياسة والتواصل مع مسؤول الخصوصية",
      titleEn: "9. Policy Revisions & Contact Information",
      descAr:
        "قد نقوم بتحديث هذه السياسة دورياً لمواكبة التطورات التقنية وإضافة مزايا جديدة. سيتم إشعارك بأي تغييرات جوهرية عبر إشعار داخل المنصة أو عبر التاريخ المحدث أعلاه.",
      descEn:
        "We may update this Privacy Policy periodically to reflect technological advancements and new platform features. Notice of material modifications will be surfaced via in-app banners or updated timestamps.",
      pointsAr: [
        "البريد الإلكتروني المباشر لفريق الخصوصية والأمان: soufyane2035@gmail.com",
        "البريد الإداري العام: lrsoufyane2007@gmail.com",
        "المقر التشغيلي: منصة SoufTools السحابية - الاتحاد الأوروبي والمملكة المتحدة والعالم العربي.",
      ],
      pointsEn: [
        "Direct Privacy & Security Inquiries: soufyane2035@gmail.com",
        "Primary Administration Desk: lrsoufyane2007@gmail.com",
        "Platform Operations: SoufTools Cloud Architecture.",
      ],
    },
  ];

  const filteredSections = searchQuery.trim()
    ? sections.filter(
        (s) =>
          (isRtl ? s.titleAr : s.titleEn).toLowerCase().includes(searchQuery.toLowerCase()) ||
          (isRtl ? s.descAr : s.descEn).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sections;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30 selection:text-[#00d4aa] relative overflow-x-hidden">
      {/* Universal Navigation Header with Return/Back Button */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "سياسة الخصوصية وحماية البيانات" : "Privacy Policy & Data Security"}
        subtitle={isRtl ? "تشفير تام وحماية صارمة لبياناتك وخصوصيتك" : "Strict confidentiality, zero commercial sale of data"}
        icon={<ShieldCheck className="w-4 h-4" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/50 text-[#88b0b0] hover:text-[#00d4aa] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title={isRtl ? "طباعة الوثيقة" : "Print Document"}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? "طباعة" : "Print"}</span>
            </button>
            <LanguageSwitcher locale={locale} />
          </div>
        }
      />

      {/* Hero Banner */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 text-center z-10">
        <WaveBackground />

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto relative z-10 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111a1a] border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-semibold shadow-md shadow-[#00d4aa]/10">
            <ShieldCheck className="w-4 h-4 text-[#00ff88]" />
            <span>{isRtl ? "ميثاق الأمان والخصوصية الصارم" : "Security & Privacy Protocol"}</span>
          </div>

          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#e8f5f5] leading-tight">
            {isRtl ? "سياسة الخصوصية وحماية البيانات" : "Privacy & Data Protection Policy"}
          </h1>

          <p className="text-sm sm:text-base text-[#88b0b0] max-w-2xl mx-auto leading-relaxed">
            {isRtl
              ? "نلتزم بحماية خصوصيتك المطلقة وأمان محادثاتك واستفساراتك البرمجية بأعلى معايير التشفير العالمية والشفافية التامة."
              : "We are committed to absolute privacy, cryptographic security, and total transparency across all your AI interactions."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-[#4a7070]">
            <span className="flex items-center gap-1 bg-[#111a1a] px-3 py-1 rounded-full border border-[#1e2e2e]">
              <Clock className="w-3 h-3 text-[#00d4aa]" />
              {isRtl ? `آخر تحديث: ${lastUpdatedDate}` : `Last Updated: ${lastUpdatedDate}`}
            </span>
            <span className="flex items-center gap-1 bg-[#111a1a] px-3 py-1 rounded-full border border-[#1e2e2e]">
              <Lock className="w-3 h-3 text-[#00ff88]" />
              {isRtl ? "تشفير تام TLS 1.3 / 256-bit" : "Full 256-bit In-Transit Encryption"}
            </span>
            <span className="flex items-center gap-1 bg-[#111a1a] px-3 py-1 rounded-full border border-[#1e2e2e]">
              <CheckCircle2 className="w-3 h-3 text-[#0ea5e9]" />
              {isRtl ? "متوافق مع GDPR / CCPA" : "GDPR & CCPA Compliant"}
            </span>
          </div>
        </motion.div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-20 relative z-10 flex-1">
        {/* Quick Search & Key Highlights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-[#4a7070]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isRtl
                  ? "ابحث في بنود سياسة الخصوصية (مثال: التشفير، الذاكرة، حذف الحساب)..."
                  : "Search privacy clauses (e.g., encryption, memory, deletion)..."
              }
              className="w-full bg-[#111a1a] text-xs sm:text-sm text-[#e8f5f5] placeholder-[#4a7070] pr-10 pl-4 py-3 rounded-2xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none transition-all shadow-md"
            />
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/memory`}
              className="flex-1 p-3 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/60 transition-all text-right flex items-center justify-between group"
            >
              <div>
                <p className="text-xs font-bold text-[#e8f5f5] group-hover:text-[#00d4aa] transition-colors">
                  {isRtl ? "إدارة الذاكرة الذكية" : "AI Memory Settings"}
                </p>
                <p className="text-[10px] text-[#4a7070]">
                  {isRtl ? "تحكم في سياقك المحفوظ" : "Control saved context"}
                </p>
              </div>
              <Sliders className="w-4 h-4 text-[#00d4aa]" />
            </Link>
          </div>
        </div>

        {/* 3 Quick Core Assurances Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#111a1a] to-[#0d1414] border border-[#1e2e2e] hover:border-[#00d4aa]/40 transition-all space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#00d4aa]/15 text-[#00d4aa] flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-[#e8f5f5]">
              {isRtl ? "عدم بيع البيانات إطلاقاً" : "Zero Data Selling"}
            </h3>
            <p className="text-[11px] text-[#88b0b0] leading-relaxed">
              {isRtl
                ? "لا نقوم ببيع أو تأجير أو مشاركة أي جزء من بياناتك أو استفساراتك مع أي شبكات إعلانية."
                : "We never monetize, broker, or rent your private conversations or prompts to marketing brokers."}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#111a1a] to-[#0d1414] border border-[#1e2e2e] hover:border-[#0ea5e9]/40 transition-all space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#0ea5e9]/15 text-[#0ea5e9] flex items-center justify-center font-bold">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-[#e8f5f5]">
              {isRtl ? "عدم تدريب النماذج العامة" : "No Public Model Training"}
            </h3>
            <p className="text-[11px] text-[#88b0b0] leading-relaxed">
              {isRtl
                ? "أكوادك ومدخلاتك الخاصة لا تُستخدم لتدريب نماذج الذكاء الاصطناعي الأساسية للعامة."
                : "Your proprietary code snippets and prompts are strictly excluded from public base model training."}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#111a1a] to-[#0d1414] border border-[#1e2e2e] hover:border-[#00ff88]/40 transition-all space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#00ff88]/15 text-[#00ff88] flex items-center justify-center font-bold">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-[#e8f5f5]">
              {isRtl ? "حق الحذف الفوري بنقرة واحدة" : "Instant Deletion Rights"}
            </h3>
            <p className="text-[11px] text-[#88b0b0] leading-relaxed">
              {isRtl
                ? "يمكنك مسح أي محادثة أو تفضيل ذاكرة أو حسابك بالكامل بضغطة زر واحدة ودون تعقيد."
                : "You possess immediate autonomy to purge specific chats, context memories, or full accounts."}
            </p>
          </div>
        </div>

        {/* Detailed Clauses List */}
        <div className="space-y-6">
          {filteredSections.map((sec, index) => {
            const Icon = sec.icon;
            const isExpanded = expandedSection === sec.id;

            return (
              <motion.article
                key={sec.id}
                id={sec.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-card p-5 sm:p-7 rounded-3xl border border-[#1e2e2e] hover:border-[#00d4aa]/30 transition-all space-y-4 shadow-xl"
              >
                {/* Section Header */}
                <div className="flex items-start justify-between gap-4 border-b border-[#1e2e2e]/70 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] text-[#00d4aa] flex items-center justify-center shrink-0 shadow-md">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-[#e8f5f5]">
                        {isRtl ? sec.titleAr : sec.titleEn}
                      </h2>
                      <span className="text-[10px] text-[#4a7070] font-mono">
                        Clause #{index + 1}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : sec.id)}
                    className="p-1.5 rounded-lg bg-[#111a1a] text-[#4a7070] hover:text-[#00d4aa] transition-colors cursor-pointer"
                    title={isRtl ? "طي/توسيع القسم" : "Toggle Section"}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-[#00d4aa]" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Section Description */}
                <p className="text-xs sm:text-sm text-[#88b0b0] leading-relaxed">
                  {isRtl ? sec.descAr : sec.descEn}
                </p>

                {/* Bullet Points if exist */}
                {sec.pointsAr && (
                  <ul className="space-y-2.5 pt-2">
                    {(isRtl ? sec.pointsAr : sec.pointsEn)?.map((pt, ptIdx) => (
                      <li
                        key={ptIdx}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-[#c8dede] leading-relaxed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#00d4aa] shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Subsections if exist */}
                {sec.subsectionsAr && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {(isRtl ? sec.subsectionsAr : sec.subsectionsEn)?.map((sub, subIdx) => (
                      <div
                        key={subIdx}
                        className="p-3.5 rounded-2xl bg-[#0a0f0f]/80 border border-[#1e2e2e] space-y-1"
                      >
                        <h4 className="text-xs font-bold text-[#00d4aa] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa]" />
                          {sub.title}
                        </h4>
                        <p className="text-[11px] text-[#88b0b0] leading-relaxed">
                          {sub.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>

        {/* Direct Action Assistance Card */}
        <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#111a1a] via-[#0e1717] to-[#111a1a] border border-[#00d4aa]/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-base sm:text-xl font-bold text-[#e8f5f5] flex items-center justify-center md:justify-start gap-2">
              <Sparkles className="w-5 h-5 text-[#00ff88]" />
              <span>{isRtl ? "هل لديك استفسار حول بياناتك؟" : "Have Questions About Your Data?"}</span>
            </h3>
            <p className="text-xs text-[#88b0b0] leading-relaxed">
              {isRtl
                ? "فريق الدعم وحماية الخصوصية في SoufTools مستعد للإجابة عن أي تساؤل أو مساعدة بخصوص حذف بياناتك وتصديرها فوراً."
                : "Our privacy officers are available to clarify data queries, assist with erasure, or process audit requests."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:soufyane2035@gmail.com?subject=SoufTools%20Privacy%20Inquiry"
              className="px-5 py-2.5 rounded-xl bg-[#111a1a] border border-[#00d4aa]/50 hover:bg-[#00d4aa]/10 text-[#00d4aa] text-xs font-bold transition-all flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>{isRtl ? "مراسلة مسؤول الخصوصية" : "Contact Privacy Officer"}</span>
            </a>

            <Link
              href={`/${locale}/chat`}
              className="px-5 py-2.5 rounded-xl bg-[#00d4aa] text-[#0a0f0f] text-xs font-bold shadow-lg shadow-[#00d4aa]/20 hover:scale-105 transition-all flex items-center gap-2"
            >
              <span>{isRtl ? "العودة للدردشة" : "Back to Chat"}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#1e2e2e] py-6 px-4 sm:px-6 bg-[#0a0f0f] text-xs text-[#4a7070] relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <p className="text-xs font-semibold">
            SoufTools Platform. All rights reserved 2026 ©
          </p>

          <div className="flex items-center gap-4 text-xs font-medium">
            <Link href={`/${locale}/privacy`} className="text-[#00d4aa] font-bold">
              {isRtl ? "الخصوصية" : "Privacy"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/about`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "عن المنصة" : "About"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/memory`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الذاكرة" : "Memory"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
