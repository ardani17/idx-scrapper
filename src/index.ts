// IDX Scraper — Entry Point (Production-Ready)

import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { CookieManager } from './clients/cookie-manager';
import { IDXClient } from './clients/idx-client';
import { DisclosureClient } from './clients/disclosure-client';
import { FileDownloader } from './downloaders/file-downloader';
import { browserManager } from './utils/browser';
import { healthRoutes } from './routes/health';
import { idxRoutes } from './routes/idx';
import { disclosureRoutes } from './routes/disclosure/index';
import { fileRoutes } from './routes/files';
import { marketRoutes } from './routes/market/index';
import { listedRoutes } from './routes/listed/index';
import { CorporateActionClient } from './clients/listed/corporate-action';
import { CalendarClient } from './clients/listed/calendar';
import { WatchlistClient } from './clients/listed/watchlist';
import { EsgRatingClient } from './clients/listed/esg-rating';
import { NewsClient } from './clients/news/news';
import { PressReleaseClient } from './clients/news/press-release';
import { ArticleClient } from './clients/news/article';
import { UmaClient } from './clients/news/uma';
import { SuspensionClient } from './clients/news/suspension';
import { EtdTdClient } from './clients/news/etd-td';
import { TradingHolidayClient } from './clients/news/trading-holiday';
import { newsRoutes } from './routes/news/index';
import { syariahRoutes } from './routes/syariah/index';
import { membersRoutes } from './routes/members/index';
import { otherRoutes } from './routes/other/index';
import { adminRoutes } from './routes/admin';
import { validateKey, checkRateLimit } from './services/key-manager';
import { join } from 'path';
import { logger } from './utils/logger';
import { marketCache, newsCache, slowCache } from './utils/cache';
import { corsMiddleware, preflightHandler } from './middleware/cors';
import { errorHandler, generateRequestId } from './middleware/error-handler';
import { validateAdminKey, createAdminGuard } from './middleware/admin-guard';

const PORT = process.env.PORT || 3100;
const DATA_DIR = join(import.meta.dir, '..', 'data');

// ── Per-request context store (requestId, startTime, keyId) ──
const requestContext = new WeakMap<Request, { requestId: string; startTime: number; keyId?: string }>();

// ── Initialize CORS middleware once ─────────────
const corsHandler = corsMiddleware();

// ── Extract client IP ───────────────────────────
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  const remote = request.headers.get('x-bun-remote-address');
  if (remote) return remote.replace(/^\[::ffff:/, '').replace(/]$/, '');
  return 'unknown';
}

// ── Validate AdminGuard at startup ──────────────
const adminKey = validateAdminKey();
createAdminGuard(adminKey);

// ── Init services ───────────────────────────────
const cookieManager = new CookieManager();
const idxClient = new IDXClient();
const disclosureClient = new DisclosureClient();
const downloader = new FileDownloader(join(DATA_DIR, 'disclosures'));
const stateFile = join(DATA_DIR, 'monitor-state.json');

// ── Build app ───────────────────────────────────
const app = new Elysia({ prefix: '/api' })

  // ── Swagger Documentation ─────────────────────
  .use(swagger({
    path: '/docs',
    documentation: {
      openapi: '3.0.3',
      info: {
        title: 'IDX Scraper API',
        version: '1.0.0',
        description: 'Indonesian Stock Exchange (IDX) data API — market data, listed companies, news, disclosures, syariah info',
        contact: { name: 'Ardani', url: 'https://cloudnexify.com' },
      },
      tags: [
        { name: 'Health', description: 'Health check and system status' },
        { name: 'Market', description: 'Real-time market data' },
        { name: 'Listed', description: 'Listed company data' },
        { name: 'News', description: 'IDX news' },
        { name: 'Disclosure', description: 'Corporate disclosures' },
        { name: 'Files', description: 'Downloaded files' },
        { name: 'IDX Data', description: 'IDX company profiles' },
        { name: 'Syariah', description: 'Syariah-compliant stocks' },
        { name: 'Members', description: 'Exchange members' },
        { name: 'Other', description: 'Market statistics' },
        { name: 'Admin', description: 'API key management' },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API key for authenticated access. Send via X-API-Key header or Authorization: Bearer <key>.' },
          AdminKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Admin-Key', description: 'Admin key for management endpoints. Must be at least 32 characters.' },
        },
        responses: {
          Unauthorized: {
            description: 'Authentication failed — missing or invalid API key',
            content: { 'application/json': { example: { success: false, error: 'API key tidak valid', statusCode: 401, fetchedAt: '2025-01-01T00:00:00.000Z' } } },
          },
          RateLimited: {
            description: 'Rate limit exceeded — too many requests for your tier',
            content: { 'application/json': { example: { success: false, error: 'Rate limit exceeded', statusCode: 429, retryAfter: 30, fetchedAt: '2025-01-01T00:00:00.000Z' } } },
          },
          ServiceUnavailable: {
            description: 'IDX data source unavailable — Cloudflare timeout or browser failure',
            content: { 'application/json': { example: { success: false, error: 'Sumber data IDX tidak tersedia, silakan coba lagi', statusCode: 503, fetchedAt: '2025-01-01T00:00:00.000Z' } } },
          },
          InternalError: {
            description: 'Internal server error — unexpected failure',
            content: { 'application/json': { example: { success: false, error: 'Terjadi kesalahan internal', statusCode: 500, fetchedAt: '2025-01-01T00:00:00.000Z' } } },
          },
        },
      },
    },
    exclude: ['/health'],
  }))

  // ── Swagger alias routes (/swagger → /docs) ──
  .get('/swagger', ({ set }) => { set.redirect = '/api/docs'; return ''; })
  .get('/swagger/json', ({ set }) => { set.redirect = '/api/docs/json'; return ''; })

  // ── CORS (module) ──────────────────────────────
  .onTransform((ctx: any) => corsHandler(ctx))
  .options('/', (ctx: any) => preflightHandler(ctx))
  .options('/*', (ctx: any) => preflightHandler(ctx))

  // ── Auth + Rate Limiting (tier-based) ─────────
  .onBeforeHandle(async ({ request, set }) => {
    const path = new URL(request.url).pathname;

    // 1. Health + Swagger + CORS preflight → exempt
    if (path.includes('/health') || path.includes('/docs') || path.includes('/swagger') || request.method === 'OPTIONS') return;

    // 2. Admin endpoints → exempt from API key auth (admin routes check their own header)
    if (path.includes('/admin')) return;

    // 3. All other routes → validate API key + rate limits
    //    Support both X-API-Key header and Authorization: Bearer <key>
    let providedKey = request.headers.get('X-API-Key');
    if (!providedKey) {
      const auth = request.headers.get('Authorization');
      if (auth?.startsWith('Bearer ')) providedKey = auth.slice(7);
    }
    const validation = await validateKey(providedKey || '');

    if (!validation.valid) {
      set.status = 401;
      const requestId = set.headers['X-Request-Id'] || '';
      logger.warn('Auth failed', { requestId, path, error: validation.error, hasKey: !!providedKey });
      return {
        success: false,
        error: validation.error || 'Invalid or missing API key',
        statusCode: 401,
      };
    }

    // Key is valid — check rate + daily limits
    const apiKeyData = validation.key;
    if (!apiKeyData) {
      set.status = 401;
      return { success: false, error: 'Invalid API key', statusCode: 401 };
    }

    // Store keyId in request context for structured logging
    const ctx = requestContext.get(request);
    if (ctx) ctx.keyId = apiKeyData.id;

    const rateCheck = await checkRateLimit(apiKeyData);

    // Set rate limit headers on every authenticated response (Req 11.5)
    set.headers['X-RateLimit-Limit'] = String(
      apiKeyData.rateLimit === -1 ? 'unlimited' : apiKeyData.rateLimit
    );
    set.headers['X-RateLimit-Remaining'] = String(
      rateCheck.remaining === -1 ? 'unlimited' : rateCheck.remaining
    );
    set.headers['X-RateLimit-Reset'] = String(rateCheck.resetAt);

    if (!rateCheck.allowed) {
      set.status = 429;

      // Determine which limit was hit and compute Retry-After accordingly
      const nowSec = Math.floor(Date.now() / 1000);
      const isDailyLimitHit = rateCheck.dailyRemaining === 0 && rateCheck.remaining >= 0;
      const retryAfterSec = isDailyLimitHit
        ? Math.max(1, rateCheck.dailyResetAt - nowSec)   // daily → retry after midnight WIB
        : Math.max(1, rateCheck.resetAt - nowSec);        // per-minute → retry after window reset
      set.headers['Retry-After'] = String(retryAfterSec);

      const requestId = set.headers['X-Request-Id'] || '';
      logger.warn('Rate limit hit', { requestId, path, keyId: apiKeyData.id, error: rateCheck.error });
      return {
        success: false,
        error: rateCheck.error,
        statusCode: 429,
        retryAfter: retryAfterSec,
        fetchedAt: new Date().toISOString(),
      };
    }
  })

  // ── Request ID + Start Time + Logging ──────────
  .onRequest(({ request, set }) => {
    // Generate X-Request-Id and attach to response headers
    const requestId = generateRequestId();
    set.headers['X-Request-Id'] = requestId;

    // Store request context (requestId, startTime) for structured logging
    requestContext.set(request, { requestId, startTime: Date.now() });

    const path = new URL(request.url).pathname;
    const ip = getClientIp(request);
    logger.info('Request', { requestId, method: request.method, path, ip });
  })

  // ── Global Error Handler (module) ───────────────
  .onError((ctx: any) => errorHandler(ctx))

  // ── Structured Response Logging ─────────────────
  .onAfterResponse(({ request }) => {
    const path = new URL(request.url).pathname;
    const ctx = requestContext.get(request);
    const requestId = ctx?.requestId ?? '';
    const responseTimeMs = ctx ? Date.now() - ctx.startTime : 0;
    const keyId = ctx?.keyId;
    const ip = getClientIp(request);

    // Slow request warning (> 30s)
    if (responseTimeMs > 30_000) {
      logger.warn('Slow request', { requestId, path, responseTimeMs, ip, keyId });
    }

    logger.info('Response', {
      requestId,
      method: request.method,
      path,
      responseTimeMs,
      clientIp: ip,
      ...(keyId ? { keyId } : {}),
    });

    // Clean up context
    requestContext.delete(request);
  })

  // ── Mount Routes ──────────────────────────────
  .use(healthRoutes(cookieManager, downloader))
  .use(adminRoutes)
  .use(idxRoutes(idxClient))
  .use(disclosureRoutes(disclosureClient, downloader, stateFile))
  .use(fileRoutes(downloader))
  .use(marketRoutes())
  .use(listedRoutes(
    new CorporateActionClient(),
    new CalendarClient(),
    new WatchlistClient(),
    new EsgRatingClient(),
  ))
  .use(newsRoutes(
    new NewsClient(),
    new PressReleaseClient(),
    new ArticleClient(),
    new UmaClient(),
    new SuspensionClient(),
    new EtdTdClient(),
    new TradingHolidayClient(),
  ))
  .use(syariahRoutes())
  .use(membersRoutes())
  .use(otherRoutes())
  .listen(PORT);

// ── Print banner ────────────────────────────────
logger.info('IDX Scraper API started', {
  port: PORT,
  uptime: process.uptime(),
  node: process.version,
  env: process.env.NODE_ENV || 'development',
});

console.log(`
╔═══════════════════════════════════════════════╗
║       🚀 IDX Scraper API  ·  Port ${String(PORT).padEnd(13)}║
╠═══════════════════════════════════════════════╣
║                                               ║
║  Market:                                       ║
║    GET  /api/market/trading-summary            ║
║    GET  /api/market/index-summary              ║
║    GET  /api/market/stock-summary              ║
║    GET  /api/market/broker-summary             ║
║    GET  /api/market/top-gainer                 ║
║    GET  /api/market/top-loser                  ║
║    GET  /api/market/top-volume                 ║
║    GET  /api/market/top-value                  ║
║    GET  /api/market/top-frequent               ║
║    GET  /api/market/suspend                    ║
║    GET  /api/market/stock-index                ║
║    GET  /api/market/stock-list                 ║
║    GET  /api/market/margin-stocks              ║
║    GET  /api/market/pre-open                   ║
║    GET  /api/market/lp-stocks                   ║
║    GET  /api/market/bond-summary                ║
║    GET  /api/market/indobex                     ║
║    GET  /api/market/derivatives                 ║
║    GET  /api/market/etf-list                    ║
║    GET  /api/market/etf-inav                    ║
║                                               ║
║  Listed:                                       ║
║    GET  /api/listed/corporate-action           ║
║    GET  /api/listed/calendar                   ║
║    GET  /api/listed/special-notation           ║
║    GET  /api/listed/watchlist                  ║
║    GET  /api/listed/esg-rating                 ║
║                                               ║
║  News:                                         ║
║    GET  /api/news                              ║
║    GET  /api/news/press-release               ║
║    GET  /api/news/articles                    ║
║    GET  /api/news/uma                         ║
║    GET  /api/news/suspension                  ║
║    GET  /api/news/etd                         ║
║    GET  /api/news/td                          ║
║    GET  /api/news/trading-holiday             ║
║                                               ║
║  Disclosure:                                  ║
║    GET  /api/disclosure/announcements         ║
║    GET  /api/disclosure/berita-pengumuman     ║
║    GET  /api/disclosure/financial-reports      ║
║    POST /api/disclosure/download              ║
║    GET  /api/disclosure/monitor               ║
║    GET  /api/disclosure/check-new             ║
║                                               ║
║  Syariah:                                      ║
║    GET  /api/syariah/products                   ║
║    GET  /api/syariah/index                     ║
║    GET  /api/syariah/transaction               ║
║                                               ║
║  Members:                                      ║
║    GET  /api/members/brokers                   ║
║    GET  /api/members/participants              ║
║                                               ║
║  Other:                                        ║
║    GET  /api/other/statistics                  ║
║    GET  /api/other/new-listing                 ║
║    GET  /api/other/fact-sheet-lq45             ║
║    GET  /api/other/bond-book                   ║
║                                               ║
║  Admin:                                        ║
║    POST /api/admin/keys/generate               ║
║    GET  /api/admin/keys                        ║
║    GET  /api/admin/keys/:id                    ║
║    PATCH /api/admin/keys/:id                   ║
║    DELETE /api/admin/keys/:id                  ║
║    GET  /api/admin/stats                       ║
║                                               ║
║  Middleware: CORS, Tiered Auth + Rate Limit,  ║
║             Error Handler, Structured Logging   ║
║                                               ║
║  Storage: ${DATA_DIR}/disclosures/    ║
╚═══════════════════════════════════════════════╝
`);

// ── Graceful shutdown ───────────────────────────
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;          // prevent double-shutdown
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown…`);

  // 1. Stop accepting new requests
  app.stop();

  // 2. Wait for in-progress requests to finish (max 10 seconds)
  const SHUTDOWN_TIMEOUT_MS = 10_000;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      logger.warn('Shutdown timeout reached (10s), forcing cleanup');
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
    // Resolve immediately — Elysia's stop() already drains connections.
    // The timeout acts as a safety net.
    resolve();
    clearTimeout(timer);
  });

  // 3. Close all Playwright pages and browser
  try {
    await browserManager.destroy();
    logger.info('Browser closed');
  } catch (err) {
    logger.error('Error closing browser', { error: String(err) });
  }

  // 4. Close Redis connections via CacheStore (also destroys fallback maps)
  try {
    await Promise.all([
      marketCache.destroy(),
      newsCache.destroy(),
      slowCache.destroy(),
    ]);
    logger.info('Cache stores destroyed');
  } catch (err) {
    logger.error('Error destroying cache stores', { error: String(err) });
  }

  // 5. Clean up file downloader resources
  try {
    await downloader.destroy();
  } catch (err) {
    logger.error('Error destroying downloader', { error: String(err) });
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
