// Market Client — Suspend Data
// GET /primary/Home/GetSuspendData

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface SuspendDataItem {
  [key: string]: any;
}

export class SuspendDataClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  /**
   * Ambil data saham yang di-suspend (penghentian sementara perdagangan).
   */
  async getSuspendData(): Promise<SuspendDataItem[]> {
    console.log('[SuspendData] Fetching suspend data...');

    const raw = await fetchIdxApi<{ Data: SuspendDataItem[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Home/GetSuspendData',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[SuspendData] ${Array.isArray(items) ? items.length : 'N/A'} suspended`);
    return Array.isArray(items) ? items : [];
  }
}

export default SuspendDataClient;
