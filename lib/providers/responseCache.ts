/**
 * Response Cache for SoufAI
 * High-speed in-memory cache for prompt responses to reduce outbound network requests,
 * save provider quota, and protect the server IP from repeated burst traffic.
 */

interface CacheEntry {
  response: string;
  model: string;
  providerId: string;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

class ResponseCacheManager {
  private cache = new Map<string, CacheEntry>();
  private maxEntries = 800;
  private defaultTtlMs = 10 * 60 * 1000; // 10 minutes
  private hitsCount = 0;
  private missesCount = 0;

  /**
   * Generates a deterministic cache key from prompt parameters
   */
  public generateKey(modelId: string, prompt: string, systemInstruction?: string, attachmentsCount = 0): string {
    const cleanPrompt = prompt.trim().toLowerCase().replace(/\s+/g, " ");
    const cleanSys = (systemInstruction || "").trim().toLowerCase();
    return `${modelId}::${cleanSys}::att${attachmentsCount}::${cleanPrompt}`;
  }

  /**
   * Checks if a prompt is real-time or dynamic (should not be cached)
   */
  public isCacheable(prompt: string, attachmentsCount = 0): boolean {
    if (attachmentsCount > 0) return false; // files/images may be context-sensitive
    if (!prompt || prompt.length < 5) return false;
    if (prompt.length > 4000) return false; // very long inputs are usually unique

    // Skip time-sensitive or dynamic queries
    const lower = prompt.toLowerCase();
    const dynamicKeywords = [
      "الوقت", "الساعة", "اليوم", "تاريخ اليوم", "الطقس", "الأخبار", 
      "current time", "today", "now", "weather", "news", "random", "عشوائي"
    ];
    for (const kw of dynamicKeywords) {
      if (lower.includes(kw)) return false;
    }

    return true;
  }

  /**
   * Get cached response if valid and not expired
   */
  public get(key: string): { response: string; model: string; providerId: string; hits: number } | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missesCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.missesCount++;
      return null;
    }

    entry.hits++;
    this.hitsCount++;
    return {
      response: entry.response,
      model: entry.model,
      providerId: entry.providerId,
      hits: entry.hits,
    };
  }

  /**
   * Store response in cache
   */
  public set(key: string, response: string, model: string, providerId: string, ttlMs?: number): void {
    if (!response || response.trim().length === 0) return;

    // LRU eviction if full
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const ttl = ttlMs || this.defaultTtlMs;
    const now = Date.now();

    this.cache.set(key, {
      response,
      model,
      providerId,
      createdAt: now,
      expiresAt: now + ttl,
      hits: 0,
    });
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get telemetry stats for dashboard
   */
  public getStats() {
    const totalRequests = this.hitsCount + this.missesCount;
    const hitRate = totalRequests > 0 ? ((this.hitsCount / totalRequests) * 100).toFixed(1) + "%" : "0%";

    return {
      totalEntries: this.cache.size,
      maxEntries: this.maxEntries,
      hitsCount: this.hitsCount,
      missesCount: this.missesCount,
      hitRate,
      savedOutboundCalls: this.hitsCount,
    };
  }
}

export const responseCache = new ResponseCacheManager();
