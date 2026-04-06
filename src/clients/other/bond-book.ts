// Bond Book Client — Bond Order Book
// GET /primary/BondSukuk/GetBondBook

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface BondBook {
  [key: string]: any;
}

export class BondBookClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getBondBook(): Promise<BondBook[]> {
    console.log('[BondBook] Fetching bond book data...');

    const raw = await fetchIdxApi<{ Data: BondBook[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/BondSukuk/GetBondBook',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[BondBook] ${Array.isArray(items) ? items.length : 'N/A'} items`);
    return Array.isArray(items) ? items : [];
  }
}
