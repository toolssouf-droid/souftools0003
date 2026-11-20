/**
 * Centralized Admin Roles & Authorization
 * Defines authorized administrator emails, role verification functions,
 * and cryptographically secured master password checks.
 */

import crypto from "crypto";

export const ADMIN_EMAILS: string[] = [];

/**
 * Checks if a given email belongs to an authorized super administrator.
 */
export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const envAdmin = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (envAdmin && clean === envAdmin) return true;
  return ADMIN_EMAILS.some((adm) => adm.toLowerCase() === clean);
}

/**
 * Verifies if the provided password matches the encrypted/hashed master admin password.
 */
export function verifyAdminMasterPassword(inputPassword?: string | null): boolean {
  if (!inputPassword) return false;
  try {
    const inputHash = crypto.createHash("sha256").update(inputPassword.trim()).digest("hex");
    const targetHash = process.env.ADMIN_MASTER_PASSWORD_HASH;
    if (!targetHash) return false;

    // Constant time comparison to prevent timing attacks
    return (
      inputHash.length === targetHash.length &&
      crypto.timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(targetHash, "hex"))
    );
  } catch {
    return false;
  }
}

/**
 * Resolves the role title for display and access control
 */
export function getUserRole(email?: string | null): "super_admin" | "admin" | "user" {
  if (isUserAdmin(email)) {
    return "super_admin";
  }
  return "user";
}
