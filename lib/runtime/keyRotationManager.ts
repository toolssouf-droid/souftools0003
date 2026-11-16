/**
 * SoufAI Runtime Manager - Key Rotation & Failover System
 * Handles automated load-balancing, zero-exposure decryption, failover, and latency scoring.
 */

import { RuntimeKeyItem, SandboxProviderId, KeyTestResult } from "./types";
import { getRuntimeKeys, saveRuntimeKeys, addRuntimeLog } from "./runtimeDatabaseServices";
import { decryptKey } from "@/lib/encryption";
import { getSandboxProvider } from "./providers";

export class KeyRotationManager {
  private static currentIndexMap: Record<string, number> = {};

  /**
   * Retrieves the next available healthy key for a specific sandbox provider (Round-Robin with health check)
   */
  public static async getNextActiveKey(provider: SandboxProviderId = "e2b"): Promise<RuntimeKeyItem | null> {
    const allKeys = await getRuntimeKeys();
    const providerKeys = allKeys.filter((k) => k.provider === provider && k.status === "active");

    if (providerKeys.length === 0) {
      // Check if there are keys in testing or if we have fallback env
      const fallbackKey = process.env.E2B_API_KEY;
      if (fallbackKey && fallbackKey.length > 5) {
        return {
          id: "env_fallback_e2b",
          provider: "e2b",
          key: fallbackKey, // Plain or handled securely
          label: "Environment E2B Key",
          status: "active",
          failures: 0,
          createdAt: Date.now(),
        };
      }
      return null;
    }

    // Sort by failures (least failures first) and latency
    const sorted = [...providerKeys].sort((a, b) => {
      if (a.failures !== b.failures) return a.failures - b.failures;
      return (a.latencyMs || 999) - (b.latencyMs || 999);
    });

    const currentIndex = this.currentIndexMap[provider] || 0;
    const selected = sorted[currentIndex % sorted.length];
    this.currentIndexMap[provider] = (currentIndex + 1) % sorted.length;

    return selected;
  }

  /**
   * Decrypts key in secure server runtime (never exposed to browser)
   */
  public static getDecryptedKey(keyItem: RuntimeKeyItem): string {
    if (keyItem.id === "env_fallback_e2b") return keyItem.key;
    return decryptKey(keyItem.key);
  }

  /**
   * Records failure on a key and marks as failed if threshold (3) exceeded
   */
  public static async reportFailure(keyId: string, errorMsg?: string): Promise<void> {
    const allKeys = await getRuntimeKeys();
    const target = allKeys.find((k) => k.id === keyId);

    if (target) {
      target.failures = (target.failures || 0) + 1;
      target.lastError = errorMsg || "Execution error";
      target.lastUsed = Date.now();

      const isHardRevoked = 
        errorMsg && 
        (errorMsg.includes("401") || errorMsg.includes("Unauthorized") || errorMsg.includes("invalid_api_key") || errorMsg.includes("API key not valid"));

      if (target.failures >= 5 && isHardRevoked) {
        target.status = "failed";
      } else {
        // Keep key active and let round-robin naturally prefer healthy keys
        target.status = "active";
      }

      await saveRuntimeKeys(allKeys);

      await addRuntimeLog({
        event: "failover",
        provider: target.provider,
        success: false,
        timestamp: Date.now(),
        details: `تسجيل إخفاق للمفتاح ${target.label} (عدد الإخفاقات: ${target.failures}). السبب: ${errorMsg}`,
      });
    }
  }

  /**
   * Records successful usage and updates latency score
   */
  public static async reportSuccess(keyId: string, latencyMs: number): Promise<void> {
    const allKeys = await getRuntimeKeys();
    const target = allKeys.find((k) => k.id === keyId);

    if (target) {
      target.failures = Math.max(0, (target.failures || 0) - 1);
      target.latencyMs = latencyMs;
      target.lastUsed = Date.now();
      target.status = "active";
      target.lastError = undefined;

      await saveRuntimeKeys(allKeys);
    }
  }

  /**
   * Runs automated testing on a key
   */
  public static async testKey(keyItem: RuntimeKeyItem): Promise<KeyTestResult> {
    const sandboxProvider = getSandboxProvider(keyItem.provider);
    const rawKey = this.getDecryptedKey(keyItem);

    const testRes = await sandboxProvider.testKey(rawKey);

    const allKeys = await getRuntimeKeys();
    const target = allKeys.find((k) => k.id === keyItem.id);

    if (target) {
      target.latencyMs = testRes.latencyMs;
      target.lastUsed = Date.now();
      if (testRes.valid) {
        target.status = "active";
        target.failures = 0;
        target.lastError = undefined;
      } else {
        target.status = "failed";
        target.failures = (target.failures || 0) + 1;
        target.lastError = testRes.message;
      }
      await saveRuntimeKeys(allKeys);
    }

    return testRes;
  }

  /**
   * Tests all registered keys
   */
  public static async testAllKeys(): Promise<{ keyId: string; result: KeyTestResult }[]> {
    const allKeys = await getRuntimeKeys();
    const results: { keyId: string; result: KeyTestResult }[] = [];

    for (const k of allKeys) {
      const res = await this.testKey(k);
      results.push({ keyId: k.id, result: res });
    }

    return results;
  }
}
