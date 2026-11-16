/**
 * SoufTools Better Auth Client
 * Provides reactive hooks, sign-in, sign-up, social login, and session helpers for the browser.
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || ""),
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
