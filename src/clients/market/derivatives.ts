// Market Client — Derivatives Summary
// GET /primary/Home/GetDerivativeSummary

import { fetchIdxApi } from '../../utils/idx-api';

export interface DerivativeItem {
  [key: string]: any;
}

export class DerivativesClient {
  async getDerivativeSummary(): Promise<DerivativeItem[]> {
    console.log('[Derivatives] Fetching derivatives summary...');

    const raw = await fetchIdxApi<{ Data: DerivativeItem[] }>({
      apiPath: '/primary/Home/GetDerivativeSummary',
    });

    const items = raw.Data || raw || [];
    console.log(`[Derivatives] ${Array.isArray(items) ? items.length : 'N/A'} entries`);
    return Array.isArray(items) ? items : [];
  }
}

export default DerivativesClient;
