// Listed Client — Calendar Emiten
// GET /primary/ListedCompany/GetCalendar

import { fetchIdxApi } from '../../utils/idx-api';

export interface CalendarItem {
  [key: string]: any;
}

export class CalendarClient {
  async getCalendar(): Promise<CalendarItem[]> {
    console.log('[Calendar] Fetching emiten calendar...');

    const raw = await fetchIdxApi<{ Data: CalendarItem[] }>({
      apiPath: '/primary/ListedCompany/GetCalendar',
    });

    const items = raw.Data || raw || [];
    console.log(`[Calendar] ${Array.isArray(items) ? items.length : 'N/A'} entries`);
    return Array.isArray(items) ? items : [];
  }
}

export default CalendarClient;
