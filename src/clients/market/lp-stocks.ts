// Market Client — Liquidity Provider (LP) Stocks
// GET /primary/StockData/GetStockLp

import { fetchIdxApi } from '../../utils/idx-api';

export interface LpStockItem {
  [key: string]: any;
}

export class LpStocksClient {
  async getLpStocks(): Promise<LpStockItem[]> {
    console.log('[LpStocks] Fetching liquidity provider stocks...');

    const raw = await fetchIdxApi<{ Data: LpStockItem[] }>({
      apiPath: '/primary/StockData/GetStockLp',
    });

    const items = raw.Data || raw || [];
    console.log(`[LpStocks] ${Array.isArray(items) ? items.length : 'N/A'} stocks`);
    return Array.isArray(items) ? items : [];
  }
}

export default LpStocksClient;
