// Disclosure Client — Thin Facade (Composite)
// Delegates ke AnnouncementsClient + FinancialReportsClient.
// Monitoring methods tetap di sini (cross-cutting concern).

import { AnnouncementsClient } from './announcements';
import { FinancialReportsClient } from './financial-reports';
import type { Announcement, FinancialReport, ReportType, DisclosureMonitorState } from '../types';

export class DisclosureClient {
  readonly announcements: AnnouncementsClient;
  readonly financialReports: FinancialReportsClient;

  constructor(config?: { idxBaseUrl?: string }) {
    this.announcements = new AnnouncementsClient(config);
    this.financialReports = new FinancialReportsClient(config);
  }

  // ── Delegate: Announcements ────────────────────
  async getAnnouncements(max?: number): Promise<Announcement[]> {
    return this.announcements.getAnnouncements(max);
  }
  async getAnnouncementsAPI(
    limit?: number, dateFrom?: string, dateTo?: string,
  ): Promise<Announcement[]> {
    return this.announcements.getAnnouncementsAPI(limit, dateFrom, dateTo);
  }

  // ── Delegate: Berita Pengumuman ─────────────────
  async getBeritaPengumuman(
    limit?: number, pageNumber?: number, keywords?: string,
  ): Promise<{ items: Announcement[]; totalCount: number; page: number; pageSize: number }> {
    return this.announcements.getBeritaPengumuman(limit, pageNumber, keywords);
  }

  // ── Delegate: Financial Reports ─────────────────
  async getFinancialReports(
    params?: Parameters<FinancialReportsClient['getFinancialReportsWithFallback']>[0],
  ) {
    return this.financialReports.getFinancialReportsWithFallback(params);
  }

  /** Raw get without fallback */
  async getFinancialReportsRaw(
    params?: Parameters<FinancialReportsClient['getFinancialReports']>[0],
  ): Promise<ReturnType<FinancialReportsClient['getFinancialReports']>> {
    return this.financialReports.getFinancialReports(params);
  }

  // ── Monitoring (cross-cutting) ───────────────────

  async checkNewAnnouncements(state: DisclosureMonitorState) {
    const current = await this.getAnnouncements(50);
    const prevIds = new Set(state.lastAnnouncementIds);
    const makeId = (a: Announcement) => `${a.date}-${a.time}-${a.stockCode}-${a.title.slice(0, 50)}`;

    const newItems = current.filter(a => !prevIds.has(makeId(a)));

    return {
      hasNew: newItems.length > 0,
      newItems,
      updatedState: {
        ...state,
        lastCheckAt: new Date().toISOString(),
        lastAnnouncementDate: current[0]?.date || state.lastAnnouncementDate,
        lastAnnouncementIds: current.map(makeId),
        newAnnouncements: newItems,
      },
    };
  }

  async checkNewFinancialReports(state: DisclosureMonitorState, reportType: ReportType = 'ra') {
    const { results } = await this.getFinancialReports({ reportType, sortByDate: true, pageSize: 20 });
    const last = state.financialReportState?.[reportType];
    const newItems = last ? results.filter(r => r.fileModified > last.lastModified) : results;

    return {
      hasNew: newItems.length > 0,
      newItems,
      updatedState: {
        ...state,
        financialReportState: {
          ...state.financialReportState,
          [reportType]: { lastCheckAt: new Date().toISOString(), lastModified: results[0]?.fileModified || '' },
        },
        newFinancialReports: newItems,
      },
    };
  }
}
