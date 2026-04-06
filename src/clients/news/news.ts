// News Client — Berita & Pengumuman
// GET /primary/NewsAnnouncement/GetNewsSearch
// Response: { Items: [...], ItemCount, PageSize, PageNumber, PageCount }

import { fetchIdxApi } from '../../utils/idx-api';

export class NewsClient {
  async getNews(): Promise<any[]> {
    console.log('[News] Fetching news...');
    const raw = await fetchIdxApi<{ Items?: any[]; ItemCount?: number }>({
      apiPath: '/primary/NewsAnnouncement/GetNewsSearch',
    });
    const items = raw.Items || [];
    console.log(`[News] ${items.length} entries (ItemCount: ${raw.ItemCount ?? '?'})`);
    return items;
  }
}

export default NewsClient;
