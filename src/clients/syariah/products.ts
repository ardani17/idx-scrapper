// Syariah Client — Produk Syariah (Daftar saham syariah)
// GET /primary/StockData/GetListedCompanySyariah

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface SyariahProduct {
  [key: string]: any;
}

export class SyariahProductsClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getSyariahProducts(): Promise<SyariahProduct[]> {
    console.log('[SyariahProducts] Fetching syariah stock list...');

    const raw = await fetchIdxApi<{ Data: SyariahProduct[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/StockData/GetListedCompanySyariah',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[SyariahProducts] ${Array.isArray(items) ? items.length : 'N/A'} items`);
    return Array.isArray(items) ? items : [];
  }
}
