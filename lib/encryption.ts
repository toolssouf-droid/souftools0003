/**
 * SoufTools Key Encryption Utility
 * Provides authenticated AES-256-GCM encryption with fallback support for legacy keys
 */

import crypto from "crypto";

const SECRET = process.env.ENCRYPTION_SECRET || "souftools_default_secret_2026_x";
const GCM_PREFIX = "gcm:";
const ENC_PREFIX = "enc:";

// Derive 32-byte key from secret
const GCM_KEY = crypto.createHash("sha256").update(SECRET).digest();

export function encryptKey(plainKey: any): string {
  if (!plainKey) return "";
  if (typeof plainKey !== "string") {
    if (typeof plainKey === "object") {
      const extracted = plainKey.apiToken || plainKey.key || "";
      return encryptKey(extracted);
    }
    return String(plainKey);
  }
  if (plainKey.startsWith(GCM_PREFIX)) return plainKey; // Already AES-GCM encrypted
  if (plainKey.startsWith(ENC_PREFIX)) return plainKey; // Legacy encrypted

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", GCM_KEY, iv);
    let encrypted = cipher.update(plainKey, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    // Format: gcm:<iv>:<authTag>:<ciphertext>
    return `${GCM_PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error("Error encrypting key with AES-256-GCM:", err);
    return plainKey;
  }
}

export function decryptKey(encryptedKey: any): string {
  if (!encryptedKey) return "";
  if (typeof encryptedKey !== "string") {
    if (typeof encryptedKey === "object") {
      const extracted = encryptedKey.apiToken || encryptedKey.key || "";
      return decryptKey(extracted);
    }
    return String(encryptedKey);
  }

  // 1. Handle AES-256-GCM format: gcm:<iv>:<authTag>:<ciphertext>
  if (encryptedKey.startsWith(GCM_PREFIX)) {
    try {
      const parts = encryptedKey.slice(GCM_PREFIX.length).split(":");
      if (parts.length === 3) {
        const [ivHex, authTagHex, cipherHex] = parts;
        const decipher = crypto.createDecipheriv("aes-256-gcm", GCM_KEY, Buffer.from(ivHex, "hex"));
        decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
        let decrypted = decipher.update(cipherHex, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      }
    } catch (err) {
      console.warn("AES-256-GCM decryption failed, falling back:", err);
      return encryptedKey;
    }
  }

  // 2. Handle Legacy XOR format: enc:<base64>
  if (encryptedKey.startsWith(ENC_PREFIX)) {
    try {
      const encoded = encryptedKey.slice(ENC_PREFIX.length);
      const raw = typeof Buffer !== "undefined"
        ? Buffer.from(encoded, "base64").toString("binary")
        : atob(encoded);
      let result = "";
      for (let i = 0; i < raw.length; i++) {
        const charCode = raw.charCodeAt(i) ^ SECRET.charCodeAt(i % SECRET.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch (err) {
      return encryptedKey;
    }
  }

  // Raw plain text key
  return encryptedKey;
}

export function maskKey(key: any): string {
  const str = typeof key === "string" ? key.trim() : String(key || "").trim();
  if (!str || str.length < 8) return "••••••••";
  const prefix = str.slice(0, 4);
  const suffix = str.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

