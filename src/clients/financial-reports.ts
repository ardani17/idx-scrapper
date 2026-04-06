// Financial Reports Client — Laporan Keuangan IDX
// Dipisah dari disclosure-client.ts untuk maintainability

import { createPage } from '../utils/browser';
import type { FinancialReport, ReportType } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { logger } from '../utils/logger';

export class FinancialReportsClient {
  private baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  /**
   * Ambil laporan keuangan dari IDX JSON API.
   * Endpoint ini return JSON langsung saat di-navigate (bukan via XHR).
   *
   * @param params - Filter & pagination options
   * @returns Results + total count
   */
  async getFinancialReports(params: {
    reportType?: ReportType;
    year?: number;
    kodeEmiten?: string;
    pageSize?: number;
    sortByDate?: boolean;
    periode?: string;
  } = {}): Promise<{ results: FinancialReport[]; totalCount: number }> {
    const page = await createPage();
    try {
      const {
        reportType = 'ra', year = new Date().getFullYear(),
        kodeEmiten = '', pageSize = 50, sortByDate = true, periode,
      } = params;

      // Build the URL — empty periode parameter returns all
      const periodeParam = periode || '';

      const url = `${this.baseUrl}/primary/ListedCompany/GetFinancialReport?` +
        `indexFrom=1&pageSize=${pageSize}&year=${year}&reportType=${reportType}` +
        `&EmitenType=s&periode=${encodeURIComponent(periodeParam)}` +
        `&kodeEmiten=${encodeURIComponent(kodeEmiten)}` +
        `&SortColumn=${sortByDate ? 'created_at' : 'KodeEmiten'}&SortOrder=${sortByDate ? 'desc' : 'asc'}`;

      logger.debug('Fetching financial reports', { url, reportType, year, periode: periodeParam });

      const resp = await page.goto(url, { timeout: 30000 });
      if (!resp || resp.status() !== 200) throw new Error(`HTTP ${resp?.status()}`);

      const data = await page.evaluate(() => {
        try { return JSON.parse(document.body.innerText || '{}'); } catch { return {}; }
      });

      const results: FinancialReport[] = (data.Results || []).map((r: any) => ({
        kodeEmiten: r.KodeEmiten || '',
        namaEmiten: r.NamaEmiten || '',
        reportYear: r.Report_Year || '',
        reportPeriod: r.Report_Period || null,
        fileModified: r.File_Modified || '',
        attachments: (r.Attachments || []).map((a: any) => ({
          emitenCode: a.Emiten_Code || '', fileId: a.File_ID || '',
          fileModified: a.File_Modified || '', fileName: a.File_Name || '', filePath: a.File_Path || '',
        })),
      }));

      logger.info('Financial reports fetched', {
        count: results.length,
        total: data.ResultCount,
        reportType, year,
      });

      return { results, totalCount: data.ResultCount || 0 };
    } finally {
      await page.close();
    }
  }

  /**
   * Fetch financial reports with period fallback.
   * If no periode is specified, tries empty (all), then 'annual', then 'quarterly'.
   */
  async getFinancialReportsWithFallback(params: {
    reportType?: ReportType;
    year?: number;
    kodeEmiten?: string;
    pageSize?: number;
    sortByDate?: boolean;
    periode?: string;
  } = {}): Promise<{ results: FinancialReport[]; totalCount: number; usedPeriode: string }> {
    const { periode } = params;

    if (periode) {
      // Specific periode requested — use it directly
      const result = await this.getFinancialReports(params);
      return { ...result, usedPeriode: periode };
    }

    // Try empty periode first (returns all periods)
    const empty = await this.getFinancialReports(params);
    if (empty.results.length > 0) {
      return { ...empty, usedPeriode: 'all' };
    }

    // Fallback: try 'annual'
    const annual = await this.getFinancialReports({ ...params, periode: 'annual' });
    if (annual.results.length > 0) {
      return { ...annual, usedPeriode: 'annual' };
    }

    // Fallback: try 'quarterly'
    const quarterly = await this.getFinancialReports({ ...params, periode: 'quarterly' });
    if (quarterly.results.length > 0) {
      return { ...quarterly, usedPeriode: 'quarterly' };
    }

    // All attempts returned empty
    logger.warn('All period fallbacks returned empty', { reportType: params.reportType, year: params.year });
    return { results: [], totalCount: 0, usedPeriode: 'none' };
  }
}
