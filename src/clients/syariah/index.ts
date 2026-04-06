// Syariah Client — Indeks Syariah
// GET /primary/Syariah/GetSyariahIndex

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface SyariahIndex {
  [key: string]: any;
}

export class SyariahIndexClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getSyariahIndex(): Promise<SyariahIndex[]> {
    console.log('[SyariahIndex] Fetching syariah index...');

    const raw = await fetchIdxApi<{ Data: SyariahIndex[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Syariah/GetSyariahIndex',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[SyariahIndex] ${Array.isArray(items) ? items.length : 'N/A'} indexes`);
    return Array.isArray(items) ? items : [];
  }
}
