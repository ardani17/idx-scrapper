// Statistics Client — IDX Market Statistics
// GET /primary/StockData/GetStockSummary (reused for stats)

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface Statistic {
  [key: string]: any;
}

export class StatisticsClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getStatistics(): Promise<Statistic[]> {
    console.log('[Statistics] Fetching IDX market statistics...');

    const raw = await fetchIdxApi<{ Data: Statistic[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/StockData/GetStockSummary',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[Statistics] ${Array.isArray(items) ? items.length : 'N/A'} items`);
    return Array.isArray(items) ? items : [];
  }
}
