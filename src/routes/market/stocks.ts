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
    });
}
