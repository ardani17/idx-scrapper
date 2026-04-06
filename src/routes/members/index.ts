// Members Routes — Anggota Bursa
// GET /api/members/brokers      — Daftar Anggota Bursa (Sekuritas)
// GET /api/members/participants  — Daftar Partisipan

import { Elysia } from 'elysia';
import { BrokerClient } from '../../clients/members/broker';
import { ParticipantClient } from '../../clients/members/participant';
import { slowCache } from '../../utils/cache';

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
    .get('/brokers', async () => {
      try {
        const cached = slowCache.get('/members/brokers');
        if (cached) return { ...cached, _cached: true };

        const data = await brokers.getBrokers();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/members/brokers', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
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
    .get('/participants', async () => {
      try {
        const cached = slowCache.get('/members/participants');
        if (cached) return { ...cached, _cached: true };

        const data = await participants.getParticipants();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/members/participants', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
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
