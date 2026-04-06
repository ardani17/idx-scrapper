// Market Client — ETF List & INAV
// GET /primary/StockData/GetEtf
// GET /primary/StockData/GetEtfInav

import { fetchIdxApi } from '../../utils/idx-api';

export interface EtfItem {
  [key: string]: any;
}

export class EtfClient {
  async getEtfList(): Promise<EtfItem[]> {
    console.log('[ETF] Fetching ETF list...');

    const raw = await fetchIdxApi<{ Data: EtfItem[] }>({
      apiPath: '/primary/StockData/GetEtf',
    });

    const items = raw.Data || raw || [];
    console.log(`[ETF] ${Array.isArray(items) ? items.length : 'N/A'} ETFs`);
    return Array.isArray(items) ? items : [];
  }

  async getEtfInav(): Promise<EtfItem[]> {
    console.log('[ETF] Fetching ETF INAV...');

    const raw = await fetchIdxApi<{ Data: EtfItem[] }>({
      apiPath: '/primary/StockData/GetEtfInav',
    });

    const items = raw.Data || raw || [];
    console.log(`[ETF/INAV] ${Array.isArray(items) ? items.length : 'N/A'} entries`);
    return Array.isArray(items) ? items : [];
  }
}

export default EtfClient;
