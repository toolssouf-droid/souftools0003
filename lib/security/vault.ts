/**
 * SoufTools Key Vault & Envelope Encryption Service (Turso Backend)
 *
 * Implements strict AES-256-GCM Envelope Encryption for AI Provider API keys:
 * Master Encryption Key (MEK) -> Key Encryption Key (KEK) -> Encrypted Provider Key -> Turso
 *
 * MEK is loaded strictly server-side from environment variables.
 * Keys are decrypted strictly in-memory during external API requests and discarded immediately.
 */

import crypto from "crypto";
import { getReadyDb } from "@/lib/db";
import { encryptedVaultKeys, adminLogs } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

function getConfiguredMasterKey(): Buffer {
  const raw =
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.MASTER_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_SECRET;

  if (!raw) {
    throw new Error("Encryption key configuration is missing");
  }

  const clean = raw.trim();
  let key: Buffer;
  if (/^[a-fA-F0-9]{64}$/.test(clean)) {
    key = Buffer.from(clean, "hex");
  } else {
    try {
      const base64 = Buffer.from(clean, "base64");
      key = base64.length === 32 && base64.toString("base64").replace(/=+$/, "") === clean.replace(/=+$/, "")
        ? base64
        : Buffer.alloc(0);
    } catch {
      key = Buffer.alloc(0);
    }
  }
  if (key.length === 0) {
    key = Buffer.from(clean, "utf8");
  }
  if (key.length < 32) {
    throw new Error("Encryption key must be at least 32 bytes");
  }
  return crypto.createHash("sha256").update(key).digest();
}

function deriveKEK(version: number, masterKey = getConfiguredMasterKey()): Buffer {
  const salt = Buffer.from("souftools_vault_salt_v1", "utf8");
  const info = Buffer.from(`kek-version-${version}`, "utf8");
  return Buffer.from(crypto.hkdfSync("sha256", masterKey, salt, info, 32));
}

export interface EncryptedKeyPayload {
  keyId: string;
  providerId: string;
  keyVersion: number;
  encryptionVersion: string;
  ivHex: string;
  authTagHex: string;
  ciphertextHex: string;
}

export const KeyVault = {
  /**
   * Encrypts a provider API key using AES-256-GCM Envelope Encryption
   * and atomically persists the ciphertext and audit log into Turso.
   */
  async storeProviderKey(params: {
    providerId: string;
    plainKey: string;
    keyLabel?: string;
    userId?: string | null;
    keyVersion?: number;
  }): Promise<{ success: boolean; keyId: string; masked: string }> {
    const { providerId, plainKey, keyLabel, userId = null, keyVersion = 1 } = params;

    if (!plainKey || plainKey.trim() === "") {
      throw new Error("Cannot encrypt empty API key");
    }

    const cleanKey = plainKey.trim();
    const kek = deriveKEK(keyVersion);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
    let ciphertext = cipher.update(cleanKey, "utf8", "hex");
    ciphertext += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    const keyId = `vkey_${providerId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    try {
      const database = await getReadyDb();
      await database.transaction(async (tx) => {
        await tx.insert(encryptedVaultKeys).values({
          id: keyId,
          userId: userId || null,
          providerId,
          keyLabel: keyLabel || `${providerId} Key`,
          keyVersion,
          encryptionVersion: "v1_aes256gcm",
          iv: iv.toString("hex"),
          authTag: authTag.toString("hex"),
          ciphertext,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        await tx.insert(adminLogs).values({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          adminUserId: userId || "system",
          action: "VAULT_KEY_STORED",
          resourceType: "provider_key",
          resourceId: keyId,
          details: {
            providerId,
            keyVersion,
            encryptionVersion: "v1_aes256gcm",
          },
          createdAt: now,
        });
      });

      return {
        success: true,
        keyId,
        masked: KeyVault.maskKey(cleanKey),
      };
    } catch (err: any) {
      console.error(`[KeyVault] Failed to store encrypted key for ${providerId}:`, err.message);
      throw new Error(`Failed to store encrypted key: ${err.message}`);
    }
  },

  /**
   * Decrypts an active provider API key in-memory on demand, enforcing user/system isolation.
   */
  async getDecryptedKey(params: {
    providerId: string;
    userId?: string | null;
  }): Promise<string | null> {
    const { providerId, userId } = params;

    try {
      const database = await getReadyDb();
      let record: typeof encryptedVaultKeys.$inferSelect | null = null;

      if (userId) {
        const rows = await database
          .select()
          .from(encryptedVaultKeys)
          .where(
            and(
              eq(encryptedVaultKeys.providerId, providerId),
              eq(encryptedVaultKeys.userId, userId),
              eq(encryptedVaultKeys.status, "active")
            )
          )
          .orderBy(desc(encryptedVaultKeys.keyVersion))
          .limit(1);
        if (rows.length > 0) record = rows[0];
      }

      if (!record) {
        // Strictly select system-level keys (userId IS NULL) so one user's key never leaks to another user
        const rows = await database
          .select()
          .from(encryptedVaultKeys)
          .where(
            and(
              eq(encryptedVaultKeys.providerId, providerId),
              isNull(encryptedVaultKeys.userId),
              eq(encryptedVaultKeys.status, "active")
            )
          )
          .orderBy(desc(encryptedVaultKeys.keyVersion))
          .limit(1);
        if (rows.length > 0) record = rows[0];
      }

      if (!record) {
        const envName = `${providerId.toUpperCase().replace(/-/g, "_")}_API_KEY`;
        return process.env[envName] || null;
      }

      const kek = deriveKEK(record.keyVersion);
      const iv = Buffer.from(record.iv, "hex");
      const authTag = Buffer.from(record.authTag, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(record.ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");

      database
        .update(encryptedVaultKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(encryptedVaultKeys.id, record.id))
        .catch(() => null);

      return decrypted;
    } catch (err: any) {
      console.error(`[KeyVault] Decryption failed for provider ${providerId}:`, err.message);
      return null;
    }
  },

  /**
   * Atomically rotates a provider key with zero downtime (scoped cleanly to userId or system scope).
   */
  async rotateKey(params: {
    providerId: string;
    newPlainKey: string;
    userId?: string | null;
  }): Promise<{ success: boolean; newKeyId: string; masked: string }> {
    const { providerId, newPlainKey, userId = null } = params;
    if (!newPlainKey || newPlainKey.trim() === "") {
      throw new Error("Cannot encrypt empty API key");
    }

    const database = await getReadyDb();
    const cleanKey = newPlainKey.trim();
    const scopeFilter = userId ? eq(encryptedVaultKeys.userId, userId) : isNull(encryptedVaultKeys.userId);

    const newKeyId = `vkey_${providerId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await database.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(encryptedVaultKeys)
        .where(
          and(
            eq(encryptedVaultKeys.providerId, providerId),
            scopeFilter,
            eq(encryptedVaultKeys.status, "active")
          )
        )
        .orderBy(desc(encryptedVaultKeys.keyVersion))
        .limit(1);

      const existing = existingRows[0];
      const nextVersion = existing ? existing.keyVersion + 1 : 1;
      const now = new Date();

      if (existing) {
        await tx
          .update(encryptedVaultKeys)
          .set({ status: "rotated", rotatedAt: now, updatedAt: now })
          .where(
            and(
              eq(encryptedVaultKeys.providerId, providerId),
              scopeFilter,
              eq(encryptedVaultKeys.status, "active")
            )
          );
      }

      const kek = deriveKEK(nextVersion);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
      let ciphertext = cipher.update(cleanKey, "utf8", "hex");
      ciphertext += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      await tx.insert(encryptedVaultKeys).values({
        id: newKeyId,
        userId: userId || null,
        providerId,
        keyLabel: `${providerId} Key (v${nextVersion})`,
        keyVersion: nextVersion,
        encryptionVersion: "v1_aes256gcm",
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        ciphertext,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(adminLogs).values({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        adminUserId: userId || "system",
        action: "VAULT_KEY_ROTATED",
        resourceType: "provider_key",
        resourceId: newKeyId,
        details: {
          providerId,
          keyVersion: nextVersion,
          encryptionVersion: "v1_aes256gcm",
        },
        createdAt: now,
      });
    });

    return {
      success: true,
      newKeyId,
      masked: KeyVault.maskKey(cleanKey),
    };
  },

  maskKey(key: any): string {
    const str = typeof key === "string" ? key.trim() : String(key || "").trim();
    if (!str || str.length < 8) return "••••••••";
    const prefix = str.slice(0, 4);
    const suffix = str.slice(-4);
    return `${prefix}••••••••••••${suffix}`;
  },
};
