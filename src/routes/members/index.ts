// Members Routes — Anggota Bursa
// GET /api/members/brokers      — Daftar Anggota Bursa (Sekuritas)
// GET /api/members/participants  — Daftar Partisipan

import { Elysia } from 'elysia';
import { BrokerClient } from '../../clients/members/broker';
import { ParticipantClient } from '../../clients/members/participant';
import { slowCache } from '../../utils/cache';
import { cachedScrape } from '../../utils/cached-scrape';

const SLOW_TTL_MS = 900_000;
const SLOW_MAX_AGE = 900;

const security = [{ ApiKeyAuth: [] }];
const errResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  429: { $ref: '#/components/responses/RateLimited' },
  503: { $ref: '#/components/responses/ServiceUnavailable' },
};

export function membersRoutes() {
  const brokers = new BrokerClient();
  const participants = new ParticipantClient();

  return new Elysia({ prefix: '/members' })

    // ── Anggota Bursa (Sekuritas) ────────────────
    .get('/brokers', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/members/brokers',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => brokers.getBrokers(),
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Members'],
        summary: 'Exchange members (brokers)',
        description: 'List of all registered securities firms (brokers) that are members of IDX.',
        security,
        responses: {
          200: { description: 'Broker list', content: { 'application/json': { example: { success: true, data: [{ brokerCode: 'YP', brokerName: 'Mirae Asset Sekuritas', address: 'Jakarta', status: 'Active' }], total: 100, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    })

    // ── Partisipan ───────────────────────────────
    .get('/participants', async ({ set }) => {
      const { data, cached } = await cachedScrape({
        cache: slowCache,
        cacheKey: '/members/participants',
        ttlMs: SLOW_TTL_MS,
        requestId: 'no-request-id',
        scraper: () => participants.getParticipants(),
      });
      set.headers['Cache-Control'] = `max-age=${SLOW_MAX_AGE}`;
      return {
        success: true, data,
        total: Array.isArray(data) ? data.length : 0,
        fetchedAt: new Date().toISOString(),
        _source: 'https://www.idx.co.id/', _cached: cached,
      };
    }, {
      detail: {
        tags: ['Members'],
        summary: 'Exchange participants',
        description: 'List of all exchange participants including custodians, administrators, and other participants.',
        security,
        responses: {
          200: { description: 'Participant list', content: { 'application/json': { example: { success: true, data: [{ participantCode: 'KP', participantName: 'Kustodian Sentral Efek Indonesia', type: 'KSEI' }], total: 50, fetchedAt: '2025-01-01T00:00:00.000Z', _cached: false } } } },
          ...errResponses,
        },
      },
    });
}
