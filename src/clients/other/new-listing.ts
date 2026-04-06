// New Listing Client — IPO / Relisting info
// GET /primary/StockData/GetNewListing

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface NewListing {
  [key: string]: any;
}

export class NewListingClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getNewListings(): Promise<NewListing[]> {
    console.log('[NewListing] Fetching new listing data...');

    const raw = await fetchIdxApi<{ Data: NewListing[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/StockData/GetNewListing',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[NewListing] ${Array.isArray(items) ? items.length : 'N/A'} items`);
    return Array.isArray(items) ? items : [];
  }
}
