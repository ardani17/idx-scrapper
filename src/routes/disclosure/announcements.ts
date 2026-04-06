// Disclosure Routes — Announcements & Berita Pengumuman
// GET /announcements, GET /berita-pengumuman, GET /redirect

import { Elysia, t } from 'elysia';
import type { DisclosureClient } from '../../clients/disclosure-client';
import type { FileDownloader } from '../../downloaders/file-downloader';
import { enrichAnnouncementFiles } from '../../utils/response';
import { newsCache } from '../../utils/cache';

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

// ── Date Filter Helper ─────────────────────
function parseIdxDate(dateStr: string): Date | null {
  const months: Record<string, string> = {
    'Januari':'01','Februari':'02','Maret':'03','April':'04','Mei':'05','Juni':'06',
    'Juli':'07','Agustus':'08','September':'09','Oktober':'10','November':'11','Desember':'12'
  };
  const m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m && months[m[2]]) return new Date(`${m[3]}-${months[m[2]]}-${m[1].padStart(2,'0')}`);
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function filterByDate(items: any[], dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return items;
  return items.filter(item => {
    const d = parseIdxDate(item.date);
    if (!d) return true;
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });
}

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
      detail: {
        tags: ['Disclosure'],
        summary: 'Redirect to IDX file',
        description: 'Redirect to the original IDX disclosure file URL. Useful for accessing files that require IDX session cookies.',
        security,
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string' }, description: 'IDX URL to redirect to (must contain idx.co.id)' },
        ],
        responses: {
          302: { description: 'Redirect to IDX file' },
          400: { description: 'Invalid URL' },
          ...errResponses,
        },
      },
    })

    // ── Berita Pengumuman ────────────────────────
    .get('/berita-pengumuman', async ({ query }) => {
      const cacheKey = `/berita-pengumuman-${query.limit || 20}-${query.page || 1}-${query.keywords || ''}-${query.dateFrom || ''}-${query.dateTo || ''}`;
      const cached = newsCache.get(cacheKey);
      if (cached) return { ...cached, _cached: true };

      const result = await disclosure.getBeritaPengumuman(
        query.limit, query.page, query.keywords,
      );

      let enriched = enrichAnnouncementFiles(result.items);
      enriched = filterByDate(enriched, query.dateFrom, query.dateTo);

      const response = {
        success: true,
        data: enriched,
        total: enriched.length,
        page: query.page || 1,
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
        dateFrom: t.Optional(t.String({ default: '' })),
        dateTo: t.Optional(t.String({ default: '' })),
      }),
      detail: {
        tags: ['Disclosure'],
        summary: 'Berita Pengumuman (IDX news)',
        description: 'IDX disclosure announcements in Indonesian. Supports keyword search, pagination, and date filtering.',
        security,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 200 }, description: 'Items per page' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'keywords', in: 'query', schema: { type: 'string', default: '' }, description: 'Search keyword filter' },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', description: 'Filter from date (YYYY-MM-DD)' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', description: 'Filter to date (YYYY-MM-DD)' } },
        ],
        responses: {
          200: { description: 'Announcement list' },
          ...errResponses,
        },
      },
    })

    // ── Announcements (Pengumuman) ───────────────
    .get('/announcements', async ({ query }) => {
      const cacheKey = `/announcements-${query.limit || 50}-${query.download || 'false'}-${query.dateFrom || ''}-${query.dateTo || ''}`;
      const cached = newsCache.get(cacheKey);
      if (cached) return { ...cached, _cached: true };

      const data = await disclosure.getAnnouncements(query.limit);
      let enriched = enrichAnnouncementFiles(data).map(ann => ({
        ...ann,
        _links: {
          self: '/api/disclosure/announcements',
          downloadTrigger: `/api/disclosure/announcements?download=true&limit=${query.limit || 50}`,
        },
      }));
      enriched = filterByDate(enriched, query.dateFrom, query.dateTo);

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
        dateFrom: t.Optional(t.String({ default: '' })),
        dateTo: t.Optional(t.String({ default: '' })),
      }),
      detail: {
        tags: ['Disclosure'],
        summary: 'Announcements (with download)',
        description: 'Latest IDX disclosures/announcements. Supports date filtering and optional file download.',
        security,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 200 }, description: 'Number of announcements to fetch' },
          { name: 'download', in: 'query', schema: { type: 'string', default: 'false', enum: ['true', 'false'] }, description: 'Set to "true" to auto-download attachments' },
          { name: 'downloadLimit', in: 'query', schema: { type: 'integer', default: 3, minimum: 1, maximum: 20 }, description: 'Max items to download when download=true' },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', description: 'Filter from date (YYYY-MM-DD)' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', description: 'Filter to date (YYYY-MM-DD)' } },
        ],
        responses: {
          200: { description: 'Announcements list' },
          ...errResponses,
        },
      },
    });
}
