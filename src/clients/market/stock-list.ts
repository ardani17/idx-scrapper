// Market Client — Stock List (Full Listed Companies)
// GET /primary/ListedCompany/GetCompanies?type=shares&pageSize=500

import { fetchIdxApi } from '../../utils/idx-api';

export interface StockListItem {
  [key: string]: any;
}

export class StockListClient {
  /**
   * Ambil daftar lengkap saham tercatat.
   * @param type - 'shares' | 'bonds' | 'etf'
   * @param page - halaman (mulai 1)
   * @param pageSize - per halaman (max ~500)
   */
  async getStockList(
    type: string = 'shares',
    page: number = 1,
    pageSize: number = 500,
  ): Promise<{ data: StockListItem[]; total: number; page: number }> {
    console.log(`[StockList] Fetching ${type} page ${page}...`);

    const raw = await fetchIdxApi<any>({
      apiPath: '/primary/ListedCompany/GetCompanies',
      params: { type, page: String(page), pageSize: String(pageSize) },
    });

    const items = raw.Data || raw.data || raw || [];
    const list = Array.isArray(items) ? items : [];

    console.log(`[StockList] ${list.length} companies (page ${page})`);

    return {
      data: list,
      total: raw.TotalRecord || raw.total || list.length,
      page,
    };
  }
}

export default StockListClient;
