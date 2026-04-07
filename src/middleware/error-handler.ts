// Error Handler Middleware — Consistent error responses with X-Request-Id
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

import { logger } from '../utils/logger';

// ── Interfaces ──────────────────────────────────

export interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  fetchedAt: string; // ISO 8601
}

// ── Custom Error Classes ────────────────────────

/**
 * Cloudflare timeout / IDX source unavailable.
 * Maps to HTTP 503 + Retry-After header.
 */
export class CloudflareTimeoutError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message?: string, retryAfterSeconds = 60) {
    super(message ?? 'Sumber data IDX tidak tersedia, silakan coba lagi');
    this.name = 'CloudflareTimeoutError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * HTML parsing failure during scraping.
 * Logged in detail, but returns a generic message to the client.
 */
export class HtmlParsingError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('Terjadi kesalahan internal');
    this.name = 'HtmlParsingError';
    this.detail = detail;
  }
}

/**
 * Browser (Playwright/Chromium) failed to launch.
 * Maps to HTTP 503 — caller should auto-retry on next request.
 */
export class BrowserLaunchError extends Error {
  constructor(message?: string) {
    super(message ?? 'Service temporarily unavailable');
    this.name = 'BrowserLaunchError';
  }
}

// ── UUID Generation ─────────────────────────────

/**
 * Generate a UUID v4 request identifier.
 * Uses the built-in crypto.randomUUID() available in Bun/Node 19+.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

// ── Error Response Formatter ────────────────────

/**
 * Build a consistent ErrorResponse object.
 */
export function formatErrorResponse(
  statusCode: number,
  message: string,
): ErrorResponse {
  return {
    success: false,
    error: message,
    statusCode,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Error Classification ────────────────────────

/**
 * Classify an error and return the appropriate HTTP status code and client message.
 * Internal details are logged but never leaked to the client.
 */
function classifyError(
  error: unknown,
  requestId: string,
): { statusCode: number; message: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {};

  // 1. Cloudflare timeout → 503 + Retry-After
  if (error instanceof CloudflareTimeoutError) {
    headers['Retry-After'] = String(error.retryAfterSeconds);
    logger.error('Cloudflare timeout', {
      requestId,
      retryAfter: error.retryAfterSeconds,
    });
    return { statusCode: 503, message: error.message, headers };
  }

  // 2. HTML parsing error → log detail, generic message
  if (error instanceof HtmlParsingError) {
    logger.error('HTML parsing error', {
      requestId,
      detail: error.detail,
    });
    return { statusCode: 500, message: 'Terjadi kesalahan internal', headers };
  }

  // 3. Browser launch failure → 503
  if (error instanceof BrowserLaunchError) {
    logger.error('Browser launch failure', {
      requestId,
      message: error.message,
    });
    return {
      statusCode: 503,
      message: 'Service temporarily unavailable',
      headers,
    };
  }

  // 4. Unhandled exception → log stack, generic 500
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Unhandled exception', {
    requestId,
    message: err.message,
    stack: err.stack,
  });
  return { statusCode: 500, message: 'Terjadi kesalahan internal', headers };
}

// ── Elysia onError Handler ──────────────────────

/**
 * Global error handler compatible with Elysia's `onError` hook.
 *
 * Expects `X-Request-Id` to already be set on the response headers by
 * `requestIdMiddleware`. If not present, generates one as a fallback.
 *
 * Usage (integrated in task 11.2):
 *   app.onError(errorHandler)
 */
export function errorHandler({
  code,
  error,
  set,
  request,
}: {
  code: string;
  error: Error;
  set: { status?: number; headers: Record<string, string> };
  request: Request;
}): ErrorResponse {
  // Ensure we have a request ID
  const requestId = set.headers['X-Request-Id'] || generateRequestId();
  set.headers['X-Request-Id'] = requestId;

  const path = new URL(request.url).pathname;

  // Elysia built-in codes (VALIDATION, NOT_FOUND, PARSE) — handle directly
  if (code === 'VALIDATION' || code === 'PARSE') {
    const msg = error instanceof Error ? error.message : String(error);
    set.status = 400;
    logger.warn('Validation error', { requestId, path, message: msg });
    return formatErrorResponse(400, msg);
  }

  if (code === 'NOT_FOUND') {
    set.status = 404;
    logger.info('Not found', { requestId, path });
    return formatErrorResponse(404, 'Not found');
  }

  // Application-level errors — classify and respond
  const classified = classifyError(error, requestId);

  set.status = classified.statusCode;

  // Merge extra headers (e.g. Retry-After)
  for (const [key, value] of Object.entries(classified.headers)) {
    set.headers[key] = value;
  }

  logger.error('Request error', {
    requestId,
    path,
    code,
    statusCode: classified.statusCode,
  });

  return formatErrorResponse(classified.statusCode, classified.message);
}

// ── Request ID Middleware ────────────────────────

/**
 * Elysia `onRequest` / `onBeforeHandle` compatible middleware that
 * generates a unique X-Request-Id for every incoming request and
 * attaches it to the response headers.
 *
 * Usage (integrated in task 11.2):
 *   app.onRequest(requestIdMiddleware)
 */
export function requestIdMiddleware({
  set,
}: {
  set: { headers: Record<string, string> };
}): void {
  const requestId = generateRequestId();
  set.headers['X-Request-Id'] = requestId;
}
