// cachedScrape — Shared utility to eliminate try-catch-cache duplication
// Requirements: 10.1

import type { ICacheStore } from './cache';
import { logger } from './logger';

/**
 * Options for the cachedScrape utility function.
 */
export interface CachedScrapeOptions<T> {
  /** Cache store instance (marketCache, newsCache, slowCache, etc.) */
  cache: ICacheStore;
  /** Unique cache key for this scrape result */
  cacheKey: string;
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Async function that performs the actual scraping */
  scraper: () => Promise<T>;
  /** Request ID for structured logging / tracing */
  requestId: string;
}

/**
 * Result returned by cachedScrape.
 */
export interface CachedScrapeResult<T> {
  data: T;
  cached: boolean;
}

/**
 * Generic cache-then-scrape utility.
 *
 * 1. Check cache — if hit, return `{ data, cached: true }`
 * 2. If miss, run the `scraper` function
 * 3. Store the result in cache with the given TTL
 * 4. Return `{ data, cached: false }`
 *
 * Scraping errors are logged with the requestId and re-thrown so the
 * global error handler can classify them (Cloudflare timeout, HTML
 * parsing, browser launch failure, etc.).
 */
export async function cachedScrape<T>(
  options: CachedScrapeOptions<T>,
): Promise<CachedScrapeResult<T>> {
  const { cache, cacheKey, ttlMs, scraper, requestId } = options;

  // 1. Check cache
  const cached = await cache.get<T>(cacheKey);
  if (cached !== null) {
    logger.debug('Cache hit', { requestId, cacheKey });
    return { data: cached, cached: true };
  }

  // 2. Cache miss — run scraper
  try {
    const data = await scraper();

    // 3. Store in cache
    await cache.set(cacheKey, data, ttlMs);

    logger.debug('Cache miss, scraped and stored', { requestId, cacheKey });
    return { data, cached: false };
  } catch (error) {
    // 4. Log with requestId and re-throw for the global error handler
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Scraping failed', {
      requestId,
      cacheKey,
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}
