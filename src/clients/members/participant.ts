// Members Client — Partisipan Bursa
// GET /primary/Member/GetParticipant

import { fetchIdxApi } from '../../utils/idx-api';
import { DEFAULT_CONFIG } from '../../types';

export interface Participant {
  [key: string]: any;
}

export class ParticipantClient {
  private readonly baseUrl: string;

  constructor(config?: { idxBaseUrl?: string }) {
    this.baseUrl = config?.idxBaseUrl || DEFAULT_CONFIG.idxBaseUrl;
  }

  async getParticipants(): Promise<Participant[]> {
    console.log('[Participant] Fetching participant list...');

    const raw = await fetchIdxApi<{ Data: Participant[] }>({
      landingPage: `${this.baseUrl}/`,
      apiPath: '/primary/Member/GetParticipant',
    });

    const items = raw.Data || raw.data || raw || [];
    console.log(`[Participant] ${Array.isArray(items) ? items.length : 'N/A'} participants`);
    return Array.isArray(items) ? items : [];
  }
}
