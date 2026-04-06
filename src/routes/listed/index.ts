// Listed Routes — Corporate Action, Calendar, Watchlist, ESG (Phase 4)
// GET /api/listed/corporate-action
// GET /api/listed/calendar
// GET /api/listed/special-notation
// GET /api/listed/watchlist
// GET /api/listed/esg-rating

import { Elysia } from 'elysia';
import { slowCache } from '../../utils/cache';

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
    });
}
