// Trading Holiday Client
// GET /primary/Home/GetTradingHoliday

import { fetchIdxApi } from '../../utils/idx-api';

export class TradingHolidayClient {
  async getTradingHoliday(): Promise<any[]> {
    console.log('[TradingHoliday] Fetching...');
    const raw = await fetchIdxApi<{ Items?: any[]; Results?: any[]; Data?: any[] }>({
      apiPath: '/primary/Home/GetTradingHoliday',
    });
    const items = raw.Items || raw.Results || raw.Data || [];
    console.log(`[TradingHoliday] ${items.length} entries`);
    return items;
  }
}

export default TradingHolidayClient;
