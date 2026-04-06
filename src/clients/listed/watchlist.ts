// Listed Client — Special Notation & Watchlist (Papan Pemantauan Khusus)
// GET /primary/StockData/GetSpecialNotation
// GET /primary/StockData/GetWatchlistStock

import { fetchIdxApi } from '../../utils/idx-api';

export interface NotationItem {
  [key: string]: any;
}

export class WatchlistClient {
  async getSpecialNotation(): Promise<NotationItem[]> {
    console.log('[Watchlist] Fetching special notation...');

    const raw = await fetchIdxApi<{ Data: NotationItem[] }>({
      apiPath: '/primary/StockData/GetSpecialNotation',
    });

    const items = raw.Data || raw || [];
    console.log(`[Watchlist/Notation] ${Array.isArray(items) ? items.length : 'N/A'} entries`);
    return Array.isArray(items) ? items : [];
  }

  async getWatchlistStocks(): Promise<NotationItem[]> {
    console.log('[Watchlist] Fetching papan pemantauan khusus...');

    const raw = await fetchIdxApi<{ Data: NotationItem[] }>({
      apiPath: '/primary/StockData/GetWatchlistStock',
    });

    const items = raw.Data || raw || [];
    console.log(`[Watchlist/Papan] ${Array.isArray(items) ? items.length : 'N/A'} entries`);
    return Array.isArray(items) ? items : [];
  }
}

export default WatchlistClient;
