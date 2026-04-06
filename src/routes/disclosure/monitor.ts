// Disclosure Routes — Monitoring & State Management
// GET /monitor, GET /check-new, GET /state, POST /state/reset

import { Elysia, t } from 'elysia';
import type { DisclosureClient } from '../../clients/disclosure-client';
import type { FileDownloader } from '../../downloaders/file-downloader';
import type { ReportType, DisclosureMonitorState } from '../../types';
import { REPORT_TYPE_NAMES } from '../../types';
import { loadJson, saveJson } from '../../utils/storage';

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

/** Default empty state untuk monitoring */
const EMPTY_STATE: DisclosureMonitorState = {
  lastCheckAt: '', lastAnnouncementDate: '', lastAnnouncementIds: [],
  newAnnouncements: [], newFinancialReports: [], financialReportState: {},
};

export function monitorRoutes(
  disclosure: DisclosureClient,
  downloader: FileDownloader,
  stateFile: string,
) {
  return new Elysia()

    // ── Auto-Monitoring ──────────────────────────
    .get('/monitor', async ({ query }) => {
      const state = await loadJson(stateFile, EMPTY_STATE);
      const reportType = (query.reportType || 'ra') as ReportType;

      const annResult = await disclosure.checkNewAnnouncements(state);
      const frResult  = await disclosure.checkNewFinancialReports(annResult.updatedState, reportType);

      await saveJson(stateFile, frResult.updatedState);

      let downloads: any[] = [];
      if (query.download === 'true' && annResult.newItems.length > 0) {
        for (const item of annResult.newItems.slice(0, query.downloadLimit || 3)) {
          if (item.files.length) {
            const dl = await downloader.downloadFiles(item.files, item.date, item.stockCode);
            downloads.push({ title: item.title.slice(0, 60), stockCode: item.stockCode, ...dl });
          }
        }
      }

      return {
        success: true,
        monitoredAt: frResult.updatedState.lastCheckAt,
        announcements: {
          hasNew: annResult.hasNew,
          newCount: annResult.newItems.length,
          items: annResult.newItems,
        },
        financialReports: {
          hasNew: frResult.hasNew,
          newCount: frResult.newItems.length,
          items: frResult.newItems,
          reportType,
          reportTypeName: REPORT_TYPE_NAMES[reportType],
        },
        ...(downloads.length ? { downloads } : {}),
      };
    }, {
      query: t.Object({
        reportType: t.Optional(t.String({ default: 'ra', pattern: '^(ra|rdf|rq)$' })),
        download: t.Optional(t.String({ default: 'false' })),
        downloadLimit: t.Optional(t.Numeric({ default: 3, minimum: 1, maximum: 20 })),
      }),
      detail: {
        tags: ['Disclosure'],
        summary: 'Monitor disclosures (auto-check)',
        description: 'Check for new announcements and financial reports since last check. Updates internal state. Optionally auto-download new files.',
        security,
        parameters: [
          { name: 'reportType', in: 'query', schema: { type: 'string', default: 'ra', enum: ['ra', 'rdf', 'rq'] }, description: 'Financial report type to check' },
          { name: 'download', in: 'query', schema: { type: 'string', default: 'false', enum: ['true', 'false'] }, description: 'Auto-download new attachments' },
          { name: 'downloadLimit', in: 'query', schema: { type: 'integer', default: 3, minimum: 1, maximum: 20 }, description: 'Max new items to download' },
        ],
        responses: {
          200: { description: 'Monitor results', content: { 'application/json': { example: { success: true, monitoredAt: '2025-01-01T10:00:00.000Z', announcements: { hasNew: true, newCount: 3, items: [] }, financialReports: { hasNew: false, newCount: 0, items: [], reportType: 'ra' } } } } },
          ...errResponses,
        },
      },
    })

    // ── Check for new items ──────────────────────
    .get('/check-new', async ({ query}) => {
      const state = await loadJson(stateFile, EMPTY_STATE);
      const reportType = (query.reportType || 'ra') as ReportType;

      const ann = await disclosure.checkNewAnnouncements(state);
      const fr = await disclosure.checkNewFinancialReports(ann.updatedState, reportType);
      await saveJson(stateFile, fr.updatedState);

      return {
        success: true,
        hasNew: ann.hasNew || fr.hasNew,
        announcements: { hasNew: ann.hasNew, newCount: ann.newItems.length, items: ann.newItems },
        financialReports: { hasNew: fr.hasNew, newCount: fr.newItems.length, items: fr.newItems,
          reportType, reportTypeName: REPORT_TYPE_NAMES[reportType] },
        lastCheckAt: fr.updatedState.lastCheckAt,
      };
    }, {
      query: t.Object({
        reportType: t.Optional(t.String({ default: 'ra', pattern: '^(ra|rdf|rq)$' })),
      }),
      detail: {
        tags: ['Disclosure'],
        summary: 'Check for new disclosures',
        description: 'Quick check for new announcements and financial reports. Returns boolean hasNew flag and counts. Does not download files.',
        security,
        parameters: [
          { name: 'reportType', in: 'query', schema: { type: 'string', default: 'ra', enum: ['ra', 'rdf', 'rq'] }, description: 'Financial report type to check' },
        ],
        responses: {
          200: { description: 'New items check', content: { 'application/json': { example: { success: true, hasNew: true, announcements: { hasNew: true, newCount: 2 }, financialReports: { hasNew: false, newCount: 0 }, lastCheckAt: '2025-01-01T10:00:00.000Z' } } } },
          ...errResponses,
        },
      },
    })

    // ── Get current state ────────────────────────
    .get('/state', async () => {
      const state = await loadJson(stateFile, EMPTY_STATE);
      return { success: true, state: {
        lastCheckAt: state.lastCheckAt, lastAnnouncementDate: state.lastAnnouncementDate,
        trackedAnnouncements: state.lastAnnouncementIds.length,
        trackedReportTypes: Object.keys(state.financialReportState),
      }};
    }, {
      detail: {
        tags: ['Disclosure'],
        summary: 'Get monitor state',
        description: 'Get current disclosure monitor state — last check time, tracked items count, and tracked report types.',
        security,
        responses: {
          200: { description: 'Monitor state', content: { 'application/json': { example: { success: true, state: { lastCheckAt: '2025-01-01T10:00:00.000Z', lastAnnouncementDate: '2025-01-01', trackedAnnouncements: 50, trackedReportTypes: ['ra', 'rdf'] } } } } },
          ...errResponses,
        },
      },
    })

    // ── Reset state ──────────────────────────────
    .post('/state/reset', async () => {
      await saveJson(stateFile, EMPTY_STATE);
      return { success: true, message: 'Monitor state reset' };
    }, {
      detail: {
        tags: ['Disclosure'],
        summary: 'Reset monitor state',
        description: 'Reset the disclosure monitor state. Next check will treat all items as new.',
        security,
        responses: {
          200: { description: 'State reset', content: { 'application/json': { example: { success: true, message: 'Monitor state reset' } } } },
          ...errResponses,
        },
      },
    });
}
