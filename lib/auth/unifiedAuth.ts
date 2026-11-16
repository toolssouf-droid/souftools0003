/**
 * Unified Authentication & Zero-Trace Sign-Out Engine for SoufTools
 * Ensures atomic logout across Better Auth, Firebase Auth,
 * Server Cookies, LocalStorage, SessionStorage, and Zustand state.
 */

import { authClient } from "@/lib/auth/authClient";
import { removeAuthCookie } from "@/lib/authCookies";
import { useChatStore } from "@/store/chatStore";

let isSigningOut = false;

/**
 * Performs a complete, thorough sign-out across all auth layers.
 * Prevents race condition resurrections, purges all stored tokens/cookies,
 * and cleanly redirects to the login screen.
 */
export async function performCompleteSignOut(locale: string = "ar", redirectPath?: string): Promise<void> {
  if (isSigningOut) return;
  isSigningOut = true;

  try {
    // 1. Mark logout state in memory and sessionStorage to block any concurrent auto-restore
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("souftools_just_logged_out", "true");
      } catch {}
    }

    // 2. Terminate Better Auth Client Session
    try {
      await authClient.signOut();
    } catch (e) {
      console.warn("Better Auth sign-out notice:", e);
    }

    // 3. Terminate Firebase Auth Session
    try {
      const { auth } = await import("@/lib/firebase");
      const { signOut } = await import("firebase/auth");
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("Firebase sign-out notice:", e);
    }

    // 4. Invalidate server-side session endpoints & purge server cookies
    try {
      await Promise.allSettled([
        fetch("/api/auth/sign-out", { method: "POST" }),
        fetch("/api/v1/auth/session", { method: "DELETE" }),
      ]);
    } catch {}

    // 5. Purge all client cookies and LocalStorage items
    removeAuthCookie();

    // 6. Reset global Zustand store
    try {
      const store = useChatStore.getState();
      store.setUserEmail(null);
      store.setUserId(null);
      store.setIsAdmin(false);
      store.setSessions([]);
    } catch {}

    // 7. Deterministic hard redirect to login screen
    const targetUrl = redirectPath
      ? `/${locale}/login?redirect=${encodeURIComponent(redirectPath)}&loggedOut=true`
      : `/${locale}/login?loggedOut=true`;

    if (typeof window !== "undefined") {
      window.location.replace(targetUrl);
    }
  } finally {
    setTimeout(() => {
      isSigningOut = false;
    }, 1000);
  }
}
