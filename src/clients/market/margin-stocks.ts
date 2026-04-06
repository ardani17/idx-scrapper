// Market Client — Margin Stocks & Short Selling
// GET /primary/StockData/GetMarginStock

import { fetchIdxApi } from '../../utils/idx-api';

export interface MarginStockItem {
  [key: string]: any;
}

export class MarginStocksClient {
  async getMarginStocks(): Promise<MarginStockItem[]> {
    console.log('[MarginStocks] Fetching margin & short selling stocks...');

    const raw = await fetchIdxApi<{ Data: MarginStockItem[] }>({
      apiPath: '/primary/StockData/GetMarginStock',
    });

    const items = raw.Data || raw || [];
    console.log(`[MarginStocks] ${Array.isArray(items) ? items.length : 'N/A'} stocks`);
    return Array.isArray(items) ? items : [];
  }
}

export default MarginStocksClient;
