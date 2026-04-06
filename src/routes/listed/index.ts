// Listed Routes — Corporate Action, Calendar, Watchlist, ESG (Phase 4)
// GET /api/listed/corporate-action
// GET /api/listed/calendar
// GET /api/listed/special-notation
// GET /api/listed/watchlist
// GET /api/listed/esg-rating

import { Elysia } from 'elysia';
import { slowCache } from '../../utils/cache';

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

    .get('/corporate-action', async () => {
      try {
        const cached = slowCache.get('/listed/corporate-action');
        if (cached) return { ...cached, _cached: true };

        const data = await corporateAction.getCorporateAction();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/listed/corporate-action', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Listed'],
        summary: 'Corporate actions',
        description: 'Upcoming and recent corporate actions including dividends, stock splits, rights issues, and bonus shares.',
        security,
        response: {
          200: { description: 'Corporate action list', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', action: 'Dividen', exDate: '2025-03-15', recordDate: '2025-03-17' }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/calendar', async () => {
      try {
        const cached = slowCache.get('/listed/calendar');
        if (cached) return { ...cached, _cached: true };

        const data = await calendar.getCalendar();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/listed/calendar', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Listed'],
        summary: 'Corporate calendar',
        description: 'Upcoming corporate events calendar — AGM, EGM, dividend dates, financial report deadlines.',
        security,
        response: {
          200: { description: 'Corporate calendar', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'TLKM', event: 'RUPS', date: '2025-04-20' }], total: 100, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/special-notation', async () => {
      try {
        const cached = slowCache.get('/listed/special-notation');
        if (cached) return { ...cached, _cached: true };

        const data = await watchlist.getSpecialNotation();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/listed/special-notation', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Listed'],
        summary: 'Special notation (watchlist)',
        description: 'Stocks under special notation/watchlist by IDX — unusual trading activity, regulatory concerns, etc.',
        security,
        response: {
          200: { description: 'Special notation stocks', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'XYZ', notation: 'TP', reason: 'Suspicious trading' }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/watchlist', async () => {
      try {
        const cached = slowCache.get('/listed/watchlist');
        if (cached) return { ...cached, _cached: true };

        const data = await watchlist.getWatchlistStocks();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/listed/watchlist', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Listed'],
        summary: 'Watchlist stocks',
        description: 'IDX-monitored watchlist stocks with unusual price movements or high volatility.',
        security,
        response: {
          200: { description: 'Watchlist data', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'ABC', lastPrice: 500, changePct: 25, reason: 'UOA' }], total: 15, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/esg-rating', async () => {
      try {
        const cached = slowCache.get('/listed/esg-rating');
        if (cached) return { ...cached, _cached: true };

        const data = await esg.getEsgRatings();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/en/listed-companies/esg/', _cached: false };
        slowCache.set('/listed/esg-rating', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }, {
      detail: {
        tags: ['Listed'],
        summary: 'ESG rating',
        description: 'Environmental, Social, and Governance (ESG) ratings for IDX-listed companies.',
        security,
        response: {
          200: { description: 'ESG ratings', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', overallScore: 85, environmentalScore: 80, socialScore: 88, governanceScore: 87 }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
