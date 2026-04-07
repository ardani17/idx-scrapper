// Market Routes — Index Summary
// GET /api/market/index-summary

import { Elysia } from 'elysia';
import type { IndexSummaryClient } from '../../clients/market/index-summary';
import { marketCache } from '../../utils/cache';
import { cachedScrape } from '../../utils/cached-scrape';

const MARKET_TTL_MS = 30_000;
const MARKET_MAX_AGE = 30;

export function indicesRoutes(index: IndexSummaryClient) {
  return new Elysia()

    // ── Index Summary (Daftar Indeks) ────────────
    .get('/index-summary', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/index-summary',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => index.getIndexList(),
      });
      set.headers['Cache-Control'] = `max-age=${MARKET_MAX_AGE}`;
      return {
        success: true,
        data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/',
        _cached: cached,
      };
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Index summary',
        description: 'List of all IDX indices (IHSG, LQ45, JII, etc.) with current value, change, and percentage.',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          200: { description: 'Index list with current prices', content: { 'application/json': { example: { success: true, data: [{ index: 'IHSG', value: 7200.5, change: 50.3, changePct: 0.7 }], total: 1, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
        },
      },
    });
}
