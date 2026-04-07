# IDX Scraper API

REST API untuk data Bursa Efek Indonesia (IDX) — scraping real-time via Playwright browser automation dengan bypass Cloudflare.

Built with **Bun + Elysia + Playwright + Redis**.

## Fitur

- 50+ endpoint di 8 kategori (Market, Listed, News, Disclosure, Syariah, Members, Other, Admin)
- Redis caching dengan fallback in-memory otomatis
- Browser connection pooling (max 5 concurrent pages)
- Tiered API key system (free/basic/pro/advanced)
- Rate limiting per menit dan per hari
- Admin panel untuk manajemen API key
- Swagger/OpenAPI docs di `/api/docs`
- Health check endpoint di `/api/health`
- Graceful shutdown (SIGTERM/SIGINT)
- Docker multi-stage build + docker-compose

## Prasyarat

- [Bun](https://bun.sh) >= 1.0
- [Redis](https://redis.io) 7+ (opsional, fallback ke in-memory)
- Chromium (diinstall otomatis via Playwright)

## Quick Start

```bash
# Install dependensi
bun install

# Install Playwright browser
bunx playwright install chromium

# Set environment variables (minimal)
export ADMIN_API_KEY="your-secret-key-minimum-32-characters-long"

# Jalankan
bun run src/index.ts
```

API berjalan di `http://localhost:3100`. Docs di `http://localhost:3100/api/docs`.

## Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `3100` | Port server |
| `ADMIN_API_KEY` | — (wajib) | Kunci admin, minimal 32 karakter |
| `REDIS_URL` | — | URL Redis (format `redis://host:port`) |
| `REDIS_HOST` | `localhost` | Host Redis (jika `REDIS_URL` tidak diset) |
| `REDIS_PORT` | `6379` | Port Redis |
| `ALLOWED_ORIGINS` | `https://cloudnexify.com,...` | CORS origins (comma-separated) |
| `MAX_BROWSER_PAGES` | `5` | Maksimum Playwright pages concurrent |
| `NODE_ENV` | `development` | Environment (`production`/`development`) |
| `LOG_LEVEL` | `info` | Level logging |
| `API_KEYS` | — | Legacy API keys (comma-separated) |

## Endpoint

### Market (19 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/market/trading-summary` | Ringkasan perdagangan harian |
| GET | `/api/market/index-summary` | Daftar indeks (IHSG, LQ45, dll) |
| GET | `/api/market/stock-summary` | Semua saham dengan harga terkini |
| GET | `/api/market/broker-summary` | Ranking broker |
| GET | `/api/market/top-gainer` | Saham naik tertinggi |
| GET | `/api/market/top-loser` | Saham turun tertinggi |
| GET | `/api/market/top-volume` | Saham volume tertinggi |
| GET | `/api/market/top-value` | Saham nilai tertinggi |
| GET | `/api/market/top-frequent` | Saham frekuensi tertinggi |
| GET | `/api/market/suspend` | Saham yang disuspensi |
| GET | `/api/market/stock-list` | Daftar saham (paginasi) |
| GET | `/api/market/stock-index` | Indeks per saham |
| GET | `/api/market/margin-stocks` | Saham margin & short selling |
| GET | `/api/market/pre-open` | Harga pre-opening |
| GET | `/api/market/lp-stocks` | Saham liquidity provider |
| GET | `/api/market/bond-summary` | Ringkasan obligasi & sukuk |
| GET | `/api/market/indobex` | INDOBEX (indeks obligasi) |
| GET | `/api/market/derivatives` | Derivatif |
| GET | `/api/market/etf-list` | Daftar ETF |
| GET | `/api/market/etf-inav` | ETF iNAV |

### Listed (5 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/listed/corporate-action` | Aksi korporasi |
| GET | `/api/listed/calendar` | Kalender korporasi |
| GET | `/api/listed/special-notation` | Notasi khusus |
| GET | `/api/listed/watchlist` | Watchlist saham |
| GET | `/api/listed/esg-rating` | Rating ESG |

### News (8 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/news` | Berita IDX |
| GET | `/api/news/press-release` | Siaran pers |
| GET | `/api/news/articles` | Artikel |
| GET | `/api/news/uma` | Unusual Market Activity |
| GET | `/api/news/suspension` | Suspensi saham |
| GET | `/api/news/etd` | ETD news |
| GET | `/api/news/td` | TD news |
| GET | `/api/news/trading-holiday` | Hari libur bursa |

### Disclosure (6 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/disclosure/announcements` | Pengumuman |
| GET | `/api/disclosure/berita-pengumuman` | Berita pengumuman |
| GET | `/api/disclosure/financial-reports` | Laporan keuangan |
| POST | `/api/disclosure/download` | Download file |
| GET | `/api/disclosure/monitor` | Monitor state |
| GET | `/api/disclosure/check-new` | Cek pengumuman baru |

### Syariah (3 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/syariah/products` | Saham syariah |
| GET | `/api/syariah/index` | Indeks syariah |
| GET | `/api/syariah/transaction` | Transaksi syariah |

### Members (2 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/members/brokers` | Anggota bursa |
| GET | `/api/members/participants` | Partisipan |

### Other (4 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/other/statistics` | Statistik pasar |
| GET | `/api/other/new-listing` | IPO / listing baru |
| GET | `/api/other/fact-sheet-lq45` | Fact sheet LQ45 |
| GET | `/api/other/bond-book` | Order book obligasi |

### Admin (6 endpoint)

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/admin/keys/generate` | Buat API key baru |
| GET | `/api/admin/keys` | Daftar semua API key |
| GET | `/api/admin/keys/:id` | Detail API key |
| PATCH | `/api/admin/keys/:id` | Update API key |
| DELETE | `/api/admin/keys/:id` | Hapus API key |
| GET | `/api/admin/stats` | Statistik penggunaan |

### Health

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/health` | Status sistem (tanpa auth) |

## Autentikasi

Semua endpoint (kecuali `/api/health` dan `/api/docs`) memerlukan API key:

```bash
# Via header X-API-Key
curl -H "X-API-Key: idsk_live_abc123..." http://localhost:3100/api/market/stock-summary

# Via Authorization Bearer
curl -H "Authorization: Bearer idsk_live_abc123..." http://localhost:3100/api/market/stock-summary
```

Admin endpoint memerlukan header `X-Admin-Key`.

## Tier & Rate Limiting

| Tier | Rate Limit | Daily Limit | Harga |
|------|-----------|-------------|-------|
| Free | 30/menit | 500/hari | Gratis |
| Basic | 60/menit | 5.000/hari | Rp 99K/bln |
| Pro | Unlimited | Unlimited | Rp 299K/bln |
| Advanced | Custom | Custom | Custom |

Header rate limit di setiap respons:
- `X-RateLimit-Limit` — batas per menit
- `X-RateLimit-Remaining` — sisa request
- `X-RateLimit-Reset` — waktu reset (unix timestamp)

## Caching

| Kategori | TTL | Cache-Control |
|----------|-----|---------------|
| Market | 30 detik | `max-age=30` |
| News, Disclosure | 5 menit | `max-age=300` |
| Listed, Syariah, Members, Other | 15 menit | `max-age=900` |

Redis digunakan sebagai backend utama. Jika Redis tidak tersedia, otomatis fallback ke in-memory cache.

## Testing

```bash
bun test
```

## Deployment

Lihat [DEPLOY.md](DEPLOY.md) untuk panduan deployment lengkap.

## Lisensi

Private — tidak untuk distribusi publik.
