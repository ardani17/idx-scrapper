// Market Client — Broker Summary
// GET /primary/Home/GetBrokerSummary

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface BrokerSummaryItem {
  [key: string]: any;
}

export class BrokerSummaryClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  /**
   * Ambil ringkasan broker (net buy/sell, frequency, dll).
   */
  async getBrokerSummary(): Promise<BrokerSummaryItem[]> {
    console.log('[BrokerSummary] Fetching broker summary...');

    const raw = await fetchIdxApi<any>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Home/GetBrokerSummary',
    });

    const items = raw.Data || raw.data || raw.rows || raw || [];
    console.log(`[BrokerSummary] ${Array.isArray(items) ? items.length : 'N/A'} brokers`);
    return Array.isArray(items) ? items : [];
  }
}

export default BrokerSummaryClient;
