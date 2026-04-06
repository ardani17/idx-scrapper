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

    .get('/', async () => {
      try {
        const cached = newsCache.get('/news');
        if (cached) return { ...cached, _cached: true };

        const data = await news.getNews();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/press-release', async () => {
      try {
        const cached = newsCache.get('/news/press-release');
        if (cached) return { ...cached, _cached: true };

        const data = await press.getPressRelease();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news/press-release', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/articles', async () => {
      try {
        const cached = newsCache.get('/news/articles');
        if (cached) return { ...cached, _cached: true };

        const data = await articles.getArticles();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news/articles', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/uma', async () => {
      try {
        const cached = newsCache.get('/news/uma');
        if (cached) return { ...cached, _cached: true };

        const data = await uma.getUma();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news/uma', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/suspension', async () => {
      try {
        const cached = newsCache.get('/news/suspension');
        if (cached) return { ...cached, _cached: true };

        const data = await suspension.getSuspension();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news/suspension', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/etd', async () => {
      try {
        const cached = newsCache.get('/news/etd');
        if (cached) return { ...cached, _cached: true };

        const data = await etdTd.getEtd();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news/etd', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/td', async () => {
      try {
        const cached = newsCache.get('/news/td');
        if (cached) return { ...cached, _cached: true };

        const data = await etdTd.getTd();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news/td', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })

    .get('/trading-holiday', async () => {
      try {
        const cached = newsCache.get('/news/trading-holiday');
        if (cached) return { ...cached, _cached: true };

        const data = await holiday.getTradingHoliday();
        const result = { success: true, data, total: data.length, fetchedAt: new Date().toISOString(), _source: 'https://www.idx.co.id/', _cached: false };
        newsCache.set('/news/trading-holiday', result);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    });
}
