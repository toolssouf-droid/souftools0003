/**
 * Outbound Request Dispatcher & Micro-Jitter Queue for SoufAI
 * Smooths outbound API traffic to prevent server IP rate limits, burst flags,
 * and WAF bot detection, while maintaining fast response times.
 */

interface QueuedTask<T> {
  id: string;
  providerId: string;
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  enqueuedAt: number;
}

class RequestDispatcher {
  private activeCounts: Record<string, number> = {};
  private lastRequestTime: Record<string, number> = {};
  private queues: Record<string, QueuedTask<any>[]> = {};
  
  // Concurrency and jitter configuration
  private maxConcurrentPerProvider = 6;
  private minIntervalMs = 70; // Minimum gap between consecutive dispatches to same provider
  private maxJitterMs = 80;   // Randomized human-like jitter: 0ms - 80ms

  // Telemetry metrics
  private totalDispatched = 0;
  private totalQueued = 0;
  private totalJitterAppliedMs = 0;

  /**
   * Enqueues and executes an API operation with concurrency limits and micro-jitter
   */
  public async dispatch<T>(providerId: string, task: () => Promise<T>): Promise<T> {
    const prov = providerId.toLowerCase();
    this.totalQueued++;

    return new Promise<T>((resolve, reject) => {
      const item: QueuedTask<T> = {
        id: Math.random().toString(36).substring(2, 9),
        providerId: prov,
        run: task,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      if (!this.queues[prov]) {
        this.queues[prov] = [];
      }
      this.queues[prov].push(item);

      this.processQueue(prov);
    });
  }

  /**
   * Processes queued requests for a specific provider
   */
  private async processQueue(providerId: string): Promise<void> {
    const queue = this.queues[providerId];
    if (!queue || queue.length === 0) return;

    const currentActive = this.activeCounts[providerId] || 0;
    if (currentActive >= this.maxConcurrentPerProvider) {
      return; // Wait for active requests to finish
    }

    const nextTask = queue.shift();
    if (!nextTask) return;

    this.activeCounts[providerId] = (this.activeCounts[providerId] || 0) + 1;

    // Calculate micro-jitter and time-pacing
    const now = Date.now();
    const lastTime = this.lastRequestTime[providerId] || 0;
    const elapsedSinceLast = now - lastTime;
    
    // Random human-like jitter between 30ms and maxJitterMs
    const jitter = Math.floor(Math.random() * this.maxJitterMs) + 30;
    const targetGap = this.minIntervalMs + jitter;
    const requiredWait = Math.max(0, targetGap - elapsedSinceLast);

    if (requiredWait > 0) {
      this.totalJitterAppliedMs += requiredWait;
      await new Promise((r) => setTimeout(r, requiredWait));
    }

    this.lastRequestTime[providerId] = Date.now();
    this.totalDispatched++;

    try {
      const result = await nextTask.run();
      nextTask.resolve(result);
    } catch (err) {
      nextTask.reject(err);
    } finally {
      this.activeCounts[providerId] = Math.max(0, (this.activeCounts[providerId] || 1) - 1);
      // Process next item in queue if available
      setImmediate(() => this.processQueue(providerId));
    }
  }

  /**
   * Returns live traffic smoothing telemetry
   */
  public getStats() {
    let pendingInQueues = 0;
    for (const p of Object.keys(this.queues)) {
      pendingInQueues += this.queues[p].length;
    }

    let activeRunning = 0;
    for (const p of Object.keys(this.activeCounts)) {
      activeRunning += this.activeCounts[p];
    }

    return {
      totalDispatched: this.totalDispatched,
      totalQueued: this.totalQueued,
      currentlyActive: activeRunning,
      pendingQueueLength: pendingInQueues,
      averageJitterMs: this.totalDispatched > 0 
        ? Math.round(this.totalJitterAppliedMs / this.totalDispatched) 
        : 0,
      concurrencyLimit: this.maxConcurrentPerProvider,
      egressMode: process.env.EGRESS_GATEWAY_URL ? "Custom Gateway" : "In-Memory Paced",
    };
  }
}

export const requestDispatcher = new RequestDispatcher();
