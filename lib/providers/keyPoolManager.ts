// lib/providers/keyPoolManager.ts
/**
 * Smart Key Pool & Round-Robin Load Balancer Engine
 * 
 * Prevents API Key bans and 429 Rate Limits by:
 * 1. Evenly rotating requests across all available keys (Round-Robin).
 * 2. Placing rate-limited keys into transient cooldown (Circuit Breaker).
 * 3. Immediately trying the next healthy key for the EXACT SAME MODEL without changing models.
 * 4. Supporting multi-key strings (comma, newline, or semicolon delimited).
 * 5. Tracking detailed per-key telemetry in memory with zero overhead.
 */

import { healthManager } from "../healthManager";

export type KeyHealthStatus = "active" | "cooldown" | "exhausted" | "probing";

export interface KeyTelemetry {
  providerId: string;
  rawKey: string;
  maskedKey: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  rateLimitHits: number;
  lastUsedAt: number;
  status: KeyHealthStatus;
  cooldownUntil: number;
  lastError?: string;
}

class KeyPoolManager {
  // Round-robin rotation pointer per provider
  private rotationPointers: Map<string, number> = new Map();

  // In-memory telemetry per key hash (provider:mask)
  private telemetryMap: Map<string, KeyTelemetry> = new Map();

  /**
   * Helper to generate consistent key mask
   */
  public maskKey(rawKey: string): string {
    const clean = (rawKey || "").trim();
    if (clean.length <= 8) return clean;
    return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
  }

  /**
   * Helper to generate unique key identifier
   */
  private getKeyId(providerId: string, rawKey: string): string {
    return `${providerId.toLowerCase().trim()}:${this.maskKey(rawKey)}`;
  }

  /**
   * Parse multi-key inputs into a clean array of valid keys
   * Supports: comma-separated, newline-separated, semicolon-separated, or arrays
   */
  public parseMultiKeyInput(input: any): string[] {
    if (!input) return [];

    let rawList: string[] = [];

    if (Array.isArray(input)) {
      for (const item of input) {
        if (typeof item === "string") {
          rawList.push(...this.parseMultiKeyInput(item));
        } else if (item && typeof item === "object" && item.key) {
          rawList.push(...this.parseMultiKeyInput(item.key));
        }
      }
    } else if (typeof input === "string") {
      // Split on newlines, commas, semicolons, or pipe characters
      const parts = input.split(/[\r\n,;|]+/);
      for (const part of parts) {
        const clean = part.replace(/^["']|["']$/g, "").trim();
        if (clean) rawList.push(clean);
      }
    }

    // Deduplicate and filter out demo / invalid dummy keys
    const seen = new Set<string>();
    const valid: string[] = [];

    for (const key of rawList) {
      const clean = key.trim();
      if (
        clean.length >= 8 &&
        !clean.includes("demo_key") &&
        !clean.includes("demo-openai") &&
        !clean.includes("demo-key") &&
        !seen.has(clean)
      ) {
        seen.add(clean);
        valid.push(clean);
      }
    }

    return valid;
  }

  /**
   * Get an ordered list of keys for a provider using Round-Robin Load Balancing
   * Ensures that:
   * 1. Traffic is evenly rotated between all healthy keys (avoiding hot-spotting).
   * 2. Quarantined / cooldown keys are placed at the end of the line.
   * 3. If all keys are in cooldown, the one closest to expiry is offered as a soft probe.
   */
  public getOrderedKeysForProvider(
    providerId: string,
    rawKeys: string[]
  ): Array<{ key: string; masked: string; isProbe: boolean; status: KeyHealthStatus }> {
    const validKeys = this.parseMultiKeyInput(rawKeys);
    if (validKeys.length === 0) return [];

    const now = Date.now();
    const pid = providerId.toLowerCase().trim();

    // Partition keys into healthy and quarantined
    const healthyKeys: string[] = [];
    const quarantinedKeys: { key: string; remainingMs: number }[] = [];

    for (const key of validKeys) {
      const keyHealth = healthManager.isKeyQuarantined(pid, key, false);
      const tele = this.getOrCreateTelemetry(pid, key);

      if (tele.cooldownUntil > now) {
        quarantinedKeys.push({ key, remainingMs: tele.cooldownUntil - now });
      } else if (keyHealth.quarantined) {
        quarantinedKeys.push({ key, remainingMs: keyHealth.remainingMs });
      } else {
        healthyKeys.push(key);
      }
    }

    // Sort quarantined keys by least remaining cooldown time (first to recover)
    quarantinedKeys.sort((a, b) => a.remainingMs - b.remainingMs);

    const result: Array<{ key: string; masked: string; isProbe: boolean; status: KeyHealthStatus }> = [];

    if (healthyKeys.length > 0) {
      // Apply Round-Robin rotation over healthy keys
      let currentPointer = this.rotationPointers.get(pid) || 0;
      currentPointer = currentPointer % healthyKeys.length;

      // Slice from current pointer to end, then from 0 to pointer
      const rotatedHealthy = [
        ...healthyKeys.slice(currentPointer),
        ...healthyKeys.slice(0, currentPointer)
      ];

      // Advance pointer for the NEXT request to evenly balance traffic
      this.rotationPointers.set(pid, (currentPointer + 1) % healthyKeys.length);

      for (const k of rotatedHealthy) {
        result.push({
          key: k,
          masked: this.maskKey(k),
          isProbe: false,
          status: "active"
        });
      }

      // Append quarantined keys at the end as last-resort fallbacks
      for (const q of quarantinedKeys) {
        result.push({
          key: q.key,
          masked: this.maskKey(q.key),
          isProbe: true,
          status: "cooldown"
        });
      }
    } else {
      // All keys are quarantined! Offer the closest to recovery as an emergency probe
      for (let i = 0; i < quarantinedKeys.length; i++) {
        result.push({
          key: quarantinedKeys[i].key,
          masked: this.maskKey(quarantinedKeys[i].key),
          isProbe: i === 0, // First one is an active probe
          status: "cooldown"
        });
      }
    }

    return result;
  }

  /**
   * Record outcome of using a key (Success or Failure)
   */
  public recordKeyOutcome(
    providerId: string,
    rawKey: string,
    outcome: {
      success: boolean;
      statusCode?: number;
      errorText?: string;
    }
  ): { quarantined: boolean; durationSeconds: number; reason: string } {
    const pid = providerId.toLowerCase().trim();
    const tele = this.getOrCreateTelemetry(pid, rawKey);
    const now = Date.now();

    tele.lastUsedAt = now;
    tele.requestCount += 1;

    if (outcome.success) {
      tele.successCount += 1;
      tele.status = "active";
      tele.cooldownUntil = 0;
      tele.lastError = undefined;

      // Notify global health manager
      healthManager.recordKeySuccess(pid, rawKey);

      return { quarantined: false, durationSeconds: 0, reason: "Success" };
    }

    // Failure Handling
    tele.failureCount += 1;
    const err = outcome.errorText || "";
    tele.lastError = err.slice(0, 200);

    const isRateLimitOrQuota =
      outcome.statusCode === 429 ||
      err.includes("429") ||
      err.includes("quota") ||
      err.includes("rate_limit") ||
      err.includes("Resource has been exhausted") ||
      err.includes("TPM") ||
      err.includes("RPM") ||
      err.includes("insufficient_quota");

    const isHardAuthInvalid =
      outcome.statusCode === 401 ||
      err.includes("invalid_api_key") ||
      err.includes("API key not valid") ||
      err.includes("Incorrect API key") ||
      err.includes("API_KEY_INVALID");

    let quarantined = false;
    let durationSeconds = 0;
    let reason = "General Failure";

    if (isRateLimitOrQuota) {
      tele.rateLimitHits += 1;
      // Smart transient micro-pause for rate limits: 3s for first hit, 5s for second, 8s for 3+
      durationSeconds = tele.rateLimitHits === 1 ? 3 : tele.rateLimitHits === 2 ? 5 : 8;
      tele.cooldownUntil = now + durationSeconds * 1000;
      tele.status = "cooldown";
      quarantined = true;
      reason = `Rate limit transient pause (${outcome.statusCode || 429}) for ${durationSeconds}s. Rotating immediately to next key.`;

      console.warn(
        `🛡️ [Key Pool Circuit Breaker] Key ${tele.maskedKey} (${pid}) transient rate limit. Micro-pause ${durationSeconds}s. Rotating immediately to next key.`
      );

      // Register in health manager with transient flag
      healthManager.recordKeyFailure(pid, rawKey, err, false);
    } else if (isHardAuthInvalid) {
      // 15 seconds transient probe check for auth failure
      durationSeconds = 15;
      tele.cooldownUntil = now + durationSeconds * 1000;
      tele.status = "exhausted";
      quarantined = true;
      reason = "Invalid or revoked API key.";

      healthManager.recordKeyFailure(pid, rawKey, err, true);
    } else {
      // Standard failure
      healthManager.recordKeyFailure(pid, rawKey, err, false);
    }

    return { quarantined, durationSeconds, reason };
  }

  /**
   * Reset all cooldowns for a provider or all providers
   */
  public resetCooldowns(providerId?: string): number {
    let count = 0;
    const pid = providerId?.toLowerCase().trim();

    this.telemetryMap.forEach((tele, keyId) => {
      if (!pid || tele.providerId === pid) {
        if (tele.status !== "active" || tele.cooldownUntil > 0) count++;
        tele.status = "active";
        tele.cooldownUntil = 0;
        tele.rateLimitHits = 0;
        tele.lastError = undefined;
      }
    });

    if (pid) {
      healthManager.unbanAll();
    }

    return count;
  }

  /**
   * Retrieve telemetry snapshot for administrative inspection and monitoring
   */
  public getPoolStats(providerId?: string): KeyTelemetry[] {
    const pid = providerId?.toLowerCase().trim();
    const result: KeyTelemetry[] = [];
    const now = Date.now();

    this.telemetryMap.forEach((tele) => {
      if (!pid || tele.providerId === pid) {
        // Update live status based on time
        if (tele.cooldownUntil > now) {
          tele.status = "cooldown";
        } else if (tele.status === "cooldown") {
          tele.status = "active";
          tele.cooldownUntil = 0;
        }
        result.push({ ...tele });
      }
    });

    return result;
  }

  /**
   * Internal helper to retrieve or create telemetry record
   */
  private getOrCreateTelemetry(providerId: string, rawKey: string): KeyTelemetry {
    const id = this.getKeyId(providerId, rawKey);
    let existing = this.telemetryMap.get(id);

    if (!existing) {
      existing = {
        providerId,
        rawKey,
        maskedKey: this.maskKey(rawKey),
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        rateLimitHits: 0,
        lastUsedAt: 0,
        status: "active",
        cooldownUntil: 0,
      };
      this.telemetryMap.set(id, existing);
    }

    return existing;
  }
}

export const keyPoolManager = new KeyPoolManager();
