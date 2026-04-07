# Panduan Deployment — IDX Scraper API

## Opsi Deployment

1. [Docker Compose](#docker-compose) (rekomendasi)
2. [Docker Manual](#docker-manual)
3. [Bare Metal + PM2](#bare-metal--pm2)

---

## Docker Compose

Cara paling mudah — satu command untuk API + Redis.

### 1. Siapkan environment

```bash
# Buat file .env
cat > .env << 'EOF'
ADMIN_API_KEY=ganti-dengan-kunci-admin-minimal-32-karakter
PORT=3100
ALLOWED_ORIGINS=https://yourdomain.com
LOG_LEVEL=info
MAX_BROWSER_PAGES=5
EOF
```

### 2. Build dan jalankan

```bash
docker compose up -d
```

### 3. Verifikasi

```bash
# Cek health
curl http://localhost:3100/api/health

# Cek logs
docker compose logs -f api
```

### 4. Generate API key pertama

```bash
curl -X POST http://localhost:3100/api/admin/keys/generate \
  -H "X-Admin-Key: ganti-dengan-kunci-admin-anda" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "tier": "basic"}'
```

### 5. Stop

```bash
docker compose down
```

Data persisten di Docker volumes `api-data` dan `redis-data`.

---

## Docker Manual

Jika Redis sudah ada (managed Redis, ElastiCache, dll).

### Build image

```bash
docker build -t idx-scraper .
```

### Jalankan

```bash
docker run -d \
  --name idx-scraper \
  -p 3100:3100 \
  -e ADMIN_API_KEY="kunci-admin-minimal-32-karakter" \
  -e REDIS_URL="redis://your-redis-host:6379" \
  -e NODE_ENV=production \
  -e ALLOWED_ORIGINS="https://yourdomain.com" \
  -v idx-data:/app/data \
  --restart unless-stopped \
  idx-scraper
```

### Health check

Docker image sudah include `HEALTHCHECK` yang memanggil `/api/health` setiap 30 detik.

```bash
docker inspect --format='{{.State.Health.Status}}' idx-scraper
```

---

## Bare Metal + PM2

Untuk deployment langsung di server tanpa Docker.

### 1. Install prasyarat

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Redis
sudo apt install redis-server
sudo systemctl enable redis-server
```

### 2. Clone dan install

```bash
git clone <repo-url> /opt/idx-scraper
cd /opt/idx-scraper
bun install
bunx playwright install chromium
bunx playwright install-deps
```

### 3. Konfigurasi environment

```bash
cat > /opt/idx-scraper/.env << 'EOF'
PORT=3100
NODE_ENV=production
ADMIN_API_KEY=ganti-dengan-kunci-admin-minimal-32-karakter
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=https://yourdomain.com
MAX_BROWSER_PAGES=5
LOG_LEVEL=info
EOF
```

### 4. Jalankan dengan PM2

```bash
# Install PM2
bun add -g pm2

# Start
pm2 start ecosystem.config.ts --interpreter bun

# Auto-start on reboot
pm2 save
pm2 startup
```

### 5. PM2 commands

```bash
pm2 status          # Cek status
pm2 logs idx-scraper # Lihat logs
pm2 restart idx-scraper # Restart
pm2 stop idx-scraper    # Stop
```

---

## Reverse Proxy (Nginx)

Contoh konfigurasi Nginx:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout untuk scraping (bisa lama)
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
```

Tambahkan SSL dengan Certbot:

```bash
sudo certbot --nginx -d api.yourdomain.com
```

---

## Environment Variables

| Variable | Wajib | Default | Deskripsi |
|----------|-------|---------|-----------|
| `ADMIN_API_KEY` | Ya | — | Kunci admin (min 32 karakter) |
| `PORT` | Tidak | `3100` | Port server |
| `REDIS_URL` | Tidak | — | URL Redis (`redis://host:port`) |
| `REDIS_HOST` | Tidak | `localhost` | Host Redis |
| `REDIS_PORT` | Tidak | `6379` | Port Redis |
| `ALLOWED_ORIGINS` | Tidak | cloudnexify.com | CORS origins (comma-separated) |
| `MAX_BROWSER_PAGES` | Tidak | `5` | Max concurrent browser pages |
| `NODE_ENV` | Tidak | `development` | Environment |
| `LOG_LEVEL` | Tidak | `info` | Level logging |
| `API_KEYS` | Tidak | — | Legacy API keys (comma-separated) |

---

## Data & Persistence

File persisten disimpan di `/app/data` (Docker) atau `./data` (bare metal):

- `data/api-keys.json` — Database API key (permission 0600)
- `data/daily-usage.json` — Penggunaan harian
- `data/disclosures/` — File disclosure yang didownload

Pastikan direktori ini di-mount sebagai volume di Docker.

---

## Monitoring

### Health Endpoint

```bash
curl http://localhost:3100/api/health
```

Response:
```json
{
  "success": true,
  "status": "ok",
  "uptime": 3600,
  "browser": { "status": "connected", "activePages": 2 },
  "redis": { "status": "connected" },
  "cache": { "market": 15, "news": 8, "slow": 5 },
  "memory": { "rss": 150000000, "heapUsed": 80000000, "heapTotal": 120000000 },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Status `degraded` jika browser disconnected.

### Logs

Structured JSON logging dengan field: `timestamp`, `method`, `path`, `statusCode`, `responseTimeMs`, `clientIp`, `keyId`.

Slow request warning otomatis jika respons > 30 detik.

---

## Troubleshooting

### Redis tidak tersedia
API tetap berjalan dengan in-memory cache. Reconnect otomatis setiap 30 detik. Cek log untuk warning "Redis unavailable".

### Browser crash
BrowserManager auto-reconnect. Cek health endpoint — status browser `disconnected` berarti sedang reconnect.

### Rate limit 429
Cek header `Retry-After` untuk waktu tunggu. Daily limit reset tengah malam WIB (UTC+7).

### Server tidak mau start
Pastikan `ADMIN_API_KEY` diset dan minimal 32 karakter. Server menolak start tanpa kunci admin yang valid.
