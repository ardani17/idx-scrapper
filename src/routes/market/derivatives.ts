// Market Routes — Derivatives & ETF (Phase 3)
// GET /api/market/derivatives
// GET /api/market/etf-list
// GET /api/market/etf-inav

import { Elysia } from 'elysia';
import type { DerivativesClient } from '../../clients/market/derivatives';
import type { EtfClient } from '../../clients/market/etf';
import { marketCache } from '../../utils/cache';

export function derivativesRoutes(derivatives: DerivativesClient, etf: EtfClient) {
  return new Elysia()

    .get('/derivatives', async () => {
      try {
        const cached = marketCache.get('/derivatives');
        if (cached) return { ...cached, _cached: true };

        const data = await derivatives.getDerivativeSummary();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        marketCache.set('/derivatives', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/etf-list', async () => {
      try {
        const cached = marketCache.get('/etf-list');
        if (cached) return { ...cached, _cached: true };

        const data = await etf.getEtfList();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        marketCache.set('/etf-list', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/etf-inav', async () => {
      try {
        const cached = marketCache.get('/etf-inav');
        if (cached) return { ...cached, _cached: true };

        const data = await etf.getEtfInav();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        marketCache.set('/etf-inav', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    });
}
