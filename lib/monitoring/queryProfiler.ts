/**
 * SoufTools Database Query Profiler & Latency Tracker
 * Intercepts, benchmarks, and catalogs slow PostgreSQL queries.
 * Server-side only. Zero secrets leaked.
 */

export interface SlowQueryRecord {
  id: string;
  queryName: string;
  durationMs: number;
  thresholdMs: number;
  severity: "normal" | "slow" | "critical";
  timestamp: string;
  caller?: string;
  error?: string;
}

export interface QueryProfilerStats {
  totalQueriesTracked: number;
  slowQueriesCount: number;
  criticalQueriesCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  slowRatePercentage: number;
  recentSlowQueries: SlowQueryRecord[];
}

const SLOW_THRESHOLD_MS = 100;
const CRITICAL_THRESHOLD_MS = 500;
const MAX_STORED_RECORDS = 50;

const slowQueriesBuffer: SlowQueryRecord[] = [];
const durationsWindow: number[] = [];
let totalCount = 0;
let slowCount = 0;
let criticalCount = 0;

/**
 * Wraps any database operation with high-resolution latency profiling
 */
export async function profileQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  caller?: string
): Promise<T> {
  const start = performance.now();
  let errorMsg: string | undefined;

  try {
    return await queryFn();
  } catch (err: any) {
    errorMsg = err?.message || String(err);
    throw err;
  } finally {
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    recordQueryExecution(queryName, durationMs, caller, errorMsg);
  }
}

/**
 * Manually record a query execution time
 */
export function recordQueryExecution(
  queryName: string,
  durationMs: number,
  caller?: string,
  error?: string
) {
  totalCount += 1;
  durationsWindow.push(durationMs);
  if (durationsWindow.length > 500) {
    durationsWindow.shift();
  }

  const isSlow = durationMs >= SLOW_THRESHOLD_MS;
  const isCritical = durationMs >= CRITICAL_THRESHOLD_MS;

  if (isSlow) {
    slowCount += 1;
    if (isCritical) criticalCount += 1;

    const record: SlowQueryRecord = {
      id: `sq_${Math.random().toString(36).substring(2, 9)}`,
      queryName,
      durationMs,
      thresholdMs: SLOW_THRESHOLD_MS,
      severity: isCritical ? "critical" : "slow",
      timestamp: new Date().toISOString(),
      caller,
      error,
    };

    slowQueriesBuffer.unshift(record);
    if (slowQueriesBuffer.length > MAX_STORED_RECORDS) {
      slowQueriesBuffer.pop();
    }
  }
}

/**
 * Retrieves the compiled query performance metrics
 */
export function getQueryProfilerStats(): QueryProfilerStats {
  const len = durationsWindow.length;
  let avg = 0;
  let p95 = 0;

  if (len > 0) {
    const sum = durationsWindow.reduce((a, b) => a + b, 0);
    avg = Math.round((sum / len) * 10) / 10;

    const sorted = [...durationsWindow].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    p95 = sorted[p95Idx] || avg;
  }

  const slowRate = totalCount > 0 ? Math.round((slowCount / totalCount) * 1000) / 10 : 0;

  return {
    totalQueriesTracked: totalCount,
    slowQueriesCount: slowCount,
    criticalQueriesCount: criticalCount,
    avgDurationMs: avg,
    p95DurationMs: p95,
    slowRatePercentage: slowRate,
    recentSlowQueries: [...slowQueriesBuffer],
  };
}

/**
 * Resets query statistics
 */
export function resetQueryProfiler() {
  slowQueriesBuffer.length = 0;
  durationsWindow.length = 0;
  totalCount = 0;
  slowCount = 0;
  criticalCount = 0;
}
