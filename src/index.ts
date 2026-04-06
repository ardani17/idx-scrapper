// IDX Scraper — Entry Point (Production-Ready)

import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { CookieManager } from './clients/cookie-manager';
import { IDXClient } from './clients/idx-client';
import { DisclosureClient } from './clients/disclosure-client';
import { FileDownloader } from './downloaders/file-downloader';
import { destroyBrowser } from './utils/browser';
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

const PORT = process.env.PORT || 3100;
const DATA_DIR = join(import.meta.dir, '..', 'data');
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '60000', 10);

// ── Extract client IP ───────────────────────────
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  const remote = request.headers.get('x-bun-remote-address');
  if (remote) return remote.replace(/^\[::ffff:/, '').replace(/]$/, '');
  return 'unknown';
}

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
          ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
          AdminKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Admin-Key' },
        },
      },
    },
    exclude: ['/health'],
  }))

  // ── Swagger alias routes (/swagger → /docs) ──
  .get('/swagger', ({ set }) => { set.redirect = '/api/docs'; return ''; })
  .get('/swagger/json', ({ set }) => { set.redirect = '/api/docs/json'; return ''; })

  // ── CORS ──────────────────────────────────────
  .onTransform(({ request, set }) => {
    const origin = request.headers.get('origin');
    set.headers['Access-Control-Allow-Origin'] = origin || '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key, X-Admin-Key';
    set.headers['Access-Control-Max-Age'] = '86400';
  })
  .options('/', ({ set }) => {
    set.status = 204;
    return new Response(null, { status: 204 });
  })
  .options('/*', ({ set }) => {
    set.status = 204;
    return new Response(null, { status: 204 });
  })

  // ── Auth + Rate Limiting (tier-based) ─────────
  .onBeforeHandle(({ request, set }) => {
    const path = new URL(request.url).pathname;

    // 1. Health + Swagger + CORS preflight → exempt
    if (path.includes('/health') || path.includes('/docs') || path.includes('/swagger') || request.method === 'OPTIONS') return;

    // 2. Admin endpoints → exempt from API key auth (admin routes check their own header)
    if (path.includes('/admin')) return;

    // 3. All other routes → validate API key + rate limits
    let providedKey = request.headers.get('X-API-Key');
    // Swagger UI may send as Bearer token
    if (!providedKey) {
      const auth = request.headers.get('Authorization');
      if (auth?.startsWith('Bearer ')) providedKey = auth.slice(7);
    }
    const validation = validateKey(providedKey || '');

    if (!validation.valid) {
      set.status = 401;
      logger.warn('Auth failed', { path, error: validation.error, hasKey: !!providedKey });
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

    const rateCheck = checkRateLimit(apiKeyData);

    // Set rate limit headers
    set.headers['X-RateLimit-Limit'] = String(
      apiKeyData.rateLimit === -1 ? 'unlimited' : apiKeyData.rateLimit
    );
    set.headers['X-RateLimit-Remaining'] = String(
      rateCheck.remaining === -1 ? 'unlimited' : rateCheck.remaining
    );
    set.headers['X-RateLimit-Reset'] = String(rateCheck.resetAt);

    if (!rateCheck.allowed) {
      set.status = 429;
      logger.warn('Rate limit hit', { path, keyId: apiKeyData.id, error: rateCheck.error });
      return {
        success: false,
        error: rateCheck.error,
        statusCode: 429,
        retryAfter: Math.ceil(rateCheck.resetAt - Date.now() / 1000),
      };
    }
  })

  // ── Request Logging ───────────────────────────
  .onRequest(({ request }) => {
    const path = new URL(request.url).pathname;
    const ip = getClientIp(request);
    logger.info('Request', { method: request.method, path, ip });
  })

  // ── Global Error Handler ──────────────────────
  .onError(({ code, error, set, request }) => {
    const path = new URL(request.url).pathname;
    const ip = getClientIp(request);
    const msg = error instanceof Error ? error.message : String(error);
    const statusCode = code === 'VALIDATION' ? 400
      : code === 'NOT_FOUND' ? 404
      : code === 'PARSE' ? 400
      : 500;

    set.status = statusCode;

    logger.error('Request error', { path, ip, code, message: msg, statusCode });

    return {
      success: false,
      error: msg,
      statusCode,
      fetchedAt: new Date().toISOString(),
    };
  })

  // ── Response Logging ──────────────────────────
  .onAfterResponse(({ request }) => {
    const path = new URL(request.url).pathname;
    logger.debug('Response', { path, status: 200 });
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
const shutdown = async () => {
  logger.info('Shutting down...');
  await downloader.destroy();
  marketCache.destroy();
  newsCache.destroy();
  slowCache.destroy();
  await destroyBrowser();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
