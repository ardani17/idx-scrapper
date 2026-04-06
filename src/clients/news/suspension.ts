// Suspension Client
// GET /primary/NewsAnnouncement/GetSuspension
// Response: { Items: [...] } or { Results: [...] }

import { fetchIdxApi } from '../../utils/idx-api';

export class SuspensionClient {
  async getSuspension(): Promise<any[]> {
    console.log('[Suspension] Fetching...');
    const raw = await fetchIdxApi<{ Items?: any[]; Results?: any[] }>({
      apiPath: '/primary/NewsAnnouncement/GetSuspension',
    });
    const items = raw.Items || raw.Results || [];
    console.log(`[Suspension] ${items.length} entries`);
    return items;
  }
}

export default SuspensionClient;
