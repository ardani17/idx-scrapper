// Market Client — Pre-Opening Stocks
// GET /primary/StockData/GetPreOpenStock

import { fetchIdxApi } from '../../utils/idx-api';

export interface PreOpenStockItem {
  [key: string]: any;
}

export class PreOpenStocksClient {
  async getPreOpenStocks(): Promise<PreOpenStockItem[]> {
    console.log('[PreOpen] Fetching pre-opening stocks...');

    const raw = await fetchIdxApi<{ Data: PreOpenStockItem[] }>({
      apiPath: '/primary/StockData/GetPreOpenStock',
    });

    const items = raw.Data || raw || [];
    console.log(`[PreOpen] ${Array.isArray(items) ? items.length : 'N/A'} stocks`);
    return Array.isArray(items) ? items : [];
  }
}

export default PreOpenStocksClient;
