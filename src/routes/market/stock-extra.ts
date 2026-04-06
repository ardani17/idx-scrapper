// Market Routes — Margin, Pre-Open, LP Stocks (Phase 2)
// GET /api/market/margin-stocks
// GET /api/market/pre-open
// GET /api/market/lp-stocks

import { Elysia } from 'elysia';
import type { MarginStocksClient } from '../../clients/market/margin-stocks';
import type { PreOpenStocksClient } from '../../clients/market/pre-open-stocks';
import type { LpStocksClient } from '../../clients/market/lp-stocks';
import { marketCache } from '../../utils/cache';

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
    .get('/margin-stocks', async () => {
      try {
        const cached = marketCache.get('/margin-stocks');
        if (cached) return { ...cached, _cached: true };

        const data = await margin.getMarginStocks();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        marketCache.set('/margin-stocks', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Margin & short selling stocks',
        description: 'List of stocks eligible for margin trading and short selling on IDX.',
        security,
        response: {
          200: { description: 'Margin eligible stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', marginRate: 50, shortSell: true }], total: 100, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Pre-Opening Stocks ───────────────────────
    .get('/pre-open', async () => {
      try {
        const cached = marketCache.get('/pre-open');
        if (cached) return { ...cached, _cached: true };

        const data = await preOpen.getPreOpenStocks();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        marketCache.set('/pre-open', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Pre-opening stocks',
        description: 'Stock prices during pre-opening session (09:00–09:05 WIB).',
        security,
        response: {
          200: { description: 'Pre-opening price data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', preOpenPrice: 5400 }], total: 100, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Liquidity Provider Stocks ────────────────
    .get('/lp-stocks', async () => {
      try {
        const cached = marketCache.get('/lp-stocks');
        if (cached) return { ...cached, _cached: true };

        const data = await lp.getLpStocks();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        marketCache.set('/lp-stocks', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Liquidity provider stocks',
        description: 'List of stocks with designated liquidity providers to ensure market depth.',
        security,
        response: {
          200: { description: 'LP stocks data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', lpName: 'Securities Firm X' }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
