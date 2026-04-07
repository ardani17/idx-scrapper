// Syariah Routes — IDX Syariah
// GET /api/syariah/products     — Daftar saham syariah
// GET /api/syariah/index        — Indeks syariah (JII, ISSI, dll)
// GET /api/syariah/transaction  — Transaksi sesuai syariah

import { Elysia } from 'elysia';
import { SyariahProductsClient } from '../../clients/syariah/products';
import { SyariahIndexClient } from '../../clients/syariah/index';
import { SyariahTransactionClient } from '../../clients/syariah/transaction';
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

export function syariahRoutes() {
  const products = new SyariahProductsClient();
  const index = new SyariahIndexClient();
  const transaction = new SyariahTransactionClient();

  return new Elysia({ prefix: '/syariah' })

    // ── Daftar Saham Syariah ─────────────────────
    .get('/products', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/syariah/products',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => products.getSyariahProducts(),
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Syariah'],
        summary: 'Syariah-compliant stocks',
        description: 'List of all syariah-compliant stocks listed on IDX. These stocks meet Islamic finance criteria.',
        security,
        responses: {
          200: { description: 'Syariah stock list', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BRIS', stockName: 'Bank BRISyariah', category: 'Islamic Bank' }], total: 400, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Indeks Syariah ───────────────────────────
    .get('/index', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/syariah/index',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => index.getSyariahIndex(),
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Syariah'],
        summary: 'Syariah indices',
        description: 'IDX syariah indices — JII (Jakarta Islamic Index), ISSI, and other Islamic-compliant indices.',
        security,
        responses: {
          200: { description: 'Syariah index data', content: { 'application/json': { example: { success: true, data: [{ index: 'JII', value: 520.3, change: 5.2, changePct: 1.01 }], total: 5, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Transaksi Sesuai Syariah ─────────────────
    .get('/transaction', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/syariah/transaction',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => transaction.getSyariahTransaction(),
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Syariah'],
        summary: 'Syariah transaction data',
        description: 'Trading volume and value for syariah-compliant securities.',
        security,
        responses: {
          200: { description: 'Syariah transaction data', content: { 'application/json': { example: { success: true, data: [{ date: '2025-01-01', volume: 5000000000, value: 3000000000000 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
