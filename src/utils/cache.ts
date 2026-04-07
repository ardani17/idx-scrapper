// CacheStore — Redis backend with in-memory Map fallback
// Requirements: 6.1, 6.2, 6.3, 6.4

import Redis from 'ioredis';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ICacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, data: unknown, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
  destroy(): Promise<void>;
  isRedisConnected(): boolean;
}

// ---------------------------------------------------------------------------
// In-memory fallback entry
// ---------------------------------------------------------------------------

interface MemoryEntry {
  data: string; // JSON-serialised
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'idx:';
const RECONNECT_INTERVAL_MS = 30_000;

function buildRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = process.env.REDIS_PORT ?? '6379';
  return `redis://${host}:${port}`;
}

// ---------------------------------------------------------------------------
// CacheStore implementation
// ---------------------------------------------------------------------------

export class CacheStore implements ICacheStore {
  private redis: Redis | null = null;
  private redisConnected = false;
  private fallbackStore = new Map<string, MemoryEntry>();
  private defaultTtlMs: number;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(defaultTtlMs: number = 30_000) {
    this.defaultTtlMs = defaultTtlMs;
    this.initRedis();

    // Periodic cleanup for in-memory fallback (every 60 s)
    this.cleanupInterval = setInterval(() => this.cleanupMemory(), 60_000);
    this.cleanupInterval.unref();
  }

  // ── Redis bootstrap ─────────────────────────────────────────────────────

  private initRedis(): void {
    try {
      const url = buildRedisUrl();
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,       // we handle reconnect ourselves
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.redis.on('connect', () => {
        this.redisConnected = true;
        this.stopReconnectTimer();
        logger.info('Redis connected', { url: this.sanitiseUrl(url) });
      });

      this.redis.on('error', (err) => {
        if (this.redisConnected) {
          logger.warn('Redis connection lost, falling back to in-memory cache', {
            error: err.message,
          });
        }
        this.redisConnected = false;
        this.startReconnectTimer();
      });

      this.redis.on('close', () => {
        if (this.redisConnected) {
          logger.warn('Redis connection closed, falling back to in-memory cache');
        }
        this.redisConnected = false;
        this.startReconnectTimer();
      });

      // Attempt initial connection
      this.redis.connect().catch(() => {
        logger.warn('Redis unavailable at startup, using in-memory fallback');
        this.redisConnected = false;
        this.startReconnectTimer();
      });
    } catch {
      logger.warn('Failed to initialise Redis client, using in-memory fallback');
      this.redis = null;
      this.redisConnected = false;
      this.startReconnectTimer();
    }
  }

  // ── Reconnect logic ─────────────────────────────────────────────────────

  private startReconnectTimer(): void {
    if (this.reconnectTimer || this.destroyed) return;
    this.reconnectTimer = setInterval(() => this.attemptReconnect(), RECONNECT_INTERVAL_MS);
    this.reconnectTimer.unref();
  }

  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.redisConnected || this.destroyed) {
      this.stopReconnectTimer();
      return;
    }
    try {
      if (this.redis) {
        // Disconnect old instance cleanly before reconnecting
        try { this.redis.disconnect(false); } catch { /* ignore */ }
      }
      const url = buildRedisUrl();
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.redis.on('connect', () => {
        this.redisConnected = true;
        this.stopReconnectTimer();
        logger.info('Redis reconnected');
      });

      this.redis.on('error', () => {
        this.redisConnected = false;
      });

      this.redis.on('close', () => {
        this.redisConnected = false;
        this.startReconnectTimer();
      });

      await this.redis.connect();
    } catch {
      logger.warn('Redis reconnect attempt failed, will retry in 30s');
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const prefixed = KEY_PREFIX + key;

    if (this.redisConnected && this.redis) {
      try {
        const raw = await this.redis.get(prefixed);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        // fall through to memory
      }
    }

    // In-memory fallback
    const entry = this.fallbackStore.get(prefixed);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.fallbackStore.delete(prefixed);
      return null;
    }
    return JSON.parse(entry.data) as T;
  }

  async set(key: string, data: unknown, ttlMs?: number): Promise<void> {
    const prefixed = KEY_PREFIX + key;
    const ttl = ttlMs ?? this.defaultTtlMs;
    const serialised = JSON.stringify(data);

    if (this.redisConnected && this.redis) {
      try {
        // PX = milliseconds expiry
        await this.redis.set(prefixed, serialised, 'PX', ttl);
        return;
      } catch {
        // fall through to memory
      }
    }

    // In-memory fallback
    this.fallbackStore.set(prefixed, {
      data: serialised,
      expiresAt: Date.now() + ttl,
    });
  }

  async del(key: string): Promise<void> {
    const prefixed = KEY_PREFIX + key;

    if (this.redisConnected && this.redis) {
      try {
        await this.redis.del(prefixed);
      } catch { /* ignore */ }
    }

    this.fallbackStore.delete(prefixed);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async clear(): Promise<void> {
    if (this.redisConnected && this.redis) {
      try {
        // Scan and delete only our prefixed keys
        let cursor = '0';
        do {
          const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 100);
          cursor = next;
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch { /* ignore */ }
    }

    this.fallbackStore.clear();
  }

  async size(): Promise<number> {
    if (this.redisConnected && this.redis) {
      try {
        let count = 0;
        let cursor = '0';
        do {
          const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 100);
          cursor = next;
          count += keys.length;
        } while (cursor !== '0');
        return count;
      } catch { /* ignore */ }
    }

    // Fallback: count non-expired entries
    const now = Date.now();
    let count = 0;
    for (const [, entry] of this.fallbackStore) {
      if (now <= entry.expiresAt) count++;
    }
    return count;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.stopReconnectTimer();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.redis) {
      try {
        this.redis.disconnect(false);
      } catch { /* ignore */ }
      this.redis = null;
    }

    this.redisConnected = false;
    this.fallbackStore.clear();
  }

  isRedisConnected(): boolean {
    return this.redisConnected;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private cleanupMemory(): void {
    const now = Date.now();
    for (const [key, entry] of this.fallbackStore) {
      if (now > entry.expiresAt) this.fallbackStore.delete(key);
    }
  }

  private sanitiseUrl(url: string): string {
    try {
      const u = new URL(url);
      if (u.password) u.password = '***';
      return u.toString();
    } catch {
      return url;
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-defined cache instances with different TTLs
// ---------------------------------------------------------------------------

export const marketCache = new CacheStore(30_000);        // 30 seconds
export const newsCache   = new CacheStore(5 * 60_000);    // 5 minutes
export const slowCache   = new CacheStore(15 * 60_000);   // 15 minutes
