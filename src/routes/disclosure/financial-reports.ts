// Disclosure Routes — Financial Reports (Laporan Keuangan)
// GET /financial-reports, POST /download

import { Elysia, t } from 'elysia';
import type { DisclosureClient } from '../../clients/disclosure-client';
import type { FileDownloader } from '../../downloaders/file-downloader';
import type { ReportType } from '../../types';
import { enrichFinancialReportAttachments } from '../../utils/response';
import { REPORT_TYPE_NAMES } from '../../types';
import { newsCache } from '../../utils/cache';

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

export function financialReportsRoutes(
  disclosure: DisclosureClient,
  downloader: FileDownloader,
) {
  return new Elysia()

    // ── Financial Reports ────────────────────────
    .get('/financial-reports', async ({ query }) => {
      const reportType = (query.reportType || 'ra') as ReportType;
      const cacheKey = `/financial-reports-${reportType}-${query.year || ''}-${query.kodeEmiten || ''}`;
      const cached = newsCache.get(cacheKey);
      if (cached) return { ...cached, _cached: true };

      const { results, totalCount, usedPeriode } = await disclosure.getFinancialReports({
        reportType, year: query.year, kodeEmiten: query.kodeEmiten,
        pageSize: query.pageSize, sortByDate: true,
      });

      const enrichedReports = enrichFinancialReportAttachments(results);

      if (query.download !== 'true') {
        const response = {
          success: true,
          data: enrichedReports,
          total: totalCount,
          reportType,
          reportTypeName: REPORT_TYPE_NAMES[reportType],
          year: query.year,
          usedPeriode,
          fetchedAt: new Date().toISOString(),
          _cached: false,
        };
        newsCache.set(cacheKey, response);
        return response;
      }

      const downloads = [];
      for (const r of results.slice(0, query.downloadLimit)) {
        if (r.attachments.length) {
          const files = r.attachments.map(a => ({
            name: a.fileName,
            url: a.filePath.startsWith('http') ? a.filePath : `https://www.idx.co.id${a.filePath}`,
          }));
          const dl = await downloader.downloadFiles(files, `${r.reportYear}-01-01`, r.kodeEmiten);
          downloads.push({
            kodeEmiten: r.kodeEmiten,
            namaEmiten: r.namaEmiten,
            ...dl,
          });
        }
      }

      return {
        success: true,
        data: enrichedReports,
        total: totalCount,
        reportType,
        reportTypeName: REPORT_TYPE_NAMES[reportType],
        year: query.year,
        usedPeriode,
        fetchedAt: new Date().toISOString(),
        downloads,
      };
    }, {
      query: t.Object({
        reportType: t.Optional(t.String({ default: 'ra', pattern: '^(ra|rdf|rq)$' })),
        year: t.Optional(t.Numeric({ default: new Date().getFullYear() })),
        kodeEmiten: t.Optional(t.String({ default: '' })),
        pageSize: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 500 })),
        download: t.Optional(t.String({ default: 'false' })),
        downloadLimit: t.Optional(t.Numeric({ default: 3, minimum: 1, maximum: 20 })),
      }),
      detail: {
        tags: ['Disclosure'],
        summary: 'Financial reports',
        description: 'Corporate financial reports (annual ra, quarterly rdf, quarterly rq). Filter by stock code, year, or report type. Set download=true to auto-download attachments.',
        security,
        parameters: [
          { name: 'reportType', in: 'query', schema: { type: 'string', default: 'ra', enum: ['ra', 'rdf', 'rq'] }, description: 'Report type: ra=Annual, rdf=Quarterly Financial, rq=Quarterly' },
          { name: 'year', in: 'query', schema: { type: 'integer', default: 2025 }, description: 'Report year' },
          { name: 'kodeEmiten', in: 'query', schema: { type: 'string', default: '' }, description: 'Stock code filter (e.g. BBRI, TLKM)' },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 500 }, description: 'Items per page' },
          { name: 'download', in: 'query', schema: { type: 'string', default: 'false', enum: ['true', 'false'] }, description: 'Set to "true" to auto-download attachments' },
          { name: 'downloadLimit', in: 'query', schema: { type: 'integer', default: 3, minimum: 1, maximum: 20 }, description: 'Max items to download' },
        ],
        responses: {
          200: { description: 'Financial reports', content: { 'application/json': { example: { success: true, data: [{ kodeEmiten: 'BBRI', namaEmiten: 'Bank Rakyat Indonesia', reportType: 'ra', reportYear: 2024, endPeriode: '2024-12-31', attachments: [{ fileName: 'annual-report.pdf' }] }], total: 100, reportType: 'ra', year: 2025, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Manual download trigger ──────────────────
    .post('/download', async ({ body }) => {
      if (!body.files?.length) return { success: false, error: 'No files provided' };
      const result = await downloader.downloadFiles(
        body.files.map((f: any) => ({ name: f.name, url: f.url })),
        body.date || 'Unknown', body.stockCode || null,
      );
      return { success: true, ...result };
    }, {
      body: t.Object({
        date: t.String(),
        stockCode: t.Optional(t.String()),
        files: t.Array(t.Object({ name: t.String(), url: t.String() })),
      }),
      detail: {
        tags: ['Disclosure'],
        summary: 'Manual file download',
        description: 'Manually trigger download of disclosure files to server storage. Provide file URLs and metadata.',
        security,
        responses: {
          200: { description: 'Download initiated', content: { 'application/json': { example: { success: true, downloaded: 2, failed: 0, totalSize: 5000000 } } } },
          400: { description: 'No files provided' },
          ...errResponses,
        },
      },
    });
}
