// Market Route — Stock List (Phase 2)
// GET /api/market/stock-list

import { Elysia } from 'elysia';
import type { StockListClient } from '../../clients/market/stock-list';
import { slowCache } from '../../utils/cache';

export function stockListRoute(stockList: StockListClient) {
  return new Elysia()

    // ── Stock List (Full Listed) ─────────────────
    .get('/stock-list', async ({ query }: { query: { type?: string; page?: string; pageSize?: string } }) => {
      try {
        const type = query.type || 'shares';
        const page = parseInt(query.page || '1', 10);
        const pageSize = parseInt(query.pageSize || '500', 10);

        const cacheKey = `/stock-list-${type}-${page}-${pageSize}`;
        const cached = slowCache.get(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const result = await stockList.getStockList(type, page, pageSize);
        const response = {
          success: true,
          data: result.data,
          total: result.total,
          page: result.page,
          pageSize,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        slowCache.set(cacheKey, response);
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    });
}
