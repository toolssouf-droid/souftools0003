/**
 * SoufAI Model & Key Progressive Cooldown & Quarantine Health Manager
 * 
 * Rules:
 * 1. Model-level Quarantine:
 *    - Fails 3 times consecutively -> Quarantined for 3 minutes.
 *    - If it fails again after cooldown expires -> Quarantined for 15 minutes.
 *    - If it fails again -> Quarantined for 1 hour.
 *    - Subsequent failures -> Quarantined for 6 hours.
 * 2. Key-level Quarantine:
 *    - If all models fail or key hits quota / 401 / 429 repeatedly -> Key is quarantined progressively (3m -> 15m -> 1h).
 * 3. Health State & Auto Recovery:
 *    - On successful completion, failures are cleared and cooldown level is decremented/reset.
 *    - Admin can inspect, unban individual models/keys, or reset all bans.
 */

export interface QuarantineEntry {
  id: string; // e.g. "groq:llama-3.3-70b-versatile" or "gemini:key_hash"
  providerId: string;
  targetName: string; // model name or masked key
  type: "model" | "key";
  consecutiveFailures: number;
  quarantineLevel: number; // 0 = healthy, 1 = 3m, 2 = 15m, 3 = 1h, 4 = 6h
  quarantineUntil: number; // timestamp in ms
  lastFailureTime: number;
  lastSuccessTime?: number;
  lastError?: string;
  totalFailures: number;
  totalSuccesses: number;
}

const COOLDOWN_DURATIONS_MS = [
  0,                  // Level 0: Not quarantined
  3 * 1000,           // Level 1: 3 seconds (Fast transient pause)
  5 * 1000,           // Level 2: 5 seconds (Micro backoff)
  10 * 1000,          // Level 3: 10 seconds
  15 * 1000,          // Level 4+: 15 seconds max (Never lock out for hours/minutes)
];

const FAILURE_THRESHOLD = 3;

class HealthManagerService {
  private modelHealth: Map<string, QuarantineEntry> = new Map();
  private keyHealth: Map<string, QuarantineEntry> = new Map();

  private getModelKey(providerId: string, model: string): string {
    return `${providerId.toLowerCase().trim()}:${model.toLowerCase().trim()}`;
  }

  private getKeyHash(providerId: string, rawKey: string): string {
    const cleanKey = (rawKey || "").trim();
    const mask = cleanKey.length > 8 ? `${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)}` : cleanKey;
    return `${providerId.toLowerCase().trim()}:${mask}`;
  }

  /**
   * Check if a specific model is currently in quarantine/cooldown
   * With soft probe allowance to prevent false "service busy" blocks
   */
  public isModelQuarantined(providerId: string, model: string, allowProbe: boolean = false): {
    quarantined: boolean;
    remainingMs: number;
    remainingFormatted: string;
    level: number;
    failures: number;
    lastError?: string;
  } {
    const id = this.getModelKey(providerId, model);
    const entry = this.modelHealth.get(id);

    if (!entry) {
      return { quarantined: false, remainingMs: 0, remainingFormatted: "", level: 0, failures: 0 };
    }

    const now = Date.now();
    if (entry.quarantineUntil > now) {
      // If allowProbe is true and cooldown was active for more than 1.5s, allow a live test probe
      if (allowProbe && (now - (entry.quarantineUntil - (COOLDOWN_DURATIONS_MS[entry.quarantineLevel] || 3000))) > 1500) {
        return {
          quarantined: false, // Allow live probe
          remainingMs: 0,
          remainingFormatted: "فحص حي مباشر",
          level: entry.quarantineLevel,
          failures: entry.consecutiveFailures,
          lastError: entry.lastError,
        };
      }

      const remainingMs = entry.quarantineUntil - now;
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      const remainingFormatted = minutes > 0 ? `${minutes}د و ${seconds}ث` : `${seconds} ثانية`;

      return {
        quarantined: true,
        remainingMs,
        remainingFormatted,
        level: entry.quarantineLevel,
        failures: entry.consecutiveFailures,
        lastError: entry.lastError,
      };
    }

    return {
      quarantined: false,
      remainingMs: 0,
      remainingFormatted: "",
      level: entry.quarantineLevel,
      failures: entry.consecutiveFailures,
      lastError: entry.lastError,
    };
  }

  /**
   * Check if a specific API key is currently in quarantine/cooldown
   */
  public isKeyQuarantined(providerId: string, rawKey: string, allowProbe: boolean = false): {
    quarantined: boolean;
    remainingMs: number;
    remainingFormatted: string;
    level: number;
    failures: number;
    lastError?: string;
  } {
    const id = this.getKeyHash(providerId, rawKey);
    const entry = this.keyHealth.get(id);

    if (!entry) {
      return { quarantined: false, remainingMs: 0, remainingFormatted: "", level: 0, failures: 0 };
    }

    const now = Date.now();
    if (entry.quarantineUntil > now) {
      if (allowProbe && (now - (entry.quarantineUntil - (COOLDOWN_DURATIONS_MS[entry.quarantineLevel] || 3000))) > 1500) {
        return {
          quarantined: false, // Allow live probe
          remainingMs: 0,
          remainingFormatted: "فحص حي مباشر",
          level: entry.quarantineLevel,
          failures: entry.consecutiveFailures,
          lastError: entry.lastError,
        };
      }

      const remainingMs = entry.quarantineUntil - now;
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      const remainingFormatted = minutes > 0 ? `${minutes}د و ${seconds}ث` : `${seconds} ثانية`;

      return {
        quarantined: true,
        remainingMs,
        remainingFormatted,
        level: entry.quarantineLevel,
        failures: entry.consecutiveFailures,
        lastError: entry.lastError,
      };
    }

    return {
      quarantined: false,
      remainingMs: 0,
      remainingFormatted: "",
      level: entry.quarantineLevel,
      failures: entry.consecutiveFailures,
      lastError: entry.lastError,
    };
  }

  /**
   * Record failure on a specific model
   */
  public recordModelFailure(
    providerId: string,
    model: string,
    error?: string
  ): { quarantined: boolean; durationMinutes: number; level: number; failures: number } {
    const id = this.getModelKey(providerId, model);
    const now = Date.now();
    const existing = this.modelHealth.get(id) || {
      id,
      providerId,
      targetName: model,
      type: "model",
      consecutiveFailures: 0,
      quarantineLevel: 0,
      quarantineUntil: 0,
      lastFailureTime: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    };

    existing.consecutiveFailures += 1;
    existing.totalFailures += 1;
    existing.lastFailureTime = now;
    existing.lastError = error ? (error.length > 200 ? error.slice(0, 200) + "..." : error) : "خطأ استجابة من النموذج";

    let quarantined = false;
    let durationMinutes = 0;

    // Check if threshold reached
    const isRateLimitOrQuota =
      existing.lastError &&
      (existing.lastError.includes("429") ||
        existing.lastError.includes("quota") ||
        existing.lastError.includes("rate_limit") ||
        existing.lastError.includes("Resource has been exhausted") ||
        existing.lastError.includes("TPM") ||
        existing.lastError.includes("RPM"));

    if (existing.consecutiveFailures >= FAILURE_THRESHOLD) {
      if (isRateLimitOrQuota) {
        // Transient rate-limit throttle for 3-5s only
        const durationMs = 4 * 1000;
        existing.quarantineUntil = now + durationMs;
        existing.consecutiveFailures = 0;
        quarantined = true;
        durationMinutes = 0.06;
        console.warn(
          `⏱️ [Model Health] Transient rate-limit pause for "${model}" (${providerId}) for 4s. Ready for immediate retry.`
        );
      } else {
        // Brief pause (5-10s max) for technical/network retry
        existing.quarantineLevel = Math.min(
          existing.quarantineLevel + 1,
          COOLDOWN_DURATIONS_MS.length - 1
        );
        const durationMs =
          COOLDOWN_DURATIONS_MS[existing.quarantineLevel] || COOLDOWN_DURATIONS_MS[1];
        existing.quarantineUntil = now + durationMs;
        existing.consecutiveFailures = 0;
        quarantined = true;
        durationMinutes = Math.round(durationMs / 1000) / 60;
        console.warn(
          `⚠️ [Model Health] Fast cooldown for model "${model}" (${providerId}) for ${Math.round(durationMs / 1000)}s (Level ${existing.quarantineLevel}). Reason: ${existing.lastError}`
        );
      }
    }

    this.modelHealth.set(id, existing);
    return { quarantined, durationMinutes, level: existing.quarantineLevel, failures: existing.consecutiveFailures };
  }

  /**
   * Record success on a specific model
   */
  public recordModelSuccess(providerId: string, model: string): void {
    const id = this.getModelKey(providerId, model);
    const existing = this.modelHealth.get(id);
    const now = Date.now();

    if (existing) {
      existing.consecutiveFailures = 0;
      existing.quarantineUntil = 0;
      existing.lastSuccessTime = now;
      existing.totalSuccesses += 1;
      existing.quarantineLevel = 0; // Immediate full recovery on success
      this.modelHealth.set(id, existing);
    } else {
      this.modelHealth.set(id, {
        id,
        providerId,
        targetName: model,
        type: "model",
        consecutiveFailures: 0,
        quarantineLevel: 0,
        quarantineUntil: 0,
        lastFailureTime: 0,
        lastSuccessTime: now,
        totalFailures: 0,
        totalSuccesses: 1,
      });
    }
  }

  /**
   * Record failure on a specific API Key
   */
  public recordKeyFailure(
    providerId: string,
    rawKey: string,
    error?: string,
    isHardQuotaError: boolean = false
  ): { quarantined: boolean; durationMinutes: number; level: number } {
    const id = this.getKeyHash(providerId, rawKey);
    const now = Date.now();
    const mask = rawKey.length > 8 ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}` : rawKey;

    const existing = this.keyHealth.get(id) || {
      id,
      providerId,
      targetName: mask,
      type: "key",
      consecutiveFailures: 0,
      quarantineLevel: 0,
      quarantineUntil: 0,
      lastFailureTime: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    };

    existing.consecutiveFailures += isHardQuotaError ? 2 : 1;
    existing.totalFailures += 1;
    existing.lastFailureTime = now;
    existing.lastError = error ? (error.length > 200 ? error.slice(0, 200) + "..." : error) : "خطأ مصادقة أو انتهاء الرصيد";

    let quarantined = false;
    let durationMinutes = 0;

    if (existing.consecutiveFailures >= FAILURE_THRESHOLD) {
      existing.quarantineLevel = Math.min(existing.quarantineLevel + 1, COOLDOWN_DURATIONS_MS.length - 1);
      const durationMs = COOLDOWN_DURATIONS_MS[existing.quarantineLevel] || COOLDOWN_DURATIONS_MS[1];
      existing.quarantineUntil = now + durationMs;
      existing.consecutiveFailures = 0;
      quarantined = true;
      durationMinutes = Math.round(durationMs / 1000) / 60;
      console.warn(`⚠️ [Key Health] Fast cooldown for key "${mask}" (${providerId}) for ${Math.round(durationMs / 1000)}s (Level ${existing.quarantineLevel}). Reason: ${existing.lastError}`);
    }

    this.keyHealth.set(id, existing);
    return { quarantined, durationMinutes, level: existing.quarantineLevel };
  }

  /**
   * Record success on a specific API Key
   */
  public recordKeySuccess(providerId: string, rawKey: string): void {
    const id = this.getKeyHash(providerId, rawKey);
    const existing = this.keyHealth.get(id);
    const now = Date.now();

    if (existing) {
      existing.consecutiveFailures = 0;
      existing.quarantineUntil = 0;
      existing.lastSuccessTime = now;
      existing.totalSuccesses += 1;
      existing.quarantineLevel = 0; // Immediate full recovery on success
      this.keyHealth.set(id, existing);
    }
  }

  /**
   * Unban / Reset specific model health
   */
  public unbanModel(providerId: string, model: string): void {
    const id = this.getModelKey(providerId, model);
    const existing = this.modelHealth.get(id);
    if (existing) {
      existing.consecutiveFailures = 0;
      existing.quarantineLevel = 0;
      existing.quarantineUntil = 0;
      existing.lastError = undefined;
      this.modelHealth.set(id, existing);
    }
  }

  /**
   * Unban / Reset specific key health
   */
  public unbanKey(providerId: string, rawKey: string): void {
    const id = this.getKeyHash(providerId, rawKey);
    const existing = this.keyHealth.get(id);
    if (existing) {
      existing.consecutiveFailures = 0;
      existing.quarantineLevel = 0;
      existing.quarantineUntil = 0;
      existing.lastError = undefined;
      this.keyHealth.set(id, existing);
    }
  }

  /**
   * Unban all models and keys across the system
   */
  public unbanAll(): void {
    this.resetAllQuarantines();
  }

  /**
   * Reset all quarantines and return total count of reset entries
   */
  public resetAllQuarantines(): number {
    let count = 0;
    this.modelHealth.forEach((entry) => {
      if (entry.quarantineUntil > 0 || entry.quarantineLevel > 0) count++;
      entry.consecutiveFailures = 0;
      entry.quarantineLevel = 0;
      entry.quarantineUntil = 0;
      entry.lastError = undefined;
    });

    this.keyHealth.forEach((entry) => {
      if (entry.quarantineUntil > 0 || entry.quarantineLevel > 0) count++;
      entry.consecutiveFailures = 0;
      entry.quarantineLevel = 0;
      entry.quarantineUntil = 0;
      entry.lastError = undefined;
    });

    return count;
  }

  /**
   * Returns a complete live health snapshot for all models and keys
   */
  public getHealthSummary() {
    const now = Date.now();
    const models: Record<string, any> = {};
    const keys: Record<string, any> = {};

    this.modelHealth.forEach((entry, id) => {
      const isQuarantined = entry.quarantineUntil > now;
      const remainingMs = isQuarantined ? entry.quarantineUntil - now : 0;
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);

      models[id] = {
        id: entry.id,
        providerId: entry.providerId,
        model: entry.targetName,
        quarantined: isQuarantined,
        quarantineLevel: entry.quarantineLevel,
        remainingMs,
        remainingFormatted: isQuarantined ? (minutes > 0 ? `${minutes}د و ${seconds}ث` : `${seconds}ث`) : "",
        consecutiveFailures: entry.consecutiveFailures,
        totalFailures: entry.totalFailures,
        totalSuccesses: entry.totalSuccesses,
        lastError: entry.lastError,
      };
    });

    this.keyHealth.forEach((entry, id) => {
      const isQuarantined = entry.quarantineUntil > now;
      const remainingMs = isQuarantined ? entry.quarantineUntil - now : 0;
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);

      keys[id] = {
        id: entry.id,
        providerId: entry.providerId,
        keyMask: entry.targetName,
        quarantined: isQuarantined,
        quarantineLevel: entry.quarantineLevel,
        remainingMs,
        remainingFormatted: isQuarantined ? (minutes > 0 ? `${minutes}د و ${seconds}ث` : `${seconds}ث`) : "",
        consecutiveFailures: entry.consecutiveFailures,
        totalFailures: entry.totalFailures,
        totalSuccesses: entry.totalSuccesses,
        lastError: entry.lastError,
      };
    });

    return {
      timestamp: now,
      models,
      keys,
      threshold: FAILURE_THRESHOLD,
      durationsMinutes: [0, 3, 15, 60, 360],
    };
  }
}

// Global Singleton Instance
export const healthManager = new HealthManagerService();
