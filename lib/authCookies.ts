/**
 * Helper functions for session cookies (ملفات تعريف الارتباط)
 */

export interface AuthSessionData {
  email: string;
  userId?: string;
  uid?: string;
  isAdmin?: boolean;
  role?: string;
  time?: number;
}

export function setAuthCookie(email: string, userId?: string, isAdmin?: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const effectiveIsAdmin =
      isAdmin === true;

    const sessionData: AuthSessionData = {
      email: cleanEmail,
      userId: userId || "",
      uid: userId || "",
      isAdmin: effectiveIsAdmin,
      role: effectiveIsAdmin ? "super_admin" : "user",
      time: Date.now(),
    };
    const value = encodeURIComponent(JSON.stringify(sessionData));
    // 30 days expiration cookie
    document.cookie = `souftools_session=${value}; path=/; max-age=2592000; SameSite=Lax`;
    try {
      localStorage.setItem("souftools_session", JSON.stringify(sessionData));
      sessionStorage.removeItem("souftools_just_logged_out");
    } catch {}
  } catch (err) {
    console.error("Failed to set auth cookie:", err);
  }
}

export function getAuthCookie(): AuthSessionData | null {
  if (typeof window === "undefined") return null;

  // If user explicitly performed sign-out, do not return cached session
  try {
    if (sessionStorage.getItem("souftools_just_logged_out") === "true") {
      return null;
    }
  } catch {}

  // 1. Try document.cookie
  try {
    const match = document.cookie.match(/(?:^|; )\s*souftools_session=([^;]*)/);
    if (match && match[1] && match[1].trim()) {
      const decoded = decodeURIComponent(match[1].trim());
      if (decoded.startsWith("{")) {
        const data = JSON.parse(decoded);
        if (data && typeof data === "object" && data.email) {
          const cleanEmail = data.email.trim().toLowerCase();
          const uId = data.userId || data.uid || undefined;
          const isAdm = data.isAdmin === true;
          return {
            email: cleanEmail,
            userId: uId,
            uid: uId,
            isAdmin: isAdm,
            role: isAdm ? "super_admin" : (data.role || "user"),
            time: data.time,
          };
        }
      }
    }
  } catch (err) {
    // Graceful fallback if cookie format changes
  }

  // 2. Try localStorage fallback (essential for iframes)
  try {
    const raw = localStorage.getItem("souftools_session");
    if (raw && raw.trim() && raw.trim().startsWith("{")) {
      const data = JSON.parse(raw.trim());
      if (data && typeof data === "object" && data.email) {
        const cleanEmail = data.email.trim().toLowerCase();
        const uId = data.userId || data.uid || undefined;
        const isAdm = data.isAdmin === true;
        return {
          email: cleanEmail,
          userId: uId,
          uid: uId,
          isAdmin: isAdm,
          role: isAdm ? "super_admin" : (data.role || "user"),
          time: data.time || Date.now(),
        };
      }
    }
  } catch {}

  return null;
}

export function getOrCreateAuthSession(): AuthSessionData | null {
  const existing = getAuthCookie();
  if (
    existing &&
    existing.email &&
    !existing.email.startsWith("usr_guest_") &&
    !existing.email.startsWith("guest_user@") &&
    !existing.email.endsWith("@souftools.app") &&
    !existing.email.endsWith("@souftools.internal")
  ) {
    return existing;
  }
  return null;
}

export function removeAuthCookie(): void {
  if (typeof window === "undefined") return;
  
  const cookiesToPurge = [
    "souftools_session",
    "better-auth.session_token",
    "better-auth.session_data",
    "better-auth.csrf_token",
    "better-auth.state",
    "__Secure-better-auth.session_token",
  ];

  try {
    const hostname = window.location.hostname;
    for (const name of cookiesToPurge) {
      document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      if (hostname) {
        document.cookie = `${name}=; path=/; domain=${hostname}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      }
    }
  } catch {}

  try {
    localStorage.removeItem("souftools_session");
    localStorage.removeItem("souftools_persistent_guest_id");
    localStorage.removeItem("souftools-auth-storage");
    localStorage.removeItem("souftools_user_profile");
    sessionStorage.clear();
    sessionStorage.setItem("souftools_just_logged_out", "true");
  } catch {}
}
