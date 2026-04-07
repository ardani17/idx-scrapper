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
import { cachedScrape } from '../../utils/cached-scrape';

const SLOW_TTL_MS = 900_000;
const SLOW_MAX_AGE = 900;

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

export function otherRoutes() {
  const stats = new StatisticsClient();
  const newListing = new NewListingClient();
  const factSheet = new FactSheetLQ45Client();
  const bondBook = new BondBookClient();

  return new Elysia({ prefix: '/other' })

    .get('/statistics', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/other/statistics',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => stats.getStatistics(),
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
        tags: ['Other'],
        summary: 'IDX market statistics',
        description: 'Key market statistics — market capitalization, number of listed companies, trading volume/value summaries.',
        security,
        responses: {
          200: { description: 'Market statistics', content: { 'application/json': { example: { success: true, data: [{ metric: 'Market Cap', value: '10,500 T' }, { metric: 'Listed Companies', value: 900 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/new-listing', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/other/new-listing',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => newListing.getNewListings(),
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
        tags: ['Other'],
        summary: 'New listings / IPO',
        description: 'Recently listed companies and upcoming IPO information on IDX.',
        security,
        responses: {
          200: { description: 'New listings', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'XYZ', stockName: 'PT XYZ Indonesia', listingDate: '2025-01-15', ipoPrice: 500 }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/fact-sheet-lq45', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/other/fact-sheet-lq45',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => factSheet.getFactSheet(),
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
        tags: ['Other'],
        summary: 'LQ45 fact sheet',
        description: 'LQ45 index fact sheet — constituent stocks, weights, and index performance data.',
        security,
        responses: {
          200: { description: 'LQ45 fact sheet', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'BBRI', weight: 12.5, sector: 'Finance' }], total: 45, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/bond-book', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/other/bond-book',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => bondBook.getBondBook(),
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
        tags: ['Other'],
        summary: 'Bond order book',
        description: 'Bond order book summary — bid/ask data for listed bonds and sukuk.',
        security,
        responses: {
          200: { description: 'Bond order book', content: { 'application/json': { example: { success: true, data: [{ bondCode: 'BRIS01', bidPrice: 101.5, askPrice: 102.0, volume: 5000 }], total: 20, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
