// CORS Middleware — Configurable CORS with environment-based origins
// Requirements: 10.4

import { logger } from '../utils/logger';

// ── Interfaces ──────────────────────────────────

export interface CorsConfig {
  allowedOrigins: string[];  // from env ALLOWED_ORIGINS (comma-separated)
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;            // seconds
}

// ── Constants ───────────────────────────────────

const DEFAULT_ORIGINS = [
  'https://cloudnexify.com',
  'https://idx.cloudnexify.com',
  'https://app.cloudnexify.com',
];

const DEFAULT_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];

const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-API-Key',
  'X-Admin-Key',
];

const DEFAULT_MAX_AGE = 86400; // 24 hours

// ── Configuration ───────────────────────────────

/**
 * Build CORS configuration from environment variables.
 * Reads ALLOWED_ORIGINS as a comma-separated string.
 * Falls back to default origins if not set or empty.
 */
export function getCorsConfig(): CorsConfig {
  const envOrigins = process.env.ALLOWED_ORIGINS;

  let allowedOrigins: string[];

  if (envOrigins && envOrigins.trim().length > 0) {
    allowedOrigins = envOrigins
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  } else {
    allowedOrigins = [...DEFAULT_ORIGINS];
  }

  return {
    allowedOrigins,
    allowedMethods: [...DEFAULT_METHODS],
    allowedHeaders: [...DEFAULT_HEADERS],
    maxAge: DEFAULT_MAX_AGE,
  };
}

// ── CORS Header Setter ──────────────────────────

/**
 * Apply CORS headers to the response based on the request origin.
 * If the origin is in the allowed list, reflect it back.
 * Otherwise, use the first allowed origin as default.
 */
export function applyCorsHeaders(
  requestOrigin: string | null,
  set: { headers: Record<string, string> },
  config: CorsConfig,
): void {
  const origin =
    requestOrigin && config.allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : config.allowedOrigins[0] ?? '';

  set.headers['Access-Control-Allow-Origin'] = origin;
  set.headers['Vary'] = 'Origin';
  set.headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');
  set.headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
  set.headers['Access-Control-Max-Age'] = String(config.maxAge);
}

// ── Elysia Middleware ───────────────────────────

/**
 * CORS middleware for Elysia's `onTransform` hook.
 * Sets CORS headers on every request.
 *
 * Usage (integrated in task 11.2):
 *   const config = getCorsConfig();
 *   app.onTransform(corsMiddleware(config));
 */
export function corsMiddleware(config?: CorsConfig) {
  const corsConfig = config ?? getCorsConfig();

  logger.info('CORS configured', {
    origins: corsConfig.allowedOrigins,
    methods: corsConfig.allowedMethods.join(', '),
  });

  return ({ request, set }: { request: Request; set: { headers: Record<string, string> } }) => {
    const origin = request.headers.get('origin');
    applyCorsHeaders(origin, set, corsConfig);
  };
}

/**
 * Preflight handler for OPTIONS requests.
 * Returns 204 No Content with CORS headers already set by corsMiddleware.
 *
 * Usage (integrated in task 11.2):
 *   app.options('/', preflightHandler);
 *   app.options('/*', preflightHandler);
 */
export function preflightHandler({ set }: { set: { status?: number } }) {
  set.status = 204;
  return new Response(null, { status: 204 });
}
