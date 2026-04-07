// Market Route — Stock List (Phase 2)
// GET /api/market/stock-list

import { Elysia } from 'elysia';
import type { StockListClient } from '../../clients/market/stock-list';
import { slowCache } from '../../utils/cache';
import { cachedScrape } from '../../utils/cached-scrape';

const SLOW_TTL_MS = 900_000;
const SLOW_MAX_AGE = 900;

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

export function stockListRoute(stockList: StockListClient) {
  return new Elysia()

    // ── Stock List (Full Listed) ─────────────────
    .get('/stock-list', async ({ query, set }: { query: { type?: string; page?: string; pageSize?: string }; set: any }) => {
      const type = query.type || 'shares';
      const page = parseInt(query.page || '1', 10);
      const pageSize = parseInt(query.pageSize || '500', 10);
      const cacheKey = `/stock-list-${type}-${page}-${pageSize}`;

      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey,
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: async () => {
          const result = await stockList.getStockList(type, page, pageSize);
          return { items: result.data, total: result.total, page: result.page };
        },
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true,
        data: data.items,
        total: data.total,
        page: data.page,
        pageSize,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/',
        _cached: cached,
      };
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Stock list (paginated)',
        description: 'Full list of listed securities on IDX with pagination. Supports filtering by type (shares, bonds, ETF, etc.).',
        security,
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', default: 'shares' }, description: 'Security type filter (shares, bonds, etf, etc.)' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 500 }, description: 'Items per page (max 500)' },
        ],
        responses: {
          200: { description: 'Paginated stock list', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', listingDate: '2003-11-10', board: 'Main' }], total: 800, page: 1, pageSize: 500, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
