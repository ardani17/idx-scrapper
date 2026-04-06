// Other Routes — Statistics, New Listing, Fact Sheet, Bond Book
// GET /api/other/statistics           — IDX Market Statistics
// GET /api/other/new-listing          — IPO / New Listing info
// GET /api/other/fact-sheet-lq45      — LQ45 Fact Sheet
// GET /api/other/bond-book            — Bond Order Book

import { Elysia } from 'elysia';
import { StatisticsClient } from '../../clients/other/statistic';
import { NewListingClient } from '../../clients/other/new-listing';
import { FactSheetLQ45Client } from '../../clients/other/fact-sheet-lq45';
import { BondBookClient } from '../../clients/other/bond-book';
import { slowCache } from '../../utils/cache';

export function otherRoutes() {
  const stats = new StatisticsClient();
  const newListing = new NewListingClient();
  const factSheet = new FactSheetLQ45Client();
  const bondBook = new BondBookClient();

  return new Elysia({ prefix: '/other' })

    .get('/statistics', async () => {
      try {
        const cached = slowCache.get('/other/statistics');
        if (cached) return { ...cached, _cached: true };

        const data = await stats.getStatistics();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/other/statistics', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    })

    .get('/new-listing', async () => {
      try {
        const cached = slowCache.get('/other/new-listing');
        if (cached) return { ...cached, _cached: true };

        const data = await newListing.getNewListings();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/other/new-listing', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    })

    .get('/fact-sheet-lq45', async () => {
      try {
        const cached = slowCache.get('/other/fact-sheet-lq45');
        if (cached) return { ...cached, _cached: true };

        const data = await factSheet.getFactSheet();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/other/fact-sheet-lq45', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    })

    .get('/bond-book', async () => {
      try {
        const cached = slowCache.get('/other/bond-book');
        if (cached) return { ...cached, _cached: true };

        const data = await bondBook.getBondBook();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        slowCache.set('/other/bond-book', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    });
}
