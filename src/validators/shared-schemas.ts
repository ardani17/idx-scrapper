// Shared Elysia validation schemas for IDX Scraper endpoints

import { t } from 'elysia';

// ── Pagination ──────────────────────────────────

export const PaginationQuery = t.Object({
  pageSize: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
  indexFrom: t.Optional(t.Integer({ minimum: 0, default: 0 })),
  page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
});

// ── Date Range ──────────────────────────────────

export const DateRangeQuery = t.Object({
  dateFrom: t.Optional(t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
  dateTo: t.Optional(t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
});

// ── Stock Code ──────────────────────────────────

export const StockCodeParam = t.Object({
  stockCode: t.String({ pattern: '^[A-Z]{3,6}$' }),
});

// ── Create API Key Body ─────────────────────────

export const CreateKeyBody = t.Object({
  name: t.String({ minLength: 1 }),
  tier: t.Union([
    t.Literal('free'),
    t.Literal('basic'),
    t.Literal('pro'),
    t.Literal('advanced'),
  ]),
  email: t.Optional(t.String({ format: 'email' })),
  rateLimit: t.Optional(t.Integer({ minimum: 1 })),
  dailyLimit: t.Optional(t.Integer({ minimum: 1 })),
});
