// Syariah Client — Transaksi Sesuai Syariah
// GET /primary/Syariah/GetSyariahTransaction

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface SyariahTransaction {
  [key: string]: any;
}

export class SyariahTransactionClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getSyariahTransaction(): Promise<SyariahTransaction[]> {
    console.log('[SyariahTransaction] Fetching syariah transaction data...');

    const raw = await fetchIdxApi<{ Data: SyariahTransaction[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Syariah/GetSyariahTransaction',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[SyariahTransaction] ${Array.isArray(items) ? items.length : 'N/A'} items`);
    return Array.isArray(items) ? items : [];
  }
}
