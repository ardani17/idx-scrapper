// Simple in-memory rate limiter (sliding window per IP)

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests: number = 60, windowMs: number = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.cleanupInterval.unref();
  }

  /**
   * Check if a request is allowed.
   * @returns { allowed, remaining, resetAt }
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();

    let entry = this.store.get(key);
    if (!entry || (now - entry.windowStart) >= this.windowMs) {
      // New window
      entry = { count: 0, windowStart: now };
      this.store.set(key, entry);
    }

    entry.count++;
    const resetAt = entry.windowStart + this.windowMs;
    const remaining = Math.max(0, this.maxRequests - entry.count);

    return {
      allowed: entry.count <= this.maxRequests,
      remaining,
      resetAt,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if ((now - entry.windowStart) >= this.windowMs) this.store.delete(key);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}
