// Market Routes — Margin, Pre-Open, LP Stocks (Phase 2)
// GET /api/market/margin-stocks
// GET /api/market/pre-open
// GET /api/market/lp-stocks

import { Elysia } from 'elysia';
import type { MarginStocksClient } from '../../clients/market/margin-stocks';
import type { PreOpenStocksClient } from '../../clients/market/pre-open-stocks';
import type { LpStocksClient } from '../../clients/market/lp-stocks';
import { marketCache } from '../../utils/cache';

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
    });
}
