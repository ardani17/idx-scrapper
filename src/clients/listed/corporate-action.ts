// Listed Client — Corporate Action
// GET /primary/ListedCompany/GetCorporateAction

import { fetchIdxApi } from '../../utils/idx-api';

export interface CorporateActionItem {
  [key: string]: any;
}

export class CorporateActionClient {
  async getCorporateAction(): Promise<CorporateActionItem[]> {
    console.log('[CorporateAction] Fetching...');

    const raw = await fetchIdxApi<{ Data: CorporateActionItem[] }>({
      apiPath: '/primary/ListedCompany/GetCorporateAction',
    });

    const items = raw.Data || raw || [];
    console.log(`[CorporateAction] ${Array.isArray(items) ? items.length : 'N/A'} entries`);
    return Array.isArray(items) ? items : [];
  }
}

export default CorporateActionClient;
