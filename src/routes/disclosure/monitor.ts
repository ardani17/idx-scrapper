// Disclosure Routes — Monitoring & State Management
// GET /monitor, GET /check-new, GET /state, POST /state/reset

import { Elysia, t } from 'elysia';
import type { DisclosureClient } from '../../clients/disclosure-client';
import type { FileDownloader } from '../../downloaders/file-downloader';
import type { ReportType, DisclosureMonitorState } from '../../types';
import { REPORT_TYPE_NAMES } from '../../types';
import { loadJson, saveJson } from '../../utils/storage';

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

      // Simpan updated state
      await saveJson(stateFile, frResult.updatedState);

      // Auto-download jika ada pengumuman baru
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
    })

    // ── Get current state ────────────────────────
    .get('/state', async () => {
      const state = await loadJson(stateFile, EMPTY_STATE);
      return { success: true, state: {
        lastCheckAt: state.lastCheckAt, lastAnnouncementDate: state.lastAnnouncementDate,
        trackedAnnouncements: state.lastAnnouncementIds.length,
        trackedReportTypes: Object.keys(state.financialReportState),
      }};
    })

    // ── Reset state ──────────────────────────────
    .post('/state/reset', async () => {
      await saveJson(stateFile, EMPTY_STATE);
      return { success: true, message: 'Monitor state reset' };
    });
}
