// Article Client
// GET /primary/NewsAnnouncement/GetArticle
// Response: { Items: [...] } or { Results: [...] }

import { fetchIdxApi } from '../../utils/idx-api';

export class ArticleClient {
  async getArticles(): Promise<any[]> {
    console.log('[Articles] Fetching...');
    const raw = await fetchIdxApi<{ Items?: any[]; Results?: any[] }>({
      apiPath: '/primary/NewsAnnouncement/GetArticle',
    });
    const items = raw.Items || raw.Results || [];
    console.log(`[Articles] ${items.length} entries`);
    return items;
  }
}

export default ArticleClient;
