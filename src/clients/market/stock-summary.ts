// Market Client — Stock Summary + Top Movers
// GET /primary/Home/GetStockSummary
// GET /primary/Home/GetTopGainer, GetTopLoser, GetTopVolume, GetTopValue, GetTopFrequent

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export type TopMoverType = 'TopGainer' | 'TopLoser' | 'TopVolume' | 'TopValue' | 'TopFrequent';

export interface StockSummaryItem {
  [key: string]: any;
}

// IDX uses dedicated endpoints for each top mover category
const TOP_MOVER_ENDPOINTS: Record<TopMoverType, string> = {
  TopGainer: '/primary/Home/GetTopGainer',
  TopLoser: '/primary/Home/GetTopLoser',
  TopVolume: '/primary/Home/GetTopVolume',
  TopValue: '/primary/Home/GetTopValue',
  TopFrequent: '/primary/Home/GetTopFrequent',
};

export class StockSummaryClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  /** Ambil ringkasan semua saham */
  async getStockSummary(): Promise<StockSummaryItem[]> {
    console.log('[StockSummary] Fetching stock summary...');
    const raw = await fetchIdxApi<any>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Home/GetStockSummary',
    });
    const items = raw.Data || raw.data || raw.rows || raw;
    console.log(`[StockSummary] ${Array.isArray(items) ? items.length : 'N/A'} stocks`);
    return Array.isArray(items) ? items : [];
  }

  /** Ambil top mover (dedicated endpoint per kategori) */
  async getTopMover(type: TopMoverType, resultCount = 10): Promise<StockSummaryItem[]> {
    const endpoint = TOP_MOVER_ENDPOINTS[type];
    console.log(`[StockSummary] Fetching top ${type}...`);
    const raw = await fetchIdxApi<any>({
      landingPage: `${this.baseUrl}/`,
      apiPath: endpoint,
      params: { resultCount: String(resultCount) },
    });
    const items = raw.Data || raw.data || raw.rows || raw || [];
    console.log(`[StockSummary] Top ${type}: ${Array.isArray(items) ? items.length : 0} items`);
    return Array.isArray(items) ? items : [];
  }
}

export default StockSummaryClient;
