// Routes — Health + Cookie management
// Requirements: 7.1, 7.2, 7.3, 7.6

import { Elysia, t } from 'elysia';
import type { CookieManager } from '../clients/cookie-manager';
import type { FileDownloader } from '../downloaders/file-downloader';
import { marketCache, newsCache, slowCache } from '../utils/cache';
import { browserManager } from '../utils/browser';
import { logger } from '../utils/logger';

export function healthRoutes(cookieManager: CookieManager, downloader: FileDownloader) {
  return new Elysia({ prefix: '' })
    .get('/health', async () => {
      const startTime = Date.now();

      const browserConnected = browserManager.isConnected();
      const activePages = browserManager.getActivePagesCount();

      // Redis status: check any cache instance (they all share the same Redis)
      const redisConnected = marketCache.isRedisConnected();
      const redisStatus: 'connected' | 'disconnected' | 'fallback' = redisConnected
        ? 'connected'
        : 'fallback'; // fallback = using in-memory cache

      // Cache sizes per tier
      const [marketSize, newsSize, slowSize] = await Promise.all([
        marketCache.size(),
        newsCache.size(),
        slowCache.size(),
      ]);

      // Memory usage
      const mem = process.memoryUsage();

      // Overall status: degraded if browser disconnected
      const status = browserConnected ? 'ok' : 'degraded';

      const responseTimeMs = Date.now() - startTime;
      if (responseTimeMs > 30_000) {
        logger.warn('Slow health check', { responseTimeMs });
      }

      return {
        success: true as const,
        status,
        uptime: Math.round(process.uptime()),
        browser: {
          status: browserConnected ? 'connected' as const : 'disconnected' as const,
          activePages,
        },
        redis: {
          status: redisStatus,
        },
        cache: {
          market: marketSize,
          news: newsSize,
          slow: slowSize,
        },
        memory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
        timestamp: new Date().toISOString(),
      };
    }, {
      detail: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns system health status including uptime, browser status, Redis status, cache sizes, and memory usage. No authentication required.',
        responses: {
          200: { description: 'System health status', content: { 'application/json': { example: { success: true, status: 'ok', uptime: 3600, browser: { status: 'connected', activePages: 2 }, redis: { status: 'connected' }, cache: { market: 15, news: 8, slow: 5 }, memory: { rss: 150000000, heapUsed: 80000000, heapTotal: 120000000 }, timestamp: '2025-01-01T00:00:00.000Z' } } } },
          503: { description: 'Service degraded — browser disconnected or Redis unavailable' },
        },
      },
    })

    .get('/cookie/status', () => {
      const s = cookieManager.getStatus();
      return {
        valid: s.valid,
        updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
        expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
        remainingMin: Math.round(s.remainingMs / 60000),
      };
    }, {
      detail: {
        tags: ['Health'],
        summary: 'Cookie status',
        description: 'Check the current IDX session cookie status — validity, expiry time, and remaining minutes.',
        responses: {
          200: { description: 'Cookie status', content: { 'application/json': { example: { valid: true, updatedAt: '2025-01-01T00:00:00.000Z', expiresAt: '2025-01-01T01:00:00.000Z', remainingMin: 45 } } } },
        },
      },
    })

    .post('/cookie/set', async ({ body }) => {
      cookieManager.setCookies(body.cookies);
      return { success: true };
    }, {
      body: t.Object({ cookies: t.String() }),
      detail: {
        tags: ['Health'],
        summary: 'Set session cookie',
        description: 'Manually set the IDX session cookie string. Used when automatic cookie refresh fails.',
        responses: {
          200: { description: 'Cookie set successfully', content: { 'application/json': { example: { success: true } } } },
          400: { description: 'Invalid request body' },
        },
      },
    })

    .post('/cookie/refresh', async () => {
      const cookies = await cookieManager.refresh();
      return { success: true, cookieLength: cookies.length };
    }, {
      detail: {
        tags: ['Health'],
        summary: 'Refresh session cookie',
        description: 'Trigger an automatic refresh of the IDX session cookie via Playwright browser.',
        responses: {
          200: { description: 'Cookie refreshed', content: { 'application/json': { example: { success: true, cookieLength: 256 } } } },
          503: { description: 'Browser unavailable — cannot refresh cookie' },
        },
      },
    });
}
