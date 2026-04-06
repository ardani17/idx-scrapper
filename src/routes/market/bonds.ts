// Market Routes — Bonds (Phase 3)
// GET /api/market/bond-summary
// GET /api/market/indobex

import { Elysia } from 'elysia';
import type { BondSummaryClient } from '../../clients/market/bond-sukuk';
import type { IndobexClient } from '../../clients/market/indobex';
import { slowCache } from '../../utils/cache';

export function bondsRoutes(
  bond: BondSummaryClient,
  indobex: IndobexClient,
) {
  return new Elysia()

    .get('/bond-summary', async () => {
      try {
        const cached = slowCache.get('/bond-summary');
        if (cached) return { ...cached, _cached: true };

        const data = await bond.getBondSummary();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/bond-summary', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/indobex', async () => {
      try {
        const cached = slowCache.get('/indobex');
        if (cached) return { ...cached, _cached: true };

        const data = await indobex.getIndobex();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/en/market-data/bond-data/indobex/',
          _cached: false,
        };
        slowCache.set('/indobex', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    });
}
