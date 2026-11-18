"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Info,
} from "lucide-react";
import { authClient, signIn, signUp } from "@/lib/auth/authClient";
import { useChatStore } from "@/store/chatStore";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { FishCanvas } from "@/components/3d/FishCanvas";
import { getAuthCookie, setAuthCookie, removeAuthCookie } from "@/lib/authCookies";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { SoufBehaviorEngine } from "@/lib/behavior/behaviorEngine";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { isRtlLocale } from "@/lib/i18n";
import { ensureServerSession, isServerAdminSession } from "@/lib/auth/serverSessionClient";

function normalizeVerificationCode(value: string): string {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const codePoint = digit.charCodeAt(0);
      return String(codePoint - (codePoint >= 0x06f0 ? 0x06f0 : 0x0660));
    })
    .replace(/\D/g, "")
    .slice(0, 6);
}

export default function LoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const isRtl = isRtlLocale(locale);

  const { setUserEmail, setUserId, setIsAdmin } = useChatStore();

  // If already logged in, fast-track to smart launchpad or custom requested redirect
  useEffect(() => {
    let cancelled = false;
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const isLoggedOutParam = searchParams.get("loggedOut") === "true";
      const isLoggedOutSession = sessionStorage.getItem("souftools_just_logged_out") === "true";
      if (isLoggedOutParam || isLoggedOutSession) {
        removeAuthCookie();
        useChatStore.getState().clearAuth();
        return;
      }

      if (
        searchParams.has("token") ||
        searchParams.get("mode") === "reset" ||
        searchParams.get("error") === "INVALID_TOKEN"
      ) {
        return;
      }

      if (searchParams.get("redirect") === "admin") {
        void ensureServerSession()
          .then((session) => {
            if (!cancelled && isServerAdminSession(session)) {
              router.replace(`/${locale}/admin`);
            }
          })
          .catch((error) => {
            console.error("Failed to verify admin login redirect:", error);
          });
        return () => {
          cancelled = true;
        };
      }
    }

    const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
    if (cookieData?.email && !cookieData.email.startsWith("usr_guest_") && !cookieData.email.startsWith("guest_user@")) {
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get("redirect");
      const prof = SoufBehaviorEngine.getProfile();

      if (redirect && redirect !== "chat" && redirect !== "launch" && redirect !== "login") {
        router.replace(`/${locale}/${redirect}`);
      } else if (prof.preferredEntry === "chat" && redirect === "chat") {
        router.replace(`/${locale}/chat`);
      } else {
        router.replace(`/${locale}/launch`);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  // Auth Provider Configuration status
  const [providers, setProviders] = useState<{ google: boolean; github: boolean; email: boolean }>({
    google: false,
    github: false,
    email: true,
  });

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (data) setProviders(data);
      })
      .catch(() => {});
  }, []);

  // State
  const [authMode, setAuthMode] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");

  // Email & Password
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // UI & Animation state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("token");
    if (token) {
      setResetToken(token);
      setAuthMode("reset");
      return;
    }
    if (searchParams.get("error") === "INVALID_TOKEN") {
      setAuthMode("forgot");
      setInfoMsg(
        isRtl
          ? "رابط إعادة التعيين غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً."
          : "This reset link is invalid or expired. Request a new one."
      );
    } else if (searchParams.get("verified") === "true") {
      setInfoMsg(
        isRtl
          ? "تم تأكيد بريدك الإلكتروني. يمكنك الآن تسجيل الدخول."
          : "Your email is verified. You can now sign in."
      );
    }
  }, [isRtl]);

  // Fish interactive states
  const [isAttacking, setIsAttacking] = useState(false);
  const [isGrowing, setIsGrowing] = useState(false);
  const [activeInputRect, setActiveInputRect] = useState<DOMRect | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [shakeField, setShakeField] = useState(false);

  // Input refs for tracking active input position
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => {
        setErrorMsg(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const rect = e.target.getBoundingClientRect();
    setActiveInputRect(rect);
  };

  const handleInputBlur = () => {
    setActiveInputRect(null);
  };

  // Trigger attack animation on failure
  const triggerAttack = (msg: string) => {
    setErrorMsg(msg);
    setIsAttacking(true);
    setShakeField(true);

    setTimeout(() => {
      setIsAttacking(false);
      setShakeField(false);
    }, 1500);
  };

  // Trigger growth animation on success
  const triggerSuccess = (userEmailStr: string | null, uid: string, destination?: string) => {
    const clean = (userEmailStr || "").trim().toLowerCase();
    const isAdminAccount = isUserAdmin(clean);

    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("souftools_just_logged_out");
      } catch {}
    }

    setUserEmail(userEmailStr);
    setUserId(uid);
    if (isAdminAccount) {
      setIsAdmin(true);
    }
    if (userEmailStr) {
      setAuthCookie(userEmailStr, uid, isAdminAccount);
    }
    setSuccessMsg(
      isRtl
        ? (isAdminAccount ? "تم تسجيل الدخول كمسؤول بنجاح!" : "تم تسجيل الدخول بنجاح!")
        : (isAdminAccount ? "Signed in as Admin successfully!" : "Signed in successfully!")
    );
    setIsGrowing(true);

    // Smooth & quick navigation after success
    setTimeout(() => {
      if (destination) {
        router.push(`/${locale}/${destination}`);
        return;
      }
      const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const redirect = searchParams?.get("redirect");
      const prof = SoufBehaviorEngine.getProfile();

      if (redirect && redirect !== "login") {
        router.push(`/${locale}/${redirect}`);
      } else if (isAdminAccount) {
        router.push(`/${locale}/admin`);
      } else if (prof.preferredEntry === "chat" && redirect === "chat") {
        router.push(`/${locale}/chat`);
      } else {
        router.push(`/${locale}/launch`);
      }
    }, 400);
  };

  // 1. Google OAuth Login via Better Auth
  const handleGoogleSignIn = async () => {
    if (isLoading) return;

    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("souftools_just_logged_out");
      } catch {}
    }

    if (!providers.google) {
      setInfoMsg(
        isRtl
          ? "مفاتيح Google OAuth غير معرّفة في لوحة المشرف أو البيئة. يمكنك تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور بالأسفل."
          : "Google OAuth credentials not configured in Admin Settings or env. Please use email and password below."
      );
      emailInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: `/${locale}/launch`,
      });
      if (res?.data) {
        // Handled by Better Auth
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      triggerAttack(
        isRtl
          ? "فشل تسجيل الدخول بواسطة Google. يرجى استخدام البريد الإلكتروني."
          : "Google sign-in failed. Please try Email login."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 2. GitHub OAuth Login via Better Auth
  const handleGithubSignIn = async () => {
    if (isLoading) return;

    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("souftools_just_logged_out");
      } catch {}
    }

    if (!providers.github) {
      setInfoMsg(
        isRtl
          ? "مفاتيح GitHub OAuth غير معرّفة في لوحة المشرف أو البيئة. يمكنك تسجيل الدخول بالبريد الإلكتروني وكلمة المرور."
          : "GitHub OAuth credentials not configured in Admin Settings or env. Please use email and password."
      );
      emailInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await authClient.signIn.social({
        provider: "github",
        callbackURL: `/${locale}/launch`,
      });
      if (res?.data) {
        // Handled by Better Auth
      }
    } catch (err: any) {
      console.error("GitHub sign in error:", err);
      triggerAttack(
        isRtl
          ? "فشل تسجيل الدخول بواسطة GitHub."
          : "GitHub sign-in failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Email and password authentication
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading || authMode === "reset") return;

    if (authMode !== "forgot" && typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("souftools_just_logged_out");
      } catch {}
    }

    if (authMode !== "forgot" && authMode !== "verify" && !password) {
      triggerAttack(
        isRtl
          ? "يرجى إدخال كلمة المرور للمتابعة."
          : "Please enter your password to continue."
      );
      return;
    }

    if (authMode === "register" && password.length < 6) {
      triggerAttack(
        isRtl
          ? "كلمة السر ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل)."
          : "Password should be at least 6 characters."
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (authMode === "verify") {
        if (verificationCode.length !== 6) {
          triggerAttack(
            isRtl
              ? "أدخل رمز التحقق المكوّن من 6 أرقام."
              : "Enter the 6-digit verification code."
          );
          return;
        }

        const response = await fetch("/api/auth/email-otp/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, otp: verificationCode }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== true) {
          throw new Error(data.message || data.error || "Email verification failed");
        }
        const serverSession = await ensureServerSession();
        if (
          serverSession.authenticated &&
          serverSession.user?.email.toLowerCase() === cleanEmail
        ) {
          triggerSuccess(
            data.user?.email || cleanEmail,
            data.user?.id || serverSession.user.id
          );
          return;
        }
        setAuthMode("login");
        setPassword("");
        setVerificationCode("");
        setInfoMsg(
          isRtl
            ? "تم تأكيد البريد الإلكتروني. سجّل الدخول باستخدام كلمة المرور."
            : "Email verified. Sign in with your password."
        );
      } else if (authMode === "forgot") {
        const response = await fetch("/api/auth/email-otp/request-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || data.error || "Password reset request failed");
        }
        setAuthMode("reset");
        setResetCode("");
        setPassword("");
        setConfirmPassword("");
        setInfoMsg(
          isRtl
            ? "إذا كان البريد مسجلاً، فستصلك رسالة تحتوي رمزاً من 6 أرقام لإعادة تعيين كلمة المرور."
            : "If the email is registered, a 6-digit password reset code will arrive shortly."
        );
      } else if (authMode === "login") {
        // 1. Check if user is attempting Admin Master Key Login
        if (isUserAdmin(cleanEmail)) {
          try {
            const adminRes = await fetch("/api/v1/auth/admin-login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: cleanEmail, password }),
            });
            if (adminRes.ok) {
              const adminData = await adminRes.json();
              if (adminData?.user) {
                const serverSession = await ensureServerSession();
                if (!isServerAdminSession(serverSession)) {
                  triggerAttack(
                    isRtl
                      ? "تعذر التحقق من جلسة المسؤول على الخادم."
                      : "The server could not verify the administrator session."
                  );
                  return;
                }
                triggerSuccess(adminData.user.email, adminData.user.id);
                return;
              }
            }
          } catch (admErr) {
            console.warn("Direct admin login attempt error:", admErr);
          }
        }

        // 2. Standard Better Auth sign-in
        const res = await signIn.email({
          email: cleanEmail,
          password,
        });

        if (res.error) {
          if (res.error.code === "EMAIL_NOT_VERIFIED") {
            setAuthMode("verify");
            setVerificationCode("");
            setInfoMsg(
              isRtl
                ? "أدخل رمز التحقق الذي وصلك، أو أعد إرساله من أسفل النموذج."
                : "Enter the verification code sent to you, or resend it below."
            );
          } else {
            triggerAttack(
              isRtl
                ? "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور."
                : "Could not sign in. Check your email and password."
            );
          }
        } else if (res.data?.user) {
          const serverSession = await ensureServerSession();
          if (
            !serverSession.authenticated ||
            serverSession.user?.email.toLowerCase() !== cleanEmail
          ) {
            triggerAttack(
              isRtl
                ? "تم التحقق من الحساب، لكن تعذر إنشاء جلسة آمنة على الخادم."
                : "The account was verified, but a secure server session could not be established."
            );
            return;
          }
          triggerSuccess(res.data.user.email, res.data.user.id);
        } else {
          triggerAttack(
            isRtl
              ? "تعذر التحقق من بيانات الحساب."
              : "Could not authenticate account."
          );
        }
      } else {
        const res = await signUp.email({
          email: cleanEmail,
          password,
          name: name.trim() || cleanEmail.split("@")[0],
        });
        if (res.error) {
          triggerAttack(
            isRtl
              ? "تعذر إكمال التسجيل. تحقق من كلمة المرور وإعدادات البريد الإلكتروني ثم أعد المحاولة."
              : "Could not complete sign-up. Check the password and email delivery configuration, then try again."
          );
        } else {
          setAuthMode("verify");
          setPassword("");
          setVerificationCode("");
          setInfoMsg(
            isRtl
              ? "إذا كان البريد مؤهلاً للتسجيل، فسيصلك رمز من 6 أرقام. أدخله هنا لتأكيد بريدك."
              : "If this email can be registered, a 6-digit code will arrive. Enter it here to verify your email."
          );
        }
      }
    } catch (err: any) {
      console.error("Email auth error:", err);
      triggerAttack(
        isRtl
          ? "حدث خطأ أثناء معالجة الطلب. تحقق من اتصالك وحاول مجدداً."
          : "The request could not be completed. Check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationCode = async () => {
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const response = await fetch("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          type: "email-verification",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true) {
        throw new Error(data.message || data.error || "Could not send verification code");
      }
      setInfoMsg(
        isRtl
          ? "إذا كان البريد مسجلاً وغير مؤكد، فسيصلك رمز تحقق جديد."
          : "If the email belongs to an unverified account, a new code will arrive shortly."
      );
    } catch (error) {
      console.error("Verification code resend error:", error);
      setErrorMsg(
        isRtl
          ? "تعذر إرسال الرمز الآن. انتظر قليلاً ثم حاول مجدداً."
          : "Could not send the code right now. Wait a moment, then try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (!email.trim() || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const response = await fetch("/api/auth/email-otp/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!response.ok) {
        throw new Error("Could not resend password reset code");
      }
      setInfoMsg(
        isRtl
          ? "إذا كان البريد مسجلاً، فسيصلك رمز إعادة تعيين جديد."
          : "If the email is registered, a new password reset code will arrive."
      );
    } catch {
      setErrorMsg(
        isRtl
          ? "تعذر إرسال الرمز الآن. انتظر قليلاً ثم حاول مجدداً."
          : "Could not send the code right now. Wait a moment, then try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!resetToken && resetCode.length !== 6) {
      triggerAttack(
        isRtl
          ? "أدخل رمز إعادة التعيين المكوّن من 6 أرقام."
          : "Enter the 6-digit password reset code."
      );
      return;
    }
    if (password.length < 6) {
      triggerAttack(isRtl ? "كلمة المرور يجب أن تتكون من 6 أحرف على الأقل." : "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      triggerAttack(isRtl ? "كلمتا المرور غير متطابقتين." : "The passwords do not match.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const response = resetToken
        ? await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: resetToken, newPassword: password }),
          })
        : await fetch("/api/auth/email-otp/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              otp: resetCode,
              password,
            }),
          });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Password reset failed");
      }
      setAuthMode("login");
      setResetToken(null);
      setResetCode("");
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState(null, "", `/${locale}/login`);
      setInfoMsg(
        isRtl
          ? "تم تغيير كلمة المرور. يمكنك الآن تسجيل الدخول."
          : "Your password has been changed. You can now sign in."
      );
    } catch (err) {
      console.error("Password reset error:", err);
      triggerAttack(
        isRtl
          ? "تعذر تغيير كلمة المرور. قد يكون الرابط منتهياً أو غير صالح؛ اطلب رابطاً جديداً."
          : "Could not change the password. The link may be invalid or expired; request a new one."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="relative min-h-svh w-full bg-[#0a0f0f] text-[#e8f5f5] flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 py-6 sm:py-12 overflow-y-auto select-none font-sans"
    >
      {/* Interactive 3D/Canvas Fish Background */}
      <FishCanvas
        isAttacking={isAttacking}
        isGrowing={isGrowing}
        activeInputRect={activeInputRect}
        isPasswordFocused={isPasswordFocused}
      />

      {/* Top Header / Back to Home Button & Language Switcher */}
      <div className="w-full max-w-md sm:max-w-none flex justify-between items-center mb-4 sm:mb-0 sm:absolute sm:top-6 sm:left-6 sm:right-6 z-20 pointer-events-auto px-1 sm:px-0">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111a1a]/90 border border-[#00d4aa]/25 text-[#4a7070] hover:text-[#00d4aa] hover:border-[#00d4aa]/60 hover:bg-[#111a1a] transition-all backdrop-blur-md group text-xs sm:text-sm font-medium shadow-lg"
        >
          {isRtl ? (
            <>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              <span>الرئيسية</span>
            </>
          ) : (
            <>
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Home</span>
            </>
          )}
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111a1a]/80 border border-[#00d4aa]/20 text-[11px] text-[#4a7070]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00d4aa]" />
            <span>Better Auth + Turso</span>
          </div>
          <LanguageSwitcher locale={locale} />
        </div>
      </div>

      {/* Main Glassmorphic Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[430px] my-auto z-10"
      >
        <div
          className={`backdrop-blur-xl bg-[#111a1a]/90 border border-[#00d4aa]/30 rounded-3xl p-5 sm:p-7 shadow-[0_0_50px_rgba(0,212,170,0.12)] transition-all duration-300 relative ${
            shakeField ? "animate-shake border-red-500/60 shadow-[0_0_40px_rgba(239,68,68,0.2)]" : ""
          }`}
        >
          {/* Logo & Headline */}
          <div className="text-center mb-5 sm:mb-6">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center justify-center gap-2 mb-2 group cursor-pointer"
            >
              <SoufToolsLogo size={36} />
              <div className="flex flex-col text-left">
                <span className="text-xl font-bold tracking-tight text-[#e8f5f5]">
                  SoufTools
                </span>
                <span className="text-[10px] text-[#4a7070] font-mono tracking-widest uppercase -mt-1">
                  Private Cloud Suite
                </span>
              </div>
            </Link>
            <p className="text-xs sm:text-sm text-[#4a7070]">
              {authMode === "login"
                ? isRtl
                  ? "تسجيل الدخول إلى حسابك الذكي"
                  : "Sign in to your smart account"
                : authMode === "register"
                ? isRtl
                  ? "إنشاء حساب جديد في منصة SoufTools"
                  : "Create your SoufTools account"
                : authMode === "forgot"
                ? isRtl
                  ? "إعادة تعيين كلمة المرور"
                  : "Reset your password"
                : authMode === "verify"
                ? isRtl
                  ? "تأكيد البريد الإلكتروني"
                  : "Verify your email"
                : isRtl
                ? "اختر كلمة مرور جديدة"
                : "Choose a new password"}
            </p>
          </div>

          {/* Social OAuth Login (Google & GitHub) & Instant Guest Access */}
          <div className="space-y-2 mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#0a0f0f]/80 hover:bg-[#1a2929] border border-[#00d4aa]/20 hover:border-[#00d4aa]/50 text-[#e8f5f5] text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-1.9.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>
              <span>{isRtl ? "متابعة باستخدام Google" : "Continue with Google"}</span>
            </button>

            <button
              type="button"
              onClick={handleGithubSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#0a0f0f]/80 hover:bg-[#1a2929] border border-[#00d4aa]/20 hover:border-[#00d4aa]/50 text-[#e8f5f5] text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>{isRtl ? "متابعة باستخدام GitHub" : "Continue with GitHub"}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3.5">
            <div className="border-t border-[#00d4aa]/15 w-full"></div>
            <span className="bg-[#111a1a] px-3 text-[11px] text-[#4a7070] uppercase tracking-wider relative">
              {isRtl ? "أو بالبريد الإلكتروني الموثق" : "Or with Verified Email"}
            </span>
          </div>

          {/* Info Banner */}
          <AnimatePresence>
            {infoMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-3.5 p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs flex items-start gap-2 font-medium"
              >
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error & Success Messages */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-3.5 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 font-medium"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-3.5 p-3 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00f5c4] text-xs flex items-center gap-2 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-[#00d4aa] shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form
            onSubmit={authMode === "reset" ? handleResetPassword : handleEmailAuth}
            className="space-y-3"
          >
              {(authMode !== "reset" || resetToken === null) && (
                <div>
                  <label className="block text-xs text-[#4a7070] mb-1 font-medium">
                    {isRtl ? "البريد الإلكتروني" : "Email address"}
                  </label>
                  <div className="relative">
                    <input
                      ref={emailInputRef}
                      type="email"
                      required
                      value={email}
                      readOnly={authMode === "verify" || authMode === "reset"}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 ps-9 rounded-xl bg-[#0a0f0f]/80 border border-[#00d4aa]/25 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] text-[#e8f5f5] text-xs sm:text-sm placeholder-[#4a7070]/50 outline-none transition-all"
                    />
                    <Mail className={`w-4 h-4 text-[#4a7070] absolute top-1/2 -translate-y-1/2 ${isRtl ? "right-3" : "left-3"}`} />
                  </div>
                </div>
              )}

              {authMode === "reset" && resetToken === null && (
                <div>
                  <label htmlFor="reset-code" className="block text-xs text-[#4a7070] mb-1 font-medium">
                    {isRtl ? "رمز إعادة التعيين" : "Password reset code"}
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={resetCode}
                    onChange={(e) => setResetCode(normalizeVerificationCode(e.target.value))}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="000000"
                    aria-describedby="reset-code-hint"
                    className="w-full px-3.5 py-3 rounded-xl bg-[#0a0f0f]/80 border border-[#00d4aa]/25 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] text-[#e8f5f5] text-base text-center tracking-[0.45em] placeholder-[#4a7070]/50 outline-none transition-all"
                  />
                  <p id="reset-code-hint" className="mt-1 text-xs text-[#4a7070]">
                    {isRtl ? "أدخل الرمز المكوّن من 6 أرقام المرسل إلى بريدك." : "Enter the 6-digit code sent to your email."}
                  </p>
                </div>
              )}

              {authMode === "verify" && (
                <div>
                  <label htmlFor="verification-code" className="block text-xs text-[#4a7070] mb-1 font-medium">
                    {isRtl ? "رمز التحقق" : "Verification code"}
                  </label>
                  <input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(normalizeVerificationCode(e.target.value))}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="000000"
                    aria-describedby="verification-code-hint"
                    className="w-full px-3.5 py-3 rounded-xl bg-[#0a0f0f]/80 border border-[#00d4aa]/25 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] text-[#e8f5f5] text-base text-center tracking-[0.45em] placeholder-[#4a7070]/50 outline-none transition-all"
                  />
                  <p id="verification-code-hint" className="mt-1 text-xs text-[#4a7070]">
                    {isRtl ? "أدخل الرمز المكوّن من 6 أرقام المرسل إلى بريدك." : "Enter the 6-digit code sent to your email."}
                  </p>
                </div>
              )}

              {authMode === "register" && (
                <div>
                  <label className="block text-xs text-[#4a7070] mb-1 font-medium">
                    {isRtl ? "الاسم الكامل" : "Full Name"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isRtl ? "سفيان محمد" : "Soufyane"}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0f0f]/80 border border-[#00d4aa]/25 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] text-[#e8f5f5] text-xs sm:text-sm placeholder-[#4a7070]/50 outline-none transition-all"
                  />
                </div>
              )}

              {authMode !== "forgot" && authMode !== "verify" && (
                <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs text-[#4a7070] font-medium">
                    {authMode === "reset"
                      ? isRtl ? "كلمة المرور الجديدة" : "New password"
                      : isRtl ? "كلمة المرور" : "Password"}
                  </label>
                </div>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    onFocus={(e) => {
                      setIsPasswordFocused(true);
                      handleInputFocus(e);
                    }}
                    onBlur={() => {
                      setIsPasswordFocused(false);
                      handleInputBlur();
                    }}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 ps-9 pe-9 rounded-xl bg-[#0a0f0f]/80 border border-[#00d4aa]/25 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] text-[#e8f5f5] text-xs sm:text-sm placeholder-[#4a7070]/50 outline-none transition-all"
                  />
                  <Lock className={`w-4 h-4 text-[#4a7070] absolute top-1/2 -translate-y-1/2 ${isRtl ? "right-3" : "left-3"}`} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 text-[#4a7070] hover:text-[#00d4aa] transition-colors p-1 ${isRtl ? "left-2" : "right-2"}`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                </div>
              )}

              {authMode === "reset" && (
                <div>
                  <label className="block text-xs text-[#4a7070] mb-1 font-medium">
                    {isRtl ? "تأكيد كلمة المرور الجديدة" : "Confirm new password"}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0f0f]/80 border border-[#00d4aa]/25 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa] text-[#e8f5f5] text-xs sm:text-sm outline-none transition-all"
                  />
                </div>
              )}

              {authMode === "login" && (
                <div className="text-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("forgot");
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-xs text-[#00d4aa] hover:text-[#00f5c4] transition-colors"
                  >
                    {isRtl ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00f5c4] hover:from-[#00b894] hover:to-[#00d4aa] text-[#0a0f0f] text-xs sm:text-sm font-semibold transition-all shadow-[0_0_20px_rgba(0,212,170,0.3)] hover:shadow-[0_0_25px_rgba(0,212,170,0.45)] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-[#0a0f0f] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {authMode === "login"
                        ? isRtl ? "دخول للمنصة" : "Sign In"
                        : authMode === "register"
                        ? isRtl ? "إنشاء الحساب وإرسال رمز التأكيد" : "Create account and send verification code"
                        : authMode === "verify"
                        ? isRtl ? "تأكيد الرمز" : "Verify code"
                        : authMode === "forgot"
                        ? isRtl ? "إرسال رابط إعادة التعيين" : "Send reset link"
                        : isRtl ? "حفظ كلمة المرور الجديدة" : "Save new password"}
                    </span>
                  </>
                )}
              </button>
            </form>

            {authMode === "verify" && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleResendVerificationCode}
                  disabled={isLoading}
                  className="text-xs text-[#00d4aa] hover:text-[#00f5c4] transition-colors disabled:opacity-60"
                >
                  {isRtl ? "لم يصلك الرمز؟ أعد إرساله" : "Didn't receive the code? Resend it"}
                </button>
              </div>
            )}

            {authMode === "reset" && resetToken === null && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleResendResetCode}
                  disabled={isLoading}
                  className="text-xs text-[#00d4aa] hover:text-[#00f5c4] transition-colors disabled:opacity-60"
                >
                  {isRtl ? "لم يصلك الرمز؟ أعد إرساله" : "Didn't receive the code? Resend it"}
                </button>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#00d4aa]/15 text-center">
              {authMode === "login" || authMode === "register" ? (
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setInfoMsg(null);
                    setPassword("");
                }}
                className="text-xs text-[#4a7070] hover:text-[#00d4aa] transition-colors font-medium"
              >
                {authMode === "login"
                  ? isRtl
                    ? "ليس لديك حساب؟ سجّل مجاناً الآن"
                    : "Don't have an account? Sign up now"
                  : isRtl
                  ? "لديك حساب بالفعل؟ تسجيل الدخول"
                  : "Already have an account? Sign in"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setErrorMsg(null);
                  setInfoMsg(null);
                  setResetToken(null);
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-xs text-[#4a7070] hover:text-[#00d4aa] transition-colors font-medium"
              >
                {isRtl ? "العودة إلى تسجيل الدخول" : "Back to sign in"}
              </button>
            )}
          </div>

          {/* Strict Security Badge */}
          <div className="mt-4 p-2 rounded-xl bg-[#0a0f0f] border border-[#00d4aa]/20 flex items-center justify-center gap-2 text-[11px] text-[#88b0b0]">
            <ShieldCheck className="w-4 h-4 text-[#00d4aa] shrink-0" />
            <span>
              {isRtl
                ? "دخول مشفر بالكامل — التسجيل متاح فقط عبر الحسابات المعتمدة والموثقة"
                : "Strict Zero-Trust Security — Verified Account Sign-In Only"}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
