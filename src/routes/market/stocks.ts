// Market Routes — Stock Summary, Top Movers & Suspend
// GET /api/market/stock-summary
// GET /api/market/top-gainer
// GET /api/market/top-loser
// GET /api/market/top-volume
// GET /api/market/top-value
// GET /api/market/top-frequent
// GET /api/market/suspend

import { Elysia } from 'elysia';
import type { StockSummaryClient } from '../../clients/market/stock-summary';
import type { SuspendDataClient } from '../../clients/market/suspend-data';
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

export function stocksRoutes(
  stock: StockSummaryClient,
  suspend: SuspendDataClient,
) {
  return new Elysia()

    // ── Stock Summary (Semua Saham) ─────────────
    .get('/stock-summary', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/stock-summary',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => stock.getStockSummary(),
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
        tags: ['Market'], summary: 'Stock summary',
        description: 'Complete list of all traded stocks with current price, change, volume, value, and frequency.',
        security,
        responses: {
          200: { description: 'All stock data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', lastPrice: 5425, change: 25, changePct: 0.46, volume: 120000000, value: 650000000000 }], total: 800, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Gainer ───────────────────────────────
    .get('/top-gainer', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/top-gainer',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => stock.getTopMover('TopGainer'),
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
        tags: ['Market'], summary: 'Top gainers',
        description: 'Stocks with the highest price increase today, sorted by percentage gain.',
        security,
        responses: {
          200: { description: 'Top gainer stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'MDKA', stockName: 'Merdeka Copper Gold', lastPrice: 4200, change: 380, changePct: 9.95 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Loser ────────────────────────────────
    .get('/top-loser', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/top-loser',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => stock.getTopMover('TopLoser'),
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
        tags: ['Market'], summary: 'Top losers',
        description: 'Stocks with the highest price decrease today, sorted by percentage drop.',
        security,
        responses: {
          200: { description: 'Top loser stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'EXCL', stockName: 'XL Axiata', lastPrice: 2100, change: -225, changePct: -9.68 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Volume ───────────────────────────────
    .get('/top-volume', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/top-volume',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => stock.getTopMover('TopVolume'),
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
        tags: ['Market'], summary: 'Top volume',
        description: 'Most actively traded stocks by volume (number of shares).',
        security,
        responses: {
          200: { description: 'Top volume stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', volume: 500000000 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Value ────────────────────────────────
    .get('/top-value', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/top-value',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => stock.getTopMover('TopValue'),
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
        tags: ['Market'], summary: 'Top value',
        description: 'Most actively traded stocks by transaction value (in IDR).',
        security,
        responses: {
          200: { description: 'Top value stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', value: 2500000000000 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Frequent ─────────────────────────────
    .get('/top-frequent', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/top-frequent',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => stock.getTopMover('TopFrequent'),
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
        tags: ['Market'], summary: 'Top frequent',
        description: 'Most frequently traded stocks by number of transactions.',
        security,
        responses: {
          200: { description: 'Top frequent stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBCA', stockName: 'Bank Central Asia', frequency: 25000 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Suspend Data ─────────────────────────────
    .get('/suspend', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: marketCache,
        cacheKey: '/suspend',
        ttlMs: MARKET_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => suspend.getSuspendData(),
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
        tags: ['Market'], summary: 'Suspended stocks',
        description: 'List of currently suspended stocks with suspension reason and date.',
        security,
        responses: {
          200: { description: 'Suspended stocks data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'GJTL', stockName: 'Gajah Tunggal', suspendInfo: 'Penghentian Sementara' }], total: 5, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
