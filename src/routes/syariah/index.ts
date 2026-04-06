// Syariah Routes — IDX Syariah
// GET /api/syariah/products     — Daftar saham syariah
// GET /api/syariah/index        — Indeks syariah (JII, ISSI, dll)
// GET /api/syariah/transaction  — Transaksi sesuai syariah

import { Elysia } from 'elysia';
import { SyariahProductsClient } from '../../clients/syariah/products';
import { SyariahIndexClient } from '../../clients/syariah/index';
import { SyariahTransactionClient } from '../../clients/syariah/transaction';
import { slowCache } from '../../utils/cache';

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
    .get('/products', async () => {
      try {
        const cached = slowCache.get('/syariah/products');
        if (cached) return { ...cached, _cached: true };

        const data = await products.getSyariahProducts();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/syariah/products', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
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
    .get('/index', async () => {
      try {
        const cached = slowCache.get('/syariah/index');
        if (cached) return { ...cached, _cached: true };

        const data = await index.getSyariahIndex();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/syariah/index', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
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
    .get('/transaction', async () => {
      try {
        const cached = slowCache.get('/syariah/transaction');
        if (cached) return { ...cached, _cached: true };

        const data = await transaction.getSyariahTransaction();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/syariah/transaction', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
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
