// Market Routes — Bonds (Phase 3)
// GET /api/market/bond-summary
// GET /api/market/indobex

import { Elysia } from 'elysia';
import type { BondSummaryClient } from '../../clients/market/bond-sukuk';
import type { IndobexClient } from '../../clients/market/indobex';
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

export function bondsRoutes(
  bond: BondSummaryClient,
  indobex: IndobexClient,
) {
  return new Elysia()

    .get('/bond-summary', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/bond-summary',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => bond.getBondSummary(),
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
        tags: ['Market'],
        summary: 'Bond & sukuk summary',
        description: 'Summary of active bonds and sukuk listed on IDX including yield, coupon rate, and maturity.',
        security,
        responses: {
          200: { description: 'Bond summary data', content: { 'application/json': { example: { success: true, data: [{ bondCode: 'BRIS01', issuer: 'Bank BRISyariah', coupon: 6.5, maturity: '2028-12-15' }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/indobex', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/indobex',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => indobex.getIndobex(),
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/en/market-data/bond-data/indobex/',
        _cached: cached,
      };
    }, {
      detail: {
        tags: ['Market'],
        summary: 'INDOBEX (Bond Index)',
        description: 'Indonesia Bond Index (INDOBEX) data — benchmark bond indices published by IDX.',
        security,
        responses: {
          200: { description: 'INDOBEX data', content: { 'application/json': { example: { success: true, data: [{ indexName: 'INDOBEX Government', value: 150.5, change: 0.3 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
