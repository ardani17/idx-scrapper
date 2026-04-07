// Market Routes — Margin, Pre-Open, LP Stocks (Phase 2)
// GET /api/market/margin-stocks
// GET /api/market/pre-open
// GET /api/market/lp-stocks

import { Elysia } from 'elysia';
import type { MarginStocksClient } from '../../clients/market/margin-stocks';
import type { PreOpenStocksClient } from '../../clients/market/pre-open-stocks';
import type { LpStocksClient } from '../../clients/market/lp-stocks';
import { marketCache } from '../../utils/cache';
import { cachedScrape } from '../../utils/cached-scrape';

const MARKET_TTL_MS = 30_000;
const MARKET_MAX_AGE = 30;

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

export function stockExtraRoutes(
  margin: MarginStocksClient,
  preOpen: PreOpenStocksClient,
  lp: LpStocksClient,
) {
  return new Elysia()

    // ── Margin & Short Selling ───────────────────
    .get('/margin-stocks', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/margin-stocks',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => margin.getMarginStocks(),
      });
      set.headers['Cache-Control'] = `max-age=${MARKET_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Margin & short selling stocks',
        description: 'List of stocks eligible for margin trading and short selling on IDX.',
        security,
        responses: {
          200: { description: 'Margin eligible stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', marginRate: 50, shortSell: true }], total: 100, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Pre-Opening Stocks ───────────────────────
    .get('/pre-open', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/pre-open',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => preOpen.getPreOpenStocks(),
      });
      set.headers['Cache-Control'] = `max-age=${MARKET_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Pre-opening stocks',
        description: 'Stock prices during pre-opening session (09:00–09:05 WIB).',
        security,
        responses: {
          200: { description: 'Pre-opening price data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', preOpenPrice: 5400 }], total: 100, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Liquidity Provider Stocks ────────────────
    .get('/lp-stocks', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/lp-stocks',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => lp.getLpStocks(),
      });
      set.headers['Cache-Control'] = `max-age=${MARKET_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Liquidity provider stocks',
        description: 'List of stocks with designated liquidity providers to ensure market depth.',
        security,
        responses: {
          200: { description: 'LP stocks data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', lpName: 'Securities Firm X' }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
