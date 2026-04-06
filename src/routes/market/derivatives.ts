// Market Routes — Derivatives & ETF (Phase 3)
// GET /api/market/derivatives
// GET /api/market/etf-list
// GET /api/market/etf-inav

import { Elysia } from 'elysia';
import type { DerivativesClient } from '../../clients/market/derivatives';
import type { EtfClient } from '../../clients/market/etf';
import { marketCache } from '../../utils/cache';

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

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
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Derivatives summary',
        description: 'Summary of derivatives products on IDX including options, warrants, and futures.',
        security,
        response: {
          200: { description: 'Derivatives data', content: { 'application/json': { example: { success: true, data: [{ contractCode: 'IHSG-C', underlying: 'IHSG', lastPrice: 7205, volume: 15000 }], total: 20, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
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
    }, {
      detail: {
        tags: ['Market'],
        summary: 'ETF list',
        description: 'List of all Exchange Traded Funds (ETF) listed on IDX with current price and NAV.',
        security,
        response: {
          200: { description: 'ETF list', content: { 'application/json': { example: { success: true, data: [{ etfCode: 'XLLF', etfName: 'BNI-AM LQ45', lastPrice: 1050, nav: 1048 }], total: 30, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
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
    }, {
      detail: {
        tags: ['Market'],
        summary: 'ETF iNAV',
        description: 'Indicative Net Asset Value (iNAV) for ETFs — real-time estimated NAV during trading hours.',
        security,
        response: {
          200: { description: 'ETF iNAV data', content: { 'application/json': { example: { success: true, data: [{ etfCode: 'XLLF', inav: 1049.5, lastUpdate: '2025-01-01T09:30:00.000Z' }], total: 30, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
