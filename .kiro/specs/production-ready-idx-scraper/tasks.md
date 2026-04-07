# Rencana Implementasi: IDX Scraper Production-Ready

## Ikhtisar

Implementasi dilakukan secara bertahap: infrastruktur dasar terlebih dahulu (dependensi, cache, browser pool), lalu middleware keamanan dan validasi, refactoring komponen inti, penambahan fitur monitoring/Docker, dan terakhir testing komprehensif. Setiap tahap membangun di atas tahap sebelumnya sehingga tidak ada kode yang menggantung.

## Tasks

- [x] 1. Setup infrastruktur dan dependensi baru
  - [x] 1.1 Install dependensi production dan dev
    - Jalankan `bun add ioredis` dan `bun add -d fast-check`
    - Verifikasi `package.json` terupdate dengan `ioredis` dan `fast-check`
    - _Requirements: 6.1, 6.2_

  - [x] 1.2 Buat struktur direktori baru
    - Buat folder `src/middleware/`, `src/validators/`, dan `tests/unit/`, `tests/property/`, `tests/integration/`
    - _Requirements: 5.1, 5.4_

- [x] 2. Implementasi CacheStore Redis dengan fallback
  - [x] 2.1 Refactor `src/utils/cache.ts` ke Redis backend
    - Implementasi interface `ICacheStore` dengan `ioredis` sebagai backend utama
    - Baca konfigurasi dari `REDIS_URL` atau `REDIS_HOST`/`REDIS_PORT` (default `localhost:6379`)
    - Implementasi fallback ke `Map` in-memory jika Redis tidak tersedia
    - Reconnect attempt setiap 30 detik saat Redis down, log warning saat fallback aktif
    - Semua method menjadi `async` (`get`, `set`, `del`, `has`, `clear`, `size`, `destroy`)
    - Tambahkan method `isRedisConnected(): boolean`
    - Pertahankan preset TTL: `marketCache` (30s), `newsCache` (5m), `slowCache` (15m)
    - Serialisasi data sebagai JSON string di Redis dengan key prefix `idx:`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Tulis property test untuk CacheStore round-trip
    - **Property 12: Cache round-trip dengan TTL**
    - **Validates: Requirements 6.1, 6.3**

- [x] 3. Implementasi BrowserManager dengan connection pool
  - [x] 3.1 Refactor `src/utils/browser.ts` ke class BrowserManager
    - Implementasi interface `IBrowserManager` dengan semaphore pattern
    - Maksimum page concurrent dikonfigurasi via `MAX_BROWSER_PAGES` env var (default 5)
    - `acquirePage()` menunggu di antrian FIFO jika pool penuh, timeout 30 detik
    - `releasePage()` menutup page di blok `finally` dan memberi sinyal ke antrian
    - Auto-reconnect jika browser crash
    - Tambahkan `getActivePagesCount()` dan `isConnected()`
    - Export singleton instance `browserManager`
    - _Requirements: 6.5, 6.6, 6.8_

  - [ ]* 3.2 Tulis property test untuk browser pool limit
    - **Property 13: Browser pool tidak melebihi batas maksimum**
    - **Validates: Requirements 6.5, 6.8**

  - [ ]* 3.3 Tulis property test untuk page cleanup
    - **Property 14: Page cleanup setelah release**
    - **Validates: Requirements 6.6**

- [x] 4. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan ke pengguna jika ada pertanyaan.

- [x] 5. Implementasi AdminGuard middleware
  - [x] 5.1 Buat `src/middleware/admin-guard.ts`
    - Startup check: tolak start jika `ADMIN_API_KEY` tidak diset atau < 32 karakter
    - Constant-time comparison menggunakan `crypto.timingSafeEqual` untuk verifikasi kunci
    - Brute-force protection: blokir IP setelah 10 kegagalan dalam 5 menit, durasi blokir 15 menit
    - Respons generik "Invalid admin key" tanpa membedakan jenis kegagalan (HTTP 401)
    - Cleanup interval untuk entry brute-force yang expired
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 5.2 Tulis property test untuk validasi panjang minimum ADMIN_API_KEY
    - **Property 1: Validasi panjang minimum ADMIN_API_KEY**
    - **Validates: Requirements 1.2**

  - [ ]* 5.3 Tulis property test untuk respons generik admin key salah
    - **Property 2: Admin key salah selalu menghasilkan respons generik yang identik**
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 5.4 Tulis property test untuk constant-time comparison
    - **Property 3: Constant-time comparison menghasilkan hasil yang benar**
    - **Validates: Requirements 1.4**

- [x] 6. Implementasi Input Validator schemas
  - [x] 6.1 Buat `src/validators/shared-schemas.ts`
    - Definisikan shared Elysia `t` schemas: `PaginationQuery`, `DateRangeQuery`, `StockCodeParam`
    - `PaginationQuery`: pageSize (integer 1-100, default 20), indexFrom (>= 0), page (>= 1), limit (integer 1-100)
    - `DateRangeQuery`: dateFrom dan dateTo dengan pattern `^\d{4}-\d{2}-\d{2}$`
    - `StockCodeParam`: stockCode dengan pattern `^[A-Z]{3,6}$`
    - `CreateKeyBody`: name (string required), tier (enum required), email (optional), rateLimit (optional), dailyLimit (optional)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 6.2 Tulis property test untuk validasi parameter numerik
    - **Property 4: Validasi parameter numerik**
    - **Validates: Requirements 2.1, 2.2, 2.6**

  - [ ]* 6.3 Tulis property test untuk validasi kode saham
    - **Property 5: Validasi kode saham**
    - **Validates: Requirements 2.3**

  - [ ]* 6.4 Tulis property test untuk validasi body pembuatan API key
    - **Property 6: Validasi body pembuatan API key**
    - **Validates: Requirements 2.4**

  - [ ]* 6.5 Tulis property test untuk validasi format tanggal
    - **Property 7: Validasi format tanggal ISO 8601**
    - **Validates: Requirements 2.5**

- [x] 7. Implementasi Error Handler dan CORS module
  - [x] 7.1 Buat `src/middleware/error-handler.ts`
    - Generate `X-Request-Id` (UUID v4) di setiap request dan sertakan di header respons
    - Format error konsisten: `{ success: false, error: string, statusCode: number, fetchedAt: string }`
    - Cloudflare timeout → HTTP 503 + header `Retry-After`
    - HTML parsing error → log detail, return pesan generik "Terjadi kesalahan internal"
    - Unhandled exception → log stack trace, return HTTP 500 generik
    - Browser launch failure → HTTP 503, auto-retry pada request berikutnya
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.2 Buat `src/middleware/cors.ts`
    - Ekstrak konfigurasi CORS dari `src/index.ts` ke modul terpisah
    - Baca `ALLOWED_ORIGINS` dari variabel lingkungan (comma-separated)
    - Default origins: `https://cloudnexify.com`, `https://idx.cloudnexify.com`, `https://app.cloudnexify.com`
    - Handle OPTIONS preflight dengan status 204
    - _Requirements: 10.4_

  - [ ]* 7.3 Tulis property test untuk format respons error konsisten
    - **Property 8: Format respons error konsisten**
    - **Validates: Requirements 3.1, 3.4**

  - [ ]* 7.4 Tulis property test untuk X-Request-Id unik
    - **Property 9: X-Request-Id unik di setiap respons**
    - **Validates: Requirements 3.5**

- [x] 8. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan ke pengguna jika ada pertanyaan.

- [x] 9. Refactor KeyManager ke async + security
  - [x] 9.1 Refactor `src/services/key-manager.ts`
    - Ganti `readFileSync`/`writeFileSync` dengan `Bun.file().text()` dan `Bun.write()` (async)
    - Set file permission `0600` pada `api-keys.json` dan `daily-usage.json`
    - Semua public functions menjadi `async` (`generateKey`, `validateKey`, `checkRateLimit`, `listKeys`, `getKey`, `updateKey`, `deleteKey`, `getStats`)
    - Tambah validasi `expiresAt` di `validateKey()`: tolak key yang sudah expired dengan pesan "API key telah kedaluwarsa"
    - Respons generik "API key tidak valid" untuk key tidak ditemukan DAN key nonaktif (tidak membedakan)
    - Format key: `idsk_live_` + 64 hex chars (update `randomHex(32)` → `randomHex(32)` sudah menghasilkan 64 hex)
    - Masking: tampilkan 10 karakter pertama + "..." + 4 karakter terakhir
    - _Requirements: 10.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 9.2 Tulis property test untuk format API key
    - **Property 19: Format API key yang dihasilkan**
    - **Validates: Requirements 12.1**

  - [ ]* 9.3 Tulis property test untuk masking API key
    - **Property 20: Masking API key**
    - **Validates: Requirements 12.2**

  - [ ]* 9.4 Tulis property test untuk validasi expiry API key
    - **Property 21: Validasi expiry API key**
    - **Validates: Requirements 12.4**

  - [ ]* 9.5 Tulis property test untuk respons generik key tidak valid
    - **Property 23: Respons generik untuk key tidak valid**
    - **Validates: Requirements 12.6**

- [x] 10. Implementasi cachedScrape utility dan refactor route handlers
  - [x] 10.1 Buat `src/utils/cached-scrape.ts`
    - Implementasi fungsi `cachedScrape<T>` yang menghilangkan duplikasi pola try-catch-cache
    - Parameter: `cache`, `cacheKey`, `ttlMs`, `scraper` function, `requestId`
    - Return: `{ data: T, cached: boolean }`
    - Cek cache → jika hit, return dengan `_cached: true`
    - Jika miss, jalankan scraper, simpan ke cache, return data
    - Tangkap error scraping, log dengan requestId, throw error yang sesuai
    - _Requirements: 10.1_

  - [x] 10.2 Refactor semua route handlers untuk menggunakan cachedScrape
    - Update semua route di `src/routes/market/`, `src/routes/listed/`, `src/routes/news/`, `src/routes/disclosure/`, `src/routes/syariah/`, `src/routes/members/`, `src/routes/other/`
    - Ganti pola try-catch-cache manual dengan panggilan `cachedScrape()`
    - Tambahkan validation schemas (dari shared-schemas) ke setiap endpoint definition
    - Sertakan header `Cache-Control: max-age={ttl_seconds}` di respons
    - Pastikan data kosong dari IDX tetap menghasilkan HTTP 200 dengan `success: true`
    - _Requirements: 4.1-4.9, 6.3, 6.7, 10.1, 10.2_

  - [ ]* 10.3 Tulis property test untuk data kosong tetap HTTP 200
    - **Property 10: Data kosong dari IDX tetap menghasilkan HTTP 200**
    - **Validates: Requirements 4.9**

  - [ ]* 10.4 Tulis property test untuk Cache-Control header
    - **Property 15: Cache-Control header sesuai TTL**
    - **Validates: Requirements 6.7**

- [-] 11. Refactor FileDownloader dan update auth middleware
  - [x] 11.1 Refactor `src/downloaders/file-downloader.ts`
    - Ganti browser instance terpisah dengan shared `BrowserManager`
    - Gunakan `browserManager.acquirePage()` dan `browserManager.releasePage()` di blok `finally`
    - Hapus method `initPage()` dan `close()` internal, delegasikan ke BrowserManager
    - Ganti `console.log` dengan `logger` terstruktur
    - _Requirements: 10.3, 10.6_

  - [x] 11.2 Update auth middleware di `src/index.ts`
    - Integrasikan `AdminGuard` ke admin route handling (ganti inline check)
    - Integrasikan CORS module (ganti inline CORS di `onTransform`)
    - Integrasikan error handler middleware (ganti inline `onError`)
    - Tambahkan X-Request-Id generation di middleware pipeline
    - Support `Authorization: Bearer <key>` selain `X-API-Key` di auth middleware
    - Tambahkan structured logging dengan `responseTimeMs`, `keyId`
    - _Requirements: 3.5, 7.4, 12.5_

  - [ ] 11.3 Tulis property test untuk dual header support API key
    - **Property 22: Dual header support untuk API key**
    - **Validates: Requirements 12.5**

  - [ ]* 11.4 Tulis property test untuk structured request logging
    - **Property 16: Structured request logging**
    - **Validates: Requirements 7.4**

- [x] 12. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan ke pengguna jika ada pertanyaan.

- [-] 13. Perbaikan rate limiting dan health endpoint
  - [x] 13.1 Perbaiki rate limiter headers dan daily reset
    - Pastikan header `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` ada di setiap respons terautentikasi
    - Pastikan HTTP 429 menyertakan header `Retry-After` saat batas per menit terlampaui
    - Pastikan pesan daily limit menjelaskan waktu reset (tengah malam WIB)
    - Verifikasi tier enforcement: free (30/min, 500/day), basic (60/min, 5000/day), pro (unlimited), advanced (custom)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 13.2 Tulis property test untuk rate limiting per tier
    - **Property 17: Rate limiting per tier**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

  - [ ]* 13.3 Tulis property test untuk rate limit headers
    - **Property 18: Rate limit headers di setiap respons terautentikasi**
    - **Validates: Requirements 11.5**

  - [x] 13.4 Perkaya health endpoint
    - Update `src/routes/health.ts` untuk mengembalikan: uptime, status browser (connected/disconnected + activePages), status Redis (connected/disconnected/fallback), ukuran cache per tier, penggunaan memori (rss, heapUsed, heapTotal), timestamp
    - Pastikan health endpoint tetap tanpa autentikasi di `/api/health`
    - Tambahkan slow request warning: log warning jika respons > 30 detik
    - _Requirements: 7.1, 7.2, 7.3, 7.6_

- [x] 14. Docker multi-stage build dan docker-compose
  - [x] 14.1 Update Dockerfile ke multi-stage build
    - Stage 1 (deps): install dependensi dengan `bun install --frozen-lockfile`
    - Stage 2 (playwright): install Chromium dependencies dan Playwright
    - Stage 3 (runtime): copy dari stage sebelumnya, tambahkan `curl` untuk healthcheck
    - Tambahkan `HEALTHCHECK` instruction yang memanggil `/api/health` setiap 30 detik
    - Pastikan semua konfigurasi sensitif dibaca dari variabel lingkungan
    - _Requirements: 8.1, 8.2, 8.3, 8.7_

  - [x] 14.2 Buat `docker-compose.yml`
    - Service `api`: build dari Dockerfile, expose port, environment variables, volume `/app/data`, depends_on Redis
    - Service `redis`: image `redis:7-alpine`, healthcheck, volume untuk persistensi
    - Dokumentasikan bahwa Redis adalah dependensi eksternal
    - _Requirements: 8.4, 8.5_

  - [x] 14.3 Update `.dockerignore`
    - Pastikan mengecualikan: `node_modules`, `.git`, `data/`, `logs/`, `tests/`, `*.test.ts`
    - _Requirements: 8.6_

  - [x] 14.4 Perbaiki graceful shutdown
    - Stop menerima request baru pada SIGTERM/SIGINT
    - Tunggu request yang sedang diproses (max 10 detik timeout)
    - Tutup semua Playwright pages dan browser via BrowserManager
    - Tutup koneksi Redis via CacheStore
    - Destroy semua cache instances
    - `process.exit(0)`
    - _Requirements: 8.4_

- [-] 15. Dokumentasi Swagger/OpenAPI
  - [x] 15.1 Perkaya dokumentasi OpenAPI di semua endpoint
    - Tambahkan deskripsi lengkap, parameter input dengan tipe data, dan contoh respons di setiap endpoint
    - Dokumentasikan kode respons HTTP (200, 400, 401, 404, 429, 500, 503) di setiap endpoint yang relevan
    - Dokumentasikan nilai default parameter opsional di skema OpenAPI
    - Pastikan tag kategori sudah benar untuk semua endpoint
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 15.2 Tulis property test untuk kelengkapan dokumentasi OpenAPI
    - **Property 24: Kelengkapan dokumentasi OpenAPI**
    - **Validates: Requirements 9.2, 9.4, 9.5**

- [x] 16. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan ke pengguna jika ada pertanyaan.

- [ ] 17. Unit tests untuk semua komponen
  - [ ]* 17.1 Tulis unit test untuk CacheStore
    - Test koneksi Redis, penyimpanan data, pengambilan data, kedaluwarsa TTL, penghapusan manual, fallback ke in-memory
    - File: `tests/unit/cache-store.test.ts`
    - _Requirements: 5.2_

  - [ ]* 17.2 Tulis unit test untuk BrowserManager
    - Test acquire/release page, pool limit, antrian FIFO, timeout, auto-reconnect
    - File: `tests/unit/browser-manager.test.ts`
    - _Requirements: 5.3_

  - [ ]* 17.3 Tulis unit test untuk AdminGuard
    - Test startup validation, constant-time comparison, brute-force blocking, respons generik
    - File: `tests/unit/admin-guard.test.ts`
    - _Requirements: 5.5_

  - [ ]* 17.4 Tulis unit test untuk KeyManager
    - Test generateKey, validateKey, checkRateLimit, listKeys, getKey, updateKey, deleteKey
    - Test expiry validation, masking, file permissions
    - File: `tests/unit/key-manager.test.ts`
    - _Requirements: 5.1_

  - [ ]* 17.5 Tulis unit test untuk RateLimiter
    - Test pembatasan per menit, reset window, pembersihan entry kedaluwarsa
    - File: `tests/unit/rate-limiter.test.ts`
    - _Requirements: 5.3_

  - [ ]* 17.6 Tulis unit test untuk Input Validators
    - Test parameter tidak valid → HTTP 400, parameter valid diterima, batas pagination
    - File: `tests/unit/validators.test.ts`
    - _Requirements: 5.6_

  - [ ]* 17.7 Tulis unit test untuk format utilities
    - Test formatBytes dan cleanText dengan berbagai input termasuk edge cases
    - File: `tests/unit/format.test.ts`
    - _Requirements: 5.8_

  - [ ]* 17.8 Tulis unit test untuk Error Handler
    - Test format respons error, X-Request-Id, Retry-After header
    - File: `tests/unit/error-handler.test.ts`
    - _Requirements: 5.7_

  - [ ]* 17.9 Tulis unit test untuk CORS module
    - Test allowed origins, preflight handling, header values
    - File: `tests/unit/cors.test.ts`
    - _Requirements: 10.4_

- [ ] 18. Property-based tests untuk format utilities
  - [ ]* 18.1 Tulis property test untuk round-trip format utilities
    - **Property 11: Round-trip format utilities**
    - File: `tests/property/format.prop.test.ts`
    - **Validates: Requirements 5.8**

- [ ] 19. Integration tests untuk semua kategori endpoint
  - [ ]* 19.1 Tulis integration test untuk Market endpoints
    - Test semua 19 endpoint Market dengan respons HTTP 200 dan format data valid
    - File: `tests/integration/market.test.ts`
    - _Requirements: 4.1_

  - [ ]* 19.2 Tulis integration test untuk Listed endpoints
    - Test semua 5 endpoint Listed
    - File: `tests/integration/listed.test.ts`
    - _Requirements: 4.2_

  - [ ]* 19.3 Tulis integration test untuk News endpoints
    - Test semua 8 endpoint News
    - File: `tests/integration/news.test.ts`
    - _Requirements: 4.3_

  - [ ]* 19.4 Tulis integration test untuk Disclosure endpoints
    - Test semua 6 endpoint Disclosure
    - File: `tests/integration/disclosure.test.ts`
    - _Requirements: 4.4_

  - [ ]* 19.5 Tulis integration test untuk Syariah endpoints
    - Test semua 3 endpoint Syariah
    - File: `tests/integration/syariah.test.ts`
    - _Requirements: 4.5_

  - [ ]* 19.6 Tulis integration test untuk Members endpoints
    - Test semua 2 endpoint Members
    - File: `tests/integration/members.test.ts`
    - _Requirements: 4.6_

  - [ ]* 19.7 Tulis integration test untuk Other endpoints
    - Test semua 4 endpoint Other
    - File: `tests/integration/other.test.ts`
    - _Requirements: 4.7_

  - [ ]* 19.8 Tulis integration test untuk Admin endpoints
    - Test semua 6 endpoint Admin dengan autentikasi valid
    - File: `tests/integration/admin.test.ts`
    - _Requirements: 4.8_

  - [ ]* 19.9 Tulis integration test untuk Health endpoint
    - Test format respons health, field yang diperlukan, akses tanpa autentikasi
    - File: `tests/integration/health.test.ts`
    - _Requirements: 7.1, 7.2_

- [x] 20. Final checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan ke pengguna jika ada pertanyaan.

## Catatan

- Task dengan tanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan persyaratan spesifik untuk traceability
- Checkpoint memastikan validasi inkremental di setiap tahap
- Property tests memvalidasi correctness properties universal dari dokumen desain
- Unit tests memvalidasi contoh spesifik dan edge cases
- Bahasa implementasi: TypeScript (sesuai codebase dan dokumen desain)
