// News Routes (Phase 5)
// GET /api/news
// GET /api/news/press-release
// GET /api/news/articles
// GET /api/news/uma
// GET /api/news/suspension
// GET /api/news/etd
// GET /api/news/td
// GET /api/news/trading-holiday

import { Elysia } from 'elysia';
import type { NewsClient } from '../../clients/news/news';
import type { PressReleaseClient } from '../../clients/news/press-release';
import type { ArticleClient } from '../../clients/news/article';
import type { UmaClient } from '../../clients/news/uma';
import type { SuspensionClient } from '../../clients/news/suspension';
import type { EtdTdClient } from '../../clients/news/etd-td';
import type { TradingHolidayClient } from '../../clients/news/trading-holiday';
import { newsCache } from '../../utils/cache';
import { cachedScrape } from '../../utils/cached-scrape';

const NEWS_TTL_MS = 300_000;
const NEWS_MAX_AGE = 300;

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

export function newsRoutes(
  news: NewsClient,
  press: PressReleaseClient,
  articles: ArticleClient,
  uma: UmaClient,
  suspension: SuspensionClient,
  etdTd: EtdTdClient,
  holiday: TradingHolidayClient,
) {
  return new Elysia({ prefix: '/news' })

    .get('/', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => news.getNews(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'IDX news',
        description: 'Latest IDX news and announcements.',
        security,
        responses: {
          200: { description: 'News list', content: { 'application/json': { example: { success: true, data: [{ title: 'IDX Trading Update', date: '2025-01-01', url: 'https://www.idx.co.id/...' }], total: 20, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/press-release', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news/press-release',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => press.getPressRelease(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'Press releases',
        description: 'Official IDX press releases.',
        security,
        responses: {
          200: { description: 'Press releases', content: { 'application/json': { example: { success: true, data: [{ title: 'IDX Press Release', date: '2025-01-01' }], total: 15, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/articles', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news/articles',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => articles.getArticles(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'IDX articles',
        description: 'Articles and market insights published by IDX.',
        security,
        responses: {
          200: { description: 'Articles', content: { 'application/json': { example: { success: true, data: [{ title: 'Market Review', date: '2025-01-01' }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/uma', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news/uma',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => uma.getUma(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'UMA (Unusual Market Activity)',
        description: 'Unusual Market Activity reports — stocks flagged for suspicious trading patterns.',
        security,
        responses: {
          200: { description: 'UMA reports', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'ABC', reportDate: '2025-01-01', description: 'UOA detected' }], total: 10, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/suspension', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news/suspension',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => suspension.getSuspension(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'Stock suspensions',
        description: 'Recent stock suspension notices from IDX.',
        security,
        responses: {
          200: { description: 'Suspension notices', content: { 'application/json': { example: { success: true, data: [{ stockCode: 'XYZ', suspensionDate: '2025-01-01', reason: 'Permintaan Emiten' }], total: 5, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/etd', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news/etd',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => etdTd.getEtd(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'ETD news',
        description: 'Exchange Traded Derivatives news and updates.',
        security,
        responses: {
          200: { description: 'ETD news', content: { 'application/json': { example: { success: true, data: [{ title: 'ETD Update', date: '2025-01-01' }], total: 5, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/td', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news/td',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => etdTd.getTd(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'TD (Trading Derivative) news',
        description: 'Trading Derivative product news and notices.',
        security,
        responses: {
          200: { description: 'TD news', content: { 'application/json': { example: { success: true, data: [{ title: 'TD Notice', date: '2025-01-01' }], total: 5, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    .get('/trading-holiday', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey: '/news/trading-holiday',
        ttlMs: NEWS_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => holiday.getTradingHoliday(),
      });
      set.headers['Cache-Control'] = `max-age=${NEWS_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['News'], summary: 'Trading holidays',
        description: 'IDX trading holiday calendar — dates when the exchange is closed.',
        security,
        responses: {
          200: { description: 'Trading holidays', content: { 'application/json': { example: { success: true, data: [{ date: '2025-01-01', description: 'Tahun Baru' }, { date: '2025-03-29', description: 'Hari Raya Nyepi' }], total: 15, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
