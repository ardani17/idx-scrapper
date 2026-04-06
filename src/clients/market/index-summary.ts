// Market Client — Index Summary (Index List)
// GET /primary/home/GetIndexList

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface IndexSummaryItem {
  [key: string]: any;
}

export class IndexSummaryClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  /**
   * Ambil daftar indeks (IHSG, LQ45, IDX30, dll) + nilai terkini.
   */
  async getIndexList(): Promise<IndexSummaryItem[]> {
    console.log('[IndexSummary] Fetching index list...');

    const raw = await fetchIdxApi<{ Data: IndexSummaryItem[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/home/GetIndexList',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[IndexSummary] ${Array.isArray(items) ? items.length : 'N/A'} indexes`);
    return Array.isArray(items) ? items : [];
  }
}

export default IndexSummaryClient;
