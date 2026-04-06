// Members Routes — Anggota Bursa
// GET /api/members/brokers      — Daftar Anggota Bursa (Sekuritas)
// GET /api/members/participants  — Daftar Partisipan

import { Elysia } from 'elysia';
import { BrokerClient } from '../../clients/members/broker';
import { ParticipantClient } from '../../clients/members/participant';
import { slowCache } from '../../utils/cache';

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
    });
}
