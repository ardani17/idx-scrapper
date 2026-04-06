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
    });
}
