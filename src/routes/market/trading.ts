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
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Trading summary',
        description: 'Daily trading summary including total transactions, volume, value, and frequency across all boards (regular, negotiation, cash).',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          200: { description: 'Trading summary data', content: { 'application/json': { example: { success: true, data: [{ board: 'RG', totalTransaction: 350000 }], fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
        },
      },
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
    }, {
      detail: {
        tags: ['Market'],
        summary: 'Broker summary',
        description: 'Top broker rankings by transaction value and frequency. Shows buying/selling activity per securities firm.',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          200: { description: 'Broker summary data', content: { 'application/json': { example: { success: true, data: [{ brokerCode: 'YP', brokerName: 'Mirae Asset', totalValue: 500000000000 }], fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    });
}
