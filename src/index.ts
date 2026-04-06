// IDX Scraper — Entry Point (Production-Ready)

import { Elysia } from 'elysia';
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
import { join } from 'path';
import { logger } from './utils/logger';
import { RateLimiter } from './utils/rate-limit';
import { marketCache, newsCache, slowCache } from './utils/cache';

const PORT = process.env.PORT || 3100;
const DATA_DIR = join(import.meta.dir, '..', 'data');
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '60000', 10);

// ── Rate Limiter ────────────────────────────────
const rateLimiter = new RateLimiter(60, 60_000); // 60 req/min per IP

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

  // ── CORS ──────────────────────────────────────
  .onTransform(({ request, set }) => {
    // Set CORS headers for all responses
    const origin = request.headers.get('origin');
    set.headers['Access-Control-Allow-Origin'] = origin || '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key';
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

  // ── Rate Limiting ─────────────────────────────
  .onBeforeHandle(({ request, set }) => {
    const ip = getClientIp(request);
    const path = new URL(request.url).pathname;

    // Skip rate limiting for health checks
    if (path.includes('/health')) return;

    const { allowed, remaining, resetAt } = rateLimiter.check(ip);

    set.headers['X-RateLimit-Remaining'] = String(remaining);
    set.headers['X-RateLimit-Reset'] = String(Math.ceil(resetAt / 1000));

    if (!allowed) {
      set.status = 429;
      logger.warn('Rate limit exceeded', { ip, path, resetAt });
      return {
        success: false,
        error: 'Rate limit exceeded. Try again later.',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      };
    }
  })

  // ── API Key Authentication ─────────────────────
  .onBeforeHandle(({ request, set }) => {
    const path = new URL(request.url).pathname;

    // Exempt health endpoint and CORS preflight
    if (path.includes('/health') || request.method === 'OPTIONS') return;

    const validKeys = (process.env.API_KEYS || 'test-key')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const providedKey = request.headers.get('X-API-Key');

    if (!providedKey || !validKeys.includes(providedKey)) {
      set.status = 401;
      logger.warn('Invalid or missing API key', {
        path,
        hasKey: !!providedKey,
      });
      return {
        success: false,
        error: 'Invalid or missing API key',
        statusCode: 401,
      };
    }
  })



  // ── Request Logging ───────────────────────────
  .onRequest(({ request }) => {
    const path = new URL(request.url).pathname;
    const ip = getClientIp(request);
    logger.info('Request', { method: request.method, path, ip });
    return; // explicitly return nothing (not undefined)
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
    return;
  })

  // ── Mount Routes ──────────────────────────────
  .use(healthRoutes(cookieManager, downloader))
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
║  Middleware: CORS, Rate Limit (60/min/IP),     ║
║             Error Handler, Structured Logging   ║
║                                               ║
║  Storage: ${DATA_DIR}/disclosures/    ║
╚═══════════════════════════════════════════════╝
`);

// ── Graceful shutdown ───────────────────────────
const shutdown = async () => {
  logger.info('Shutting down...');
  await downloader.destroy();
  rateLimiter.destroy();
  marketCache.destroy();
  newsCache.destroy();
  slowCache.destroy();
  await destroyBrowser();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
