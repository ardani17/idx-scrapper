// Market Client — Bond & Sukuk Summary
// GET /primary/Home/GetBondSummary

import { fetchIdxApi } from '../../utils/idx-api';

export interface BondSummaryItem {
  [key: string]: any;
}

export class BondSummaryClient {
  async getBondSummary(): Promise<BondSummaryItem[]> {
    console.log('[BondSummary] Fetching bond & sukuk summary...');

    const raw = await fetchIdxApi<{ Data: BondSummaryItem[] }>({
      apiPath: '/primary/Home/GetBondSummary',
    });

    const items = raw.Data || raw || [];
    console.log(`[BondSummary] ${Array.isArray(items) ? items.length : 'N/A'} entries`);
    return Array.isArray(items) ? items : [];
  }
}

export default BondSummaryClient;
