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

const sec = [{ AdminKeyAuth: [] }];

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

    if (body.tier === 'advanced') {
      if (!body.rateLimit && !body.dailyLimit) {
        set.status = 400;
        return { success: false, error: 'Advanced tier requires rateLimit and/or dailyLimit', statusCode: 400 };
      }
    }

    try {
      const key = await generateKey({
        name: body.name,
        tier: body.tier as TierName,
        email: body.email,
        rateLimit: body.rateLimit,
        dailyLimit: body.dailyLimit,
      });

      logger.info('API key generated', { id: key.id, name: key.name, tier: key.tier });

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
    detail: {
      tags: ['Admin'],
      summary: 'Generate API key',
      description: 'Generate a new API key with specified tier and limits. The full key is returned only on generation. Requires X-Admin-Key header.',
      security: sec,
      responses: {
        200: { description: 'API key generated', content: { 'application/json': { example: { success: true, data: { key: 'idx_live_xxxxxxxxxxxx', keyId: 'abc123', name: 'Test User', tier: 'basic', rateLimit: 60, dailyLimit: 1000, createdAt: '2025-01-01T00:00:00.000Z' } } } } },
        400: { description: 'Invalid request body or tier' },
        401: { description: 'Invalid admin key' },
      },
    },
  })

  // ── List all keys ─────────────────────────────
  .get('/keys', async ({ request, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const keys = await listKeys();
    return { success: true, data: keys };
  }, {
    detail: {
      tags: ['Admin'],
      summary: 'List all API keys',
      description: 'List all registered API keys with metadata (keys are masked). Requires X-Admin-Key header.',
      security: sec,
      responses: {
        200: { description: 'Key list', content: { 'application/json': { example: { success: true, data: [{ id: 'abc123', name: 'Test User', tier: 'basic', active: true, createdAt: '2025-01-01T00:00:00.000Z' }] } } } },
        401: { description: 'Invalid admin key' },
      },
    },
  })

  // ── Get key detail ────────────────────────────
  .get('/keys/:id', async ({ request, params, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const key = await getKey(params.id);
    if (!key) {
      set.status = 404;
      return { success: false, error: 'Key not found', statusCode: 404 };
    }

    return { success: true, data: key };
  }, {
    detail: {
      tags: ['Admin'],
      summary: 'Get API key detail',
      description: 'Get detailed information about a specific API key by ID. Requires X-Admin-Key header.',
      security: sec,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'API key ID' },
      ],
      responses: {
        200: { description: 'Key details', content: { 'application/json': { example: { success: true, data: { id: 'abc123', name: 'Test User', tier: 'basic', active: true, rateLimit: 60, dailyLimit: 1000 } } } } },
        401: { description: 'Invalid admin key' },
        404: { description: 'Key not found' },
      },
    },
  })

  // ── Update key ────────────────────────────────
  .patch('/keys/:id', async ({ request, params, body, set }) => {
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

    const result = await updateKey(params.id, updates);
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
    detail: {
      tags: ['Admin'],
      summary: 'Update API key',
      description: 'Update properties of an existing API key (name, tier, active status, limits). Requires X-Admin-Key header.',
      security: sec,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'API key ID' },
      ],
      responses: {
        200: { description: 'Key updated', content: { 'application/json': { example: { success: true, data: { id: 'abc123', name: 'Updated Name', tier: 'pro', active: true } } } } },
        400: { description: 'Invalid request or tier' },
        401: { description: 'Invalid admin key' },
        404: { description: 'Key not found' },
      },
    },
  })

  // ── Delete key ────────────────────────────────
  .delete('/keys/:id', async ({ request, params, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const ok = await deleteKey(params.id);
    if (!ok) {
      set.status = 404;
      return { success: false, error: 'Key not found', statusCode: 404 };
    }

    logger.info('API key revoked', { id: params.id });

    return { success: true, message: 'Key revoked' };
  }, {
    detail: {
      tags: ['Admin'],
      summary: 'Delete API key',
      description: 'Permanently revoke and delete an API key. Requires X-Admin-Key header.',
      security: sec,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'API key ID' },
      ],
      responses: {
        200: { description: 'Key revoked', content: { 'application/json': { example: { success: true, message: 'Key revoked' } } } },
        401: { description: 'Invalid admin key' },
        404: { description: 'Key not found' },
      },
    },
  })

  // ── Usage stats ───────────────────────────────
  .get('/stats', async ({ request, set }) => {
    if (!checkAdmin(request)) {
      set.status = 401;
      return { success: false, error: 'Invalid admin key', statusCode: 401 };
    }

    const stats = await getStats();
    return { success: true, data: stats };
  }, {
    detail: {
      tags: ['Admin'],
      summary: 'API usage statistics',
      description: 'Get aggregate usage statistics across all API keys. Requires X-Admin-Key header.',
      security: sec,
      responses: {
        200: { description: 'Usage stats', content: { 'application/json': { example: { success: true, data: { totalKeys: 10, activeKeys: 8, totalRequestsToday: 15000, totalRequestsAllTime: 500000 } } } } },
        401: { description: 'Invalid admin key' },
      },
    },
  });
