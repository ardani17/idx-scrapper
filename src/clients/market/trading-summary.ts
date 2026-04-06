// Market Client — Trading Summary
// GET /primary/Home/GetTradeSummary?lang=id

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface TradeSummaryData {
  // IDX returns dynamic shape — keep loose
  [key: string]: any;
}

export class TradingSummaryClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  /**
   * Ambil ringkasan trading harian (IHSG, value, volume, frequency, dll).
   */
  async getTradeSummary(): Promise<TradeSummaryData> {
    console.log('[TradingSummary] Fetching trade summary...');

    const raw = await fetchIdxApi<TradeSummaryData>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Home/GetTradeSummary',
      params: { lang: 'id' },
    });

    console.log('[TradingSummary] OK');
    return raw;
  }
}

export default TradingSummaryClient;
