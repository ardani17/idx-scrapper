// ETD & TD Client
// GET /primary/NewsAnnouncement/GetEtdTd?type=etd
// GET /primary/NewsAnnouncement/GetEtdTd?type=td

import { fetchIdxApi } from '../../utils/idx-api';

export class EtdTdClient {
  async getEtd(): Promise<any[]> {
    console.log('[ETD] Fetching...');
    const raw = await fetchIdxApi<{ Items?: any[]; Results?: any[] }>({
      apiPath: '/primary/NewsAnnouncement/GetEtdTd?type=etd',
    });
    const items = raw.Items || raw.Results || [];
    console.log(`[ETD] ${items.length} entries`);
    return items;
  }

  async getTd(): Promise<any[]> {
    console.log('[TD] Fetching...');
    const raw = await fetchIdxApi<{ Items?: any[]; Results?: any[] }>({
      apiPath: '/primary/NewsAnnouncement/GetEtdTd?type=td',
    });
    const items = raw.Items || raw.Results || [];
    console.log(`[TD] ${items.length} entries`);
    return items;
  }
}

export default EtdTdClient;
