// Listed Routes — Corporate Action, Calendar, Watchlist, ESG (Phase 4)
// GET /api/listed/corporate-action
// GET /api/listed/calendar
// GET /api/listed/special-notation
// GET /api/listed/watchlist
// GET /api/listed/esg-rating

import { Elysia } from 'elysia';
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

export function listedRoutes(
  corporateAction: any,
  calendar: any,
  watchlist: any,
  esg: any,
) {

  return new Elysia({ prefix: '/listed' })

    .get('/corporate-action', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/listed/corporate-action',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => corporateAction.getCorporateAction(),
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
        tags: ['Listed'],
        summary: 'Corporate actions',
        description: 'Upcoming and recent corporate actions including dividends, stock splits, rights issues, and bonus shares.',
        security,
        responses: {
          200: { description: 'Corporate action list', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', action: 'Dividen', exDate: '2025-03-15', recordDate: '2025-03-17' }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/calendar', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/listed/calendar',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => calendar.getCalendar(),
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
        tags: ['Listed'],
        summary: 'Corporate calendar',
        description: 'Upcoming corporate events calendar — AGM, EGM, dividend dates, financial report deadlines.',
        security,
        responses: {
          200: { description: 'Corporate calendar', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'TLKM', event: 'RUPS', date: '2025-04-20' }], total: 100, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/special-notation', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/listed/special-notation',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => watchlist.getSpecialNotation(),
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
        tags: ['Listed'],
        summary: 'Special notation (watchlist)',
        description: 'Stocks under special notation/watchlist by IDX — unusual trading activity, regulatory concerns, etc.',
        security,
        responses: {
          200: { description: 'Special notation stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'XYZ', notation: 'TP', reason: 'Suspicious trading' }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/watchlist', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/listed/watchlist',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => watchlist.getWatchlistStocks(),
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
        tags: ['Listed'],
        summary: 'Watchlist stocks',
        description: 'IDX-monitored watchlist stocks with unusual price movements or high volatility.',
        security,
        responses: {
          200: { description: 'Watchlist data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'ABC', lastPrice: 500, changePct: 25, reason: 'UOA' }], total: 15, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/esg-rating', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/listed/esg-rating',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => esg.getEsgRatings(),
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/en/listed-companies/esg/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Listed'],
        summary: 'ESG rating',
        description: 'Environmental, Social, and Governance (ESG) ratings for IDX-listed companies.',
        security,
        responses: {
          200: { description: 'ESG ratings', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', overallScore: 85, environmentalScore: 80, socialScore: 88, governanceScore: 87 }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
