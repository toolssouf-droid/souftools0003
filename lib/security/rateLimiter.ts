/**
 * SoufTools High-Performance Server-Side Rate Limiter
 * Token-bucket & sliding window algorithm to protect endpoints from abuse.
 */

interface RateLimitRecord {
  tokens: number;
  lastRefill: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  identifier: string,
  capacity = 60, // Max tokens
  refillPerMinute = 60 // Refill tokens per minute
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  let record = rateLimitMap.get(identifier);

  if (!record) {
    record = { tokens: capacity, lastRefill: now };
    rateLimitMap.set(identifier, record);
  }

  // Refill calculation
  const elapsedMinutes = (now - record.lastRefill) / 60000;
  record.tokens = Math.min(capacity, record.tokens + elapsedMinutes * refillPerMinute);
  record.lastRefill = now;

  if (record.tokens >= 1) {
    record.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(record.tokens),
      retryAfterSeconds: 0,
    };
  }

  const missingTokens = 1 - record.tokens;
  const retryAfterSeconds = Math.ceil((missingTokens / refillPerMinute) * 60);

  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds,
  };
}
