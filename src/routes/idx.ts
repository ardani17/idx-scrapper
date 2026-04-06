// Routes — IDX Data (Relisting, Emiten, Profile)

import { Elysia, t } from 'elysia';
import type { IDXClient } from '../clients/idx-client';
import { slowCache } from '../utils/cache';

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
    });
}
