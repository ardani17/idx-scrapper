// Market Routes — Trading Summary & Broker Summary
// GET /api/market/trading-summary
// GET /api/market/broker-summary

import { Elysia } from 'elysia';
import type { TradingSummaryClient } from '../../clients/market/trading-summary';
import type { BrokerSummaryClient } from '../../clients/market/broker-summary';
import { marketCache } from '../../utils/cache';

export function tradingRoutes(
  trading: TradingSummaryClient,
  broker: BrokerSummaryClient,
) {
  return new Elysia()

    // ── Trading Summary ─────────────────────────
    .get('/trading-summary', async () => {
      try {
        const cached = marketCache.get('/trading-summary');
        if (cached) return { ...cached, _cached: true };

        const data = await trading.getTradeSummary();
        const result = {
          success: true,
          data,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/trading-summary', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    })

    // ── Broker Summary ──────────────────────────
    .get('/broker-summary', async () => {
      try {
        const cached = marketCache.get('/broker-summary');
        if (cached) return { ...cached, _cached: true };

        const data = await broker.getBrokerSummary();
        const result = {
          success: true,
          data,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/',
          _cached: false,
        };
        marketCache.set('/broker-summary', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    });
}
