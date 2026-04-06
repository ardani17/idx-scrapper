// Members Client — Anggota Bursa (Broker/Sekuritas)
// GET /primary/Member/GetMemberOrBroker

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface Broker {
  [key: string]: any;
}

export class BrokerClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getBrokers(): Promise<Broker[]> {
    console.log('[Broker] Fetching member/broker list...');

    const raw = await fetchIdxApi<{ Data: Broker[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Member/GetMemberOrBroker',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[Broker] ${Array.isArray(items) ? items.length : 'N/A'} brokers`);
    return Array.isArray(items) ? items : [];
  }
}
