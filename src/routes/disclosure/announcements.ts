// Disclosure Routes — Announcements & Berita Pengumuman
// GET /announcements, GET /berita-pengumuman, GET /redirect

import { Elysia, t } from 'elysia';
import type { DisclosureClient } from '../../clients/disclosure-client';
import type { FileDownloader } from '../../downloaders/file-downloader';
import { enrichAnnouncementFiles } from '../../utils/response';
import { newsCache } from '../../utils/cache';

export function announcementsRoutes(
  disclosure: DisclosureClient,
  downloader: FileDownloader,
) {
  return new Elysia()

    // ── Redirect ke file asli IDX ─────────────────
    .get('/redirect', ({ query, set }) => {
      const url = decodeURIComponent(query.url || '');
      if (!url || !url.includes('idx.co.id')) {
        return { success: false, message: 'URL tidak valid. Harus mengandung idx.co.id' };
      }
      set.redirect = url;
      return { success: true, redirectingTo: url };
    }, {
      query: t.Object({ url: t.String() }),
    })

    // ── Berita Pengumuman ────────────────────────
    .get('/berita-pengumuman', async ({ query }) => {
      const cacheKey = `/berita-pengumuman-${query.limit || 20}-${query.page || 1}-${query.keywords || ''}`;
      const cached = newsCache.get(cacheKey);
      if (cached) return { ...cached, _cached: true };

      const result = await disclosure.getBeritaPengumuman(
        query.limit, query.page, query.keywords,
      );

      const enriched = enrichAnnouncementFiles(result.items);

      const response = {
        success: true,
        data: enriched,
        total: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/id/berita/pengumuman/',
        _cached: false,
      };
      newsCache.set(cacheKey, response);
      return response;
    }, {
      query: t.Object({
        limit: t.Optional(t.Numeric({ default: 20, minimum: 1, maximum: 200 })),
        page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
        keywords: t.Optional(t.String({ default: '' })),
      }),
    })

    // ── Announcements (Pengumuman) ───────────────
    .get('/announcements', async ({ query }) => {
      const cacheKey = `/announcements-${query.limit || 50}-${query.download || 'false'}`;
      const cached = newsCache.get(cacheKey);
      if (cached) return { ...cached, _cached: true };

      const data = await disclosure.getAnnouncements(query.limit);
      const enriched = enrichAnnouncementFiles(data).map(ann => ({
        ...ann,
        _links: {
          self: '/api/disclosure/announcements',
          downloadTrigger: `/api/disclosure/announcements?download=true&limit=${query.limit || 50}`,
        },
      }));

      if (query.download !== 'true') {
        const response = {
          success: true,
          data: enriched,
          total: enriched.length,
          fetchedAt: new Date().toISOString(),
          _cached: false,
        };
        newsCache.set(cacheKey, response);
        return response;
      }

      // Download lampiran ke server
      const downloads = [];
      for (const ann of data.slice(0, query.downloadLimit)) {
        if (ann.files.length) {
          const r = await downloader.downloadFiles(ann.files, ann.date, ann.stockCode);
          downloads.push({
            title: ann.title.slice(0, 60),
            stockCode: ann.stockCode,
            ...r,
          });
        }
      }

      const response = {
        success: true,
        data: enriched,
        total: enriched.length,
        fetchedAt: new Date().toISOString(),
        downloads,
        _cached: false,
      };
      return response;
    }, {
      query: t.Object({
        limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 200 })),
        download: t.Optional(t.String({ default: 'false' })),
        downloadLimit: t.Optional(t.Numeric({ default: 3, minimum: 1, maximum: 20 })),
      }),
    });
}
