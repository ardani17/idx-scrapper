// Fact Sheet Client — LQ45 Index Fact Sheet
// GET /primary/StockData/GetFactSheetLQ45

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface FactSheetLQ45 {
  [key: string]: any;
}

export class FactSheetLQ45Client {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getFactSheet(): Promise<FactSheetLQ45[]> {
    console.log('[FactSheetLQ45] Fetching LQ45 fact sheet...');

    const raw = await fetchIdxApi<{ Data: FactSheetLQ45[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/StockData/GetFactSheetLQ45',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[FactSheetLQ45] ${Array.isArray(items) ? items.length : 'N/A'} items`);
    return Array.isArray(items) ? items : [];
  }
}
