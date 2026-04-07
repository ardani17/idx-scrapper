// Disclosure Routes — Announcements & Berita Pengumuman
// GET /announcements, GET /berita-pengumuman, GET /redirect

import { Elysia, t } from 'elysia';
import type { DisclosureClient } from '../../clients/disclosure-client';
import { enrichAnnouncementFiles } from '../../utils/response';
import { newsCache } from '../../utils/cache';
import { cachedScrape } from '../../utils/cached-scrape';

const DISCLOSURE_TTL_MS = 300_000;
const DISCLOSURE_MAX_AGE = 300;

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
  if (m && m[1] && m[2] && m[3] && months[m[2]]) return new Date(`${m[3]}-${months[m[2]]}-${m[1].padStart(2,'0')}`);
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
) {
  return new Elysia()

    // ── Redirect ke file asli IDX ─────────────────
    .get('/redirect', ({ query, set }) => {
      const url = decodeURIComponent(query.url || '');
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'www.idx.co.id' && parsed.hostname !== 'idx.co.id') {
          return { success: false, message: 'URL harus mengarah ke idx.co.id' };
        }
        return new Response(null, { status: 302, headers: { Location: url } });
      } catch {
        return { success: false, message: 'URL tidak valid' };
      }
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
    .get('/berita-pengumuman', async ({ query, set }) => {
      const cacheKey = `/berita-pengumuman-${query.limit || 20}-${query.page || 1}-${query.keywords || ''}-${query.dateFrom || ''}-${query.dateTo || ''}`;

      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey,
        ttlMs: DISCLOSURE_TTL_MS,
        requestId: 'no-request-id',
        scraper: async () => {
          const result = await disclosure.getBeritaPengumuman(
            query.limit, query.page, query.keywords,
          );
          let enriched = enrichAnnouncementFiles(result.items);
          enriched = filterByDate(enriched, query.dateFrom, query.dateTo);
          return { items: enriched, total: enriched.length, page: query.page || 1, pageSize: result.pageSize };
        },
      });
      set.headers['Cache-Control'] = `max-age=${DISCLOSURE_MAX_AGE}`;
      return {
        success: true,
        data: data.items,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/id/berita/pengumuman/',
        _cached: cached,
      };
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
          200: { description: 'Announcement list', content: { 'application/json': { example: { success: true, data: [{ title: 'Pengumuman Dividen', date: '01 Januari 2025', stockCode: 'BBRI', files: [] }], total: 20, page: 1, pageSize: 20, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Announcements (Pengumuman) ───────────────
    .get('/announcements', async ({ query, set }) => {
      const cacheKey = `/announcements-${query.limit || 50}-${query.dateFrom || ''}-${query.dateTo || ''}`;

      const { data, cached } = await cachedScrape({
        cache: newsCache,
        cacheKey,
        ttlMs: DISCLOSURE_TTL_MS,
        requestId: 'no-request-id',
        scraper: async () => {
          const raw = await disclosure.getAnnouncements(query.limit);
          let enriched = enrichAnnouncementFiles(raw);
          enriched = filterByDate(enriched, query.dateFrom, query.dateTo);
          return { items: enriched, total: enriched.length };
        },
      });
      set.headers['Cache-Control'] = `max-age=${DISCLOSURE_MAX_AGE}`;
      return {
        success: true,
        data: data.items,
        total: data.total,
        fetchedAt: new Date().toISOString(),
        _cached: cached,
      };
    }, {
      query: t.Object({
        limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 200 })),
        dateFrom: t.Optional(t.String({ default: '' })),
        dateTo: t.Optional(t.String({ default: '' })),
      }),
      detail: {
        tags: ['Disclosure'],
        summary: 'Announcements (data only)',
        description: 'Latest IDX disclosures/announcements. Data fetch only, no file download.',
        security,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 200 }, description: 'Number of announcements to fetch' },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', description: 'Filter from date (YYYY-MM-DD)' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', description: 'Filter to date (YYYY-MM-DD)' } },
        ],
        responses: {
          200: { description: 'Announcements list', content: { 'application/json': { example: { success: true, data: [{ title: 'Laporan Keuangan Tahunan', date: '01 Januari 2025', stockCode: 'TLKM', files: [] }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
