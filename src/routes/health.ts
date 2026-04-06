// Routes — Health + Cookie management

import { Elysia, t } from 'elysia';
import type { CookieManager } from '../clients/cookie-manager';
import type { FileDownloader } from '../downloaders/file-downloader';
import { marketCache, newsCache, slowCache } from '../utils/cache';

export function healthRoutes(cookieManager: CookieManager, downloader: FileDownloader) {
  return new Elysia({ prefix: '' })
    .get('/health', () => ({
      success: true,
      status: 'ok',
      uptime: Math.round(process.uptime()),
      cookie: cookieManager.isValid() ? 'valid' : 'not_set',
      storage: downloader.getStorageDir(),
      cache: {
        market: marketCache.size(),
        news: newsCache.size(),
        slow: slowCache.size(),
      },
      timestamp: new Date().toISOString(),
    }), {
      detail: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'API health status. No authentication required.',
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
      },
    })

    .post('/cookie/refresh', async () => {
      const cookies = await cookieManager.refresh();
      return { success: true, cookieLength: cookies.length };
    }, {
      detail: {
        tags: ['Health'],
        summary: 'Refresh session cookie',
      },
    });
}
