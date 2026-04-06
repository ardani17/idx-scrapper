// Admin API — API key management endpoints

import { Elysia, t } from 'elysia';
import {
  generateKey,
  listKeys,
  getKey,
  updateKey,
  deleteKey,
  getStats,
} from '../services/key-manager.ts';
import { isValidTier, type TierName } from '../services/tier-config.ts';
import { logger } from '../utils/logger.ts';

const ADMIN_KEY = process.env.ADMIN_API_KEY || 'admin-secret';

// ── Admin auth guard ────────────────────────────

function checkAdmin(request: Request): boolean {
  const key = request.headers.get('x-admin-key')
    || request.headers.get('authorization')?.replace('Bearer ', '');
  return key === ADMIN_KEY;
}

// ── Routes ──────────────────────────────────────

export const adminRoutes = new Elysia({ prefix: '/admin' })

  // ── Generate API key ──────────────────────────
  .post('/keys/generate', async ({ request, body, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    if (!body.name || !body.tier) {
      set.status = 400;
      return { success: false, error: 'Missing required fields: name, tier', statusCode: 400 };
    }

    if (!isValidTier(body.tier)) {
      set.status = 400;
      return { success: false, error: `Invalid tier. Must be one of: ${Object.keys({ free: 1, basic: 1, pro: 1, advanced: 1 }).join(', ')}`, statusCode: 400 };
    }

    // Advanced tier requires custom limits
    if (body.tier === 'advanced') {
      if (!body.rateLimit && !body.dailyLimit) {
        set.status = 400;
        return {
          success: false,
          error: 'Advanced tier requires rateLimit and/or dailyLimit',
          statusCode: 400,
        };
      }
    }

    try {
      const key = generateKey({
        name: body.name,
        tier: body.tier as TierName,
        email: body.email,
        rateLimit: body.rateLimit,
        dailyLimit: body.dailyLimit,
      });

      logger.info('API key generated', { id: key.id, name: key.name, tier: key.tier });

      // Return full key only on generation
      return {
        success: true,
        data: {
          key: key.key,
          keyId: key.id,
          name: key.name,
          tier: key.tier,
          rateLimit: key.rateLimit,
          dailyLimit: key.dailyLimit,
          createdAt: key.createdAt,
        },
      };
    } catch (err) {
      logger.error('Failed to generate key', { error: String(err) });
      set.status = 500;
      return { success: false, error: 'Failed to generate key', statusCode: 500 };
    }
  }, {
    body: t.Object({
      name: t.String(),
      tier: t.String(),
      email: t.Optional(t.String()),
      rateLimit: t.Optional(t.Number()),
      dailyLimit: t.Optional(t.Number()),
    }),
  })

  // ── List all keys ─────────────────────────────
  .get('/keys', ({ request, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const keys = listKeys();
    return { success: true, data: keys };
  })

  // ── Get key detail ────────────────────────────
  .get('/keys/:id', ({ request, params, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const key = getKey(params.id);
    if (!key) {
      set.status = 404;
      return { success: false, error: 'Key not found', statusCode: 404 };
    }

    return { success: true, data: key };
  })

  // ── Update key ────────────────────────────────
  .patch('/keys/:id', ({ request, params, body, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.tier !== undefined) updates.tier = body.tier;
    if (body.active !== undefined) updates.active = body.active;
    if (body.rateLimit !== undefined) updates.rateLimit = body.rateLimit;
    if (body.dailyLimit !== undefined) updates.dailyLimit = body.dailyLimit;

    if (Object.keys(updates).length === 0) {
      set.status = 400;
      return { success: false, error: 'No fields to update', statusCode: 400 };
    }

    if (body.tier && !isValidTier(body.tier)) {
      set.status = 400;
      return { success: false, error: 'Invalid tier', statusCode: 400 };
    }

    const result = updateKey(params.id, updates);
    if (!result) {
      set.status = 404;
      return { success: false, error: 'Key not found', statusCode: 404 };
    }

    logger.info('API key updated', { id: params.id, updates: Object.keys(updates) });

    return { success: true, data: result };
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      tier: t.Optional(t.String()),
      active: t.Optional(t.Boolean()),
      rateLimit: t.Optional(t.Number()),
      dailyLimit: t.Optional(t.Number()),
    }),
  })

  // ── Delete key ────────────────────────────────
  .delete('/keys/:id', ({ request, params, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const ok = deleteKey(params.id);
    if (!ok) {
      set.status = 404;
      return { success: false, error: 'Key not found', statusCode: 404 };
    }

    logger.info('API key revoked', { id: params.id });

    return { success: true, message: 'Key revoked' };
  })

  // ── Usage stats ───────────────────────────────
  .get('/stats', ({ request, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const stats = getStats();
    return { success: true, data: stats };
  });
