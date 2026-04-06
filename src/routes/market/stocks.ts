// Market Routes — Stock Summary, Top Movers & Suspend
// GET /api/market/stock-summary
// GET /api/market/top-gainer
// GET /api/market/top-loser
// GET /api/market/top-volume
// GET /api/market/top-value
// GET /api/market/top-frequent
// GET /api/market/suspend

import { Elysia } from 'elysia';
import type { StockSummaryClient, TopMoverType } from '../../clients/market/stock-summary';
import type { SuspendDataClient } from '../../clients/market/suspend-data';
import { marketCache } from '../../utils/cache';

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
    .get('/stock-summary', async () => {
      try {
        const cached = marketCache.get('/stock-summary');
        if (cached) return { ...cached, _cached: true };

        const data = await stock.getStockSummary();
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/stock-summary', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Stock summary',
        description: 'Complete list of all traded stocks with current price, change, volume, value, and frequency.',
        security,
        responses: {
          200: { description: 'All stock data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', lastPrice: 5425, change: 25, changePct: 0.46, volume: 120000000, value: 650000000000 }], total: 800, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Gainer ───────────────────────────────
    .get('/top-gainer', async () => {
      try {
        const cached = marketCache.get('/top-gainer');
        if (cached) return { ...cached, _cached: true };

        const data = await stock.getTopMover('TopGainer');
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/top-gainer', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Top gainers',
        description: 'Stocks with the highest price increase today, sorted by percentage gain.',
        security,
        responses: {
          200: { description: 'Top gainer stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'MDKA', stockName: 'Merdeka Copper Gold', lastPrice: 4200, change: 380, changePct: 9.95 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Loser ────────────────────────────────
    .get('/top-loser', async () => {
      try {
        const cached = marketCache.get('/top-loser');
        if (cached) return { ...cached, _cached: true };

        const data = await stock.getTopMover('TopLoser');
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/top-loser', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Top losers',
        description: 'Stocks with the highest price decrease today, sorted by percentage drop.',
        security,
        responses: {
          200: { description: 'Top loser stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'EXCL', stockName: 'XL Axiata', lastPrice: 2100, change: -225, changePct: -9.68 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Volume ───────────────────────────────
    .get('/top-volume', async () => {
      try {
        const cached = marketCache.get('/top-volume');
        if (cached) return { ...cached, _cached: true };

        const data = await stock.getTopMover('TopVolume');
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/top-volume', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Top volume',
        description: 'Most actively traded stocks by volume (number of shares).',
        security,
        responses: {
          200: { description: 'Top volume stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', volume: 500000000 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Value ────────────────────────────────
    .get('/top-value', async () => {
      try {
        const cached = marketCache.get('/top-value');
        if (cached) return { ...cached, _cached: true };

        const data = await stock.getTopMover('TopValue');
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/top-value', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Top value',
        description: 'Most actively traded stocks by transaction value (in IDR).',
        security,
        responses: {
          200: { description: 'Top value stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', value: 2500000000000 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Top Frequent ─────────────────────────────
    .get('/top-frequent', async () => {
      try {
        const cached = marketCache.get('/top-frequent');
        if (cached) return { ...cached, _cached: true };

        const data = await stock.getTopMover('TopFrequent');
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/top-frequent', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Top frequent',
        description: 'Most frequently traded stocks by number of transactions.',
        security,
        responses: {
          200: { description: 'Top frequent stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBCA', stockName: 'Bank Central Asia', frequency: 25000 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Suspend Data ─────────────────────────────
    .get('/suspend', async () => {
      try {
        const cached = marketCache.get('/suspend');
        if (cached) return { ...cached, _cached: true };

        const data = await suspend.getSuspendData();
        const result = {
          success: true,
          data,
          total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/suspend', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Suspended stocks',
        description: 'List of currently suspended stocks with suspension reason and date.',
        security,
        responses: {
          200: { description: 'Suspended stocks data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'GJTL', stockName: 'Gajah Tunggal', suspendInfo: 'Penghentian Sementara' }], total: 5, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
