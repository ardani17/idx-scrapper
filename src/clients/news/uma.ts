// UMA Client (Urgent Market Activity)
// GET /primary/NewsAnnouncement/GetUMA
// Response: { SearchCriteria: {}, ResultCount, Results: [...] }

import { fetchIdxApi } from '../../utils/idx-api';

export class UmaClient {
  async getUma(): Promise<any[]> {
    console.log('[UMA] Fetching urgent market activity...');
    const raw = await fetchIdxApi<{ Results?: any[]; ResultCount?: number }>({
      apiPath: '/primary/NewsAnnouncement/GetUMA',
    });
    const items = raw.Results || [];
    console.log(`[UMA] ${items.length} entries (ResultCount: ${raw.ResultCount ?? '?'})`);
    return items;
  }
}

export default UmaClient;
