// In-memory cache with TTL support

export interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

export class CacheStore {
  private store = new Map<string, CacheEntry>();
  private defaultTtl: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTtlMs: number = 30_000) {
    this.defaultTtl = defaultTtlMs;
    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  get<T = any>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set(key: string, data: any, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtl;
    this.store.set(key, { data, expiresAt: Date.now() + ttl });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
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

// Pre-defined cache instances with different TTLs
export const marketCache = new CacheStore(30_000);   // 30 seconds
export const newsCache = new CacheStore(5 * 60_000); // 5 minutes
export const slowCache = new CacheStore(15 * 60_000); // 15 minutes for slow endpoints
