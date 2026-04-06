// Market Routes — Index Summary
// GET /api/market/index-summary

import { Elysia } from 'elysia';
import type { IndexSummaryClient } from '../../clients/market/index-summary';
import { marketCache } from '../../utils/cache';

export function indicesRoutes(index: IndexSummaryClient) {
  return new Elysia()

    // ── Index Summary (Daftar Indeks) ────────────
    .get('/index-summary', async () => {
      try {
        const cached = marketCache.get('/index-summary');
        if (cached) return { ...cached, _cached: true };

        const data = await index.getIndexList();
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/index-summary', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
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
        },
      },
    });
}
