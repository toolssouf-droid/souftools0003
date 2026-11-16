"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authClient } from "@/lib/auth/authClient";
import { useChatStore } from "@/store/chatStore";
import { getAuthCookie, setAuthCookie, removeAuthCookie, getOrCreateAuthSession } from "@/lib/authCookies";
import { performCompleteSignOut } from "@/lib/auth/unifiedAuth";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { cloudSyncService } from "@/lib/sync/cloudSyncService";
import { Sparkles, Bot } from "lucide-react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { isRtlLocale, isValidLocale, isSupportedLocale, DEFAULT_LOCALE } from "@/lib/i18n";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(false);

  const pathname = usePathname() || "";
  const router = useRouter();
  const { userEmail, setUserEmail, setUserId, setIsAdmin, clearAuth } = useChatStore();

  const handleSignOut = async () => {
    const pathSegments = pathname.split("/").filter(Boolean);
    const currentLocaleCandidate = pathSegments[0];
    const locale = isValidLocale(currentLocaleCandidate) ? currentLocaleCandidate : DEFAULT_LOCALE;
    setFirebaseUser(null);
    clearAuth();
    await performCompleteSignOut(locale);
  };

  // 1. Monitor Auth state & sync cookies cleanly
  useEffect(() => {
    // If user explicitly signed out, do not restore
    if (typeof window !== "undefined" && sessionStorage.getItem("souftools_just_logged_out") === "true") {
      setUserEmail(null);
      setUserId(null);
      setIsAdmin(false);
      setAuthLoading(false);
      return;
    }

    // Immediate pre-hydration check from Storage/Cookie
    const sessionData = getOrCreateAuthSession();
    const activeEmail = sessionData?.email;
    const activeUid = sessionData?.userId;
    const isAdm = sessionData?.isAdmin || (activeEmail ? isUserAdmin(activeEmail) : false);

    if (
      activeEmail &&
      !activeEmail.startsWith("usr_guest_") &&
      !activeEmail.startsWith("guest_user@") &&
      !activeEmail.endsWith("@souftools.app") &&
      !activeEmail.endsWith("@souftools.internal")
    ) {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("souftools_just_logged_out");
        } catch {}
      }
      setUserEmail(activeEmail);
      if (isAdm) setIsAdmin(true);
      if (activeUid) setUserId(activeUid);
      cloudSyncService.restoreFromCloud(activeUid || undefined, activeEmail || undefined);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem("souftools_just_logged_out");
          } catch {}
        }
        const email = user.email;
        const isAdmUser = isUserAdmin(email) || useChatStore.getState().isAdmin;
        setUserEmail(email);
        if (isAdmUser) setIsAdmin(true);
        setUserId(user.uid);
        setAuthCookie(email, user.uid, isAdmUser);

        // Sync session with SoufTools Private Backend
        try {
          const idToken = await user.getIdToken();
          await fetch("/api/v1/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: user.uid,
              email,
              displayName: user.displayName,
              idToken,
            }),
          });
        } catch {}

        // Automatically restore and sync with cloud server
        cloudSyncService.restoreFromCloud(user.uid, email).then(() => {
          cloudSyncService.triggerAutoSync(2000);
        });
      } else {
        // Firebase user is null, check Better Auth session (OAuth via GitHub/Google or Email)
        let resolvedEmail: string | null = null;
        let resolvedUid: string | null = null;
        let isAdmUser = false;

        try {
          const betterSession = await authClient.getSession().catch(() => null);
          if (betterSession?.data?.user) {
            const bUser = betterSession.data.user as any;
            resolvedEmail = (bUser.email || "").toLowerCase().trim();
            resolvedUid = bUser.id || undefined;
            isAdmUser = isUserAdmin(resolvedEmail) || bUser.role === "admin" || bUser.role === "super_admin";
          }
        } catch {}

        // If not in Better Auth, fallback to existing souftools_session cookie
        if (!resolvedEmail) {
          const existing = getAuthCookie();
          resolvedEmail = existing?.email || null;
          resolvedUid = existing?.userId || null;
          isAdmUser = existing?.isAdmin || (resolvedEmail ? isUserAdmin(resolvedEmail) : false);
        }

        if (
          resolvedEmail &&
          !resolvedEmail.startsWith("usr_guest_") &&
          !resolvedEmail.startsWith("guest_user@") &&
          !resolvedEmail.endsWith("@souftools.app") &&
          !resolvedEmail.endsWith("@souftools.internal")
        ) {
          if (typeof window !== "undefined") {
            try {
              sessionStorage.removeItem("souftools_just_logged_out");
            } catch {}
          }
          setUserEmail(resolvedEmail);
          if (isAdmUser) setIsAdmin(true);
          if (resolvedUid) setUserId(resolvedUid);
          setAuthCookie(resolvedEmail, resolvedUid || undefined, isAdmUser);
          cloudSyncService.restoreFromCloud(resolvedUid || undefined, resolvedEmail || undefined);
        } else {
          // If no valid session across all providers
          setUserEmail(null);
          setUserId(null);
          setIsAdmin(false);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [setUserEmail, setUserId, setIsAdmin, clearAuth]);

  // 2. Perform route guarding and automatic redirects
  useEffect(() => {
    if (authLoading) return;

    // Detect locale from URL path
    const pathSegments = pathname.split("/").filter(Boolean);
    const currentLocaleCandidate = pathSegments[0];
    const locale = isValidLocale(currentLocaleCandidate) ? currentLocaleCandidate : DEFAULT_LOCALE;
    const routeName = pathSegments.slice(1).join("/") || "";

    const isJustLoggedOut = typeof window !== "undefined" && sessionStorage.getItem("souftools_just_logged_out") === "true";
    const cookieData = isJustLoggedOut ? null : getAuthCookie();
    const storeEmail = isJustLoggedOut ? null : useChatStore.getState().userEmail;
    const isAuthenticated = !isJustLoggedOut && !!(firebaseUser || userEmail || storeEmail || cookieData?.email);

    const isAuthRoute = routeName === "login";
    const isProtectedRoute =
      routeName.startsWith("chat") ||
      routeName.startsWith("history") ||
      routeName.startsWith("memory") ||
      routeName.startsWith("admin");
    const isAdminLogin = isAuthRoute &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("redirect") === "admin";

    if (!isAuthenticated && isProtectedRoute) {
      router.replace(`/${locale}/login?redirect=${encodeURIComponent(routeName)}`);
    } else if (isAuthenticated && isAuthRoute) {
      if (isAdminLogin) return;
      // If user is authenticated and hits login without explicit loggedOut flag, redirect
      const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      if (searchParams?.get("loggedOut") === "true") {
        return;
      }
      const redirect = searchParams?.get("redirect");
      if (redirect && redirect !== "login") {
        router.replace(`/${locale}/${redirect}`);
      } else {
        router.replace(`/${locale}/chat`);
      }
    }
  }, [authLoading, firebaseUser, userEmail, pathname, router]);

  const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
  const isCurrentlyAuthenticated = !!(firebaseUser || userEmail || cookieData?.email);

  // Path inspection for loading screen
  const pathSegments = pathname.split("/").filter(Boolean);
  const routeName = pathSegments.slice(1).join("/") || "";
  const isProtectedRoute =
    routeName.startsWith("chat") ||
    routeName.startsWith("history") ||
    routeName.startsWith("memory") ||
    routeName.startsWith("admin");
  const isAuthRoute = routeName === "login" || routeName === "";

  // Show the advanced real progress-connected LoadingScreen on initial app bootstrap
  if (isAppLoading) {
    return <LoadingScreen onComplete={() => setIsAppLoading(false)} />;
  }

  return (
    <AuthContext.Provider value={{ user: firebaseUser, loading: authLoading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};
