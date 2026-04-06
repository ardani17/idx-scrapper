// Press Release Client
// GET /primary/NewsAnnouncement/GetPressRelease
// Response: { Items: [...], ItemCount, PageSize, PageNumber, PageCount }

import { fetchIdxApi } from '../../utils/idx-api';

export class PressReleaseClient {
  async getPressRelease(): Promise<any[]> {
    console.log('[PressRelease] Fetching...');
    const raw = await fetchIdxApi<{ Items?: any[]; ItemCount?: number }>({
      apiPath: '/primary/NewsAnnouncement/GetPressRelease',
    });
    const items = raw.Items || [];
    console.log(`[PressRelease] ${items.length} entries (ItemCount: ${raw.ItemCount ?? '?'})`);
    return items;
  }
}

export default PressReleaseClient;
