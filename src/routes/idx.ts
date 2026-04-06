// Routes — IDX Data (Relisting, Emiten, Profile)

import { Elysia, t } from 'elysia';
import type { IDXClient } from '../clients/idx-client';
import { slowCache } from '../utils/cache';

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

export function idxRoutes(client: IDXClient) {
  return new Elysia({ prefix: '' })
    .get('/relisting', async ({ query }) => {
      try {
        const cacheKey = `/relisting-${query.pageSize}-${query.indexFrom}`;
        const cached = slowCache.get(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const data = await client.getRelistingData(query.pageSize, query.indexFrom);
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set(cacheKey, result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      query: t.Object({
        pageSize: t.Optional(t.Numeric({ default: 10 })),
        indexFrom: t.Optional(t.Numeric({ default: 0 })),
      }),
      detail: {
        tags: ['IDX Data'],
        summary: 'Relisting data',
        description: 'Relisted stocks data — stocks that have been relisted on IDX after suspension or delisting.',
        security,
        parameters: [
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Number of items per page' },
          { name: 'indexFrom', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Starting index for pagination' },
        ],
        responses: {
          200: { description: 'Relisting data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'ABC', stockName: 'PT ABC', listingDate: '2024-01-15' }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/emiten', async ({ query }) => {
      try {
        const cacheKey = `/emiten-${query.page}`;
        const cached = slowCache.get(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const data = await client.getEmitenList(query.page);
        const result = {
          success: true, data, total: data.length, page: query.page,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set(cacheKey, result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      query: t.Object({
        page: t.Optional(t.Numeric({ default: 1 })),
      }),
      detail: {
        tags: ['IDX Data'],
        summary: 'Emiten list',
        description: 'List of all emiten (listed companies) on IDX with basic info. Paginated.',
        security,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
        ],
        responses: {
          200: { description: 'Emiten list', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', sector: 'Finance' }], total: 50, page: 1, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/profile/:code', async ({ params, set }) => {
      try {
        const cacheKey = `/profile-${params.code}`;
        const cached = slowCache.get(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const data = await client.getCompanyProfile(params.code);
        if (!data) {
          set.status = 404;
          return { success: false, error: `Profile not found: ${params.code}` };
        }
        const result = {
          success: true, data,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set(cacheKey, result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      params: t.Object({
        code: t.String({ pattern: '^[A-Za-z]{4,6}$' }),
      }),
      detail: {
        tags: ['IDX Data'],
        summary: 'Company profile',
        description: 'Detailed company profile by stock code — includes sector, board, listing date, address, and more.',
        security,
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string', pattern: '^[A-Za-z]{4,6}$' }, description: 'Stock ticker code (e.g. BBRI, TLKM)' },
        ],
        responses: {
          200: { description: 'Company profile', content: { 'application/json': { example: { success: true, data: { stockCode: 'BBRI', stockName: 'Bank Rakyat Indonesia', sector: 'Finance', listingDate: '2003-11-10' }, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          404: { description: 'Profile not found' },
          ...errResponses,
        },
      },
    });
}
