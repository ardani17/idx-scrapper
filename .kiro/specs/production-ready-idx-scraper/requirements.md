# Dokumen Persyaratan — IDX Scraper Production-Ready

## Pendahuluan

Dokumen ini mendefinisikan persyaratan untuk menyempurnakan proyek IDX Scraper agar siap dijual secara komersial (production-ready). IDX Scraper adalah REST API berbasis Bun + Elysia yang melakukan scraping data Bursa Efek Indonesia (IDX) melalui Playwright browser automation dengan bypass Cloudflare. Proyek memiliki 50+ endpoint di 8 kategori (Market, Listed, News, Disclosure, Syariah, Members, Other, Admin).

Penyempurnaan mencakup: keamanan, validasi input, error handling, testing, performa, monitoring, dan kesiapan deployment.

## Glosarium

- **API_Server**: Aplikasi REST API IDX Scraper berbasis Elysia framework
- **Endpoint**: Rute HTTP yang melayani permintaan data dari klien
- **API_Key_Manager**: Modul yang mengelola pembuatan, validasi, dan pembatasan API key
- **Admin_Guard**: Middleware yang memverifikasi akses admin melalui header X-Admin-Key
- **Rate_Limiter**: Komponen yang membatasi jumlah permintaan per menit dan per hari per API key
- **Cache_Store**: Penyimpanan berbasis Redis dengan TTL untuk menyimpan hasil scraping sementara, dikonfigurasi melalui variabel lingkungan REDIS_URL atau REDIS_HOST/REDIS_PORT
- **Browser_Manager**: Modul yang mengelola instance Playwright Chromium untuk scraping
- **IDX_Client**: Klien yang melakukan scraping data dari situs idx.co.id
- **Disclosure_Client**: Klien yang mengambil data pengumuman dan laporan keuangan dari IDX
- **File_Downloader**: Modul yang mengunduh file lampiran disclosure melalui XHR di Playwright
- **Cookie_Manager**: Modul yang mengelola cookie sesi untuk bypass Cloudflare
- **Health_Endpoint**: Endpoint yang melaporkan status kesehatan sistem
- **Validator**: Komponen yang memvalidasi input dari pengguna API
- **Test_Suite**: Kumpulan test otomatis untuk memverifikasi fungsionalitas endpoint

## Persyaratan

### Persyaratan 1: Penguatan Keamanan Admin

**User Story:** Sebagai pemilik API, saya ingin sistem admin dilindungi dengan kunci yang kuat dan aman, sehingga tidak ada akses tidak sah ke manajemen API key.

#### Kriteria Penerimaan

1. WHEN API_Server dimulai tanpa variabel lingkungan ADMIN_API_KEY, THEN THE API_Server SHALL menolak untuk memulai dan mencatat pesan error yang menjelaskan bahwa ADMIN_API_KEY wajib diatur
2. THE Admin_Guard SHALL memvalidasi bahwa nilai ADMIN_API_KEY memiliki panjang minimal 32 karakter
3. WHEN permintaan admin diterima dengan kunci yang salah, THE Admin_Guard SHALL mengembalikan respons HTTP 401 dengan pesan error generik tanpa mengungkapkan detail kunci yang benar
4. THE Admin_Guard SHALL menggunakan perbandingan waktu-konstan (constant-time comparison) saat memverifikasi kunci admin untuk mencegah serangan timing
5. WHEN lebih dari 10 percobaan autentikasi admin gagal dari satu alamat IP dalam 5 menit, THE Rate_Limiter SHALL memblokir permintaan admin dari alamat IP tersebut selama 15 menit

### Persyaratan 2: Validasi Input Seluruh Endpoint

**User Story:** Sebagai pengguna API, saya ingin semua input divalidasi dengan benar, sehingga saya mendapat pesan error yang jelas ketika mengirim parameter yang salah.

#### Kriteria Penerimaan

1. THE Validator SHALL memvalidasi semua parameter query numerik (pageSize, indexFrom, page, limit) sebagai bilangan bulat positif dengan batas maksimum yang ditentukan per endpoint
2. WHEN parameter query berisi karakter yang tidak valid, THE Validator SHALL mengembalikan respons HTTP 400 dengan pesan yang menjelaskan parameter mana yang salah dan format yang diharapkan
3. THE Validator SHALL memvalidasi parameter kode saham (stock code) menggunakan pola regex ^[A-Z]{3,6}$ dan menolak kode yang tidak sesuai
4. WHEN body permintaan POST untuk pembuatan API key tidak mengandung field wajib (name, tier), THE Validator SHALL mengembalikan respons HTTP 400 dengan daftar field yang hilang
5. THE Validator SHALL memvalidasi parameter tanggal (dateFrom, dateTo) menggunakan format ISO 8601 (YYYY-MM-DD) dan menolak tanggal yang tidak valid
6. WHEN parameter pageSize melebihi batas maksimum 100, THE Validator SHALL mengembalikan respons HTTP 400 dengan pesan yang menjelaskan batas maksimum

### Persyaratan 3: Error Handling yang Konsisten

**User Story:** Sebagai pengguna API, saya ingin semua error dikembalikan dalam format yang konsisten, sehingga saya dapat menangani error secara programatis.

#### Kriteria Penerimaan

1. THE API_Server SHALL mengembalikan semua respons error dalam format JSON dengan field: success (boolean), error (string), statusCode (number), dan fetchedAt (string ISO 8601)
2. WHEN scraping gagal karena timeout Cloudflare, THE API_Server SHALL mengembalikan respons HTTP 503 dengan pesan "Sumber data IDX tidak tersedia, silakan coba lagi" dan header Retry-After dalam detik
3. WHEN scraping gagal karena error parsing HTML, THE API_Server SHALL mencatat detail error lengkap ke log dan mengembalikan pesan error generik kepada pengguna tanpa mengungkapkan detail internal
4. IF exception yang tidak tertangkap terjadi di handler endpoint, THEN THE API_Server SHALL menangkap exception tersebut, mencatat stack trace ke log, dan mengembalikan respons HTTP 500 dengan pesan error generik
5. THE API_Server SHALL menyertakan header X-Request-Id unik di setiap respons untuk memudahkan pelacakan masalah
6. WHEN Browser_Manager gagal meluncurkan instance Chromium, THE API_Server SHALL mengembalikan respons HTTP 503 dan mencoba meluncurkan ulang browser pada permintaan berikutnya

### Persyaratan 4: Semua Endpoint Aktif dan Terverifikasi

**User Story:** Sebagai pembeli API, saya ingin semua endpoint yang didokumentasikan berfungsi dengan benar, sehingga saya mendapat nilai penuh dari produk yang saya beli.

#### Kriteria Penerimaan

1. THE API_Server SHALL melayani semua 19 endpoint Market (trading-summary, index-summary, stock-summary, broker-summary, top-gainer, top-loser, top-volume, top-value, top-frequent, suspend, stock-list, stock-index, margin-stocks, pre-open, lp-stocks, bond-summary, indobex, derivatives, etf-list, etf-inav) dengan respons HTTP 200 dan data yang valid
2. THE API_Server SHALL melayani semua 5 endpoint Listed (corporate-action, calendar, special-notation, watchlist, esg-rating) dengan respons HTTP 200 dan data yang valid
3. THE API_Server SHALL melayani semua 8 endpoint News (news, press-release, articles, uma, suspension, etd, td, trading-holiday) dengan respons HTTP 200 dan data yang valid
4. THE API_Server SHALL melayani semua 6 endpoint Disclosure (announcements, berita-pengumuman, financial-reports, download, monitor/check-new, monitor/state) dengan respons HTTP 200 dan data yang valid
5. THE API_Server SHALL melayani semua 3 endpoint Syariah (products, index, transaction) dengan respons HTTP 200 dan data yang valid
6. THE API_Server SHALL melayani semua 2 endpoint Members (brokers, participants) dengan respons HTTP 200 dan data yang valid
7. THE API_Server SHALL melayani semua 4 endpoint Other (statistics, new-listing, fact-sheet-lq45, bond-book) dengan respons HTTP 200 dan data yang valid
8. THE API_Server SHALL melayani semua 6 endpoint Admin (keys/generate, keys list, keys/:id get, keys/:id patch, keys/:id delete, stats) dengan respons HTTP 200 ketika autentikasi admin valid
9. WHEN endpoint mengembalikan data kosong dari IDX, THE API_Server SHALL tetap mengembalikan respons HTTP 200 dengan array data kosong dan field success bernilai true

### Persyaratan 5: Testing Komprehensif

**User Story:** Sebagai pengembang, saya ingin semua endpoint memiliki test otomatis, sehingga saya dapat memverifikasi bahwa perubahan kode tidak merusak fungsionalitas yang ada.

#### Kriteria Penerimaan

1. THE Test_Suite SHALL menyertakan unit test untuk setiap fungsi di API_Key_Manager: generateKey, validateKey, checkRateLimit, listKeys, getKey, updateKey, dan deleteKey
2. THE Test_Suite SHALL menyertakan unit test untuk Cache_Store yang memverifikasi: koneksi ke Redis, penyimpanan data, pengambilan data, kedaluwarsa TTL, penghapusan manual, dan fallback ke in-memory ketika Redis tidak tersedia
3. THE Test_Suite SHALL menyertakan unit test untuk Rate_Limiter yang memverifikasi: pembatasan per menit, reset window, dan pembersihan entry kedaluwarsa
4. THE Test_Suite SHALL menyertakan integration test untuk setiap kategori endpoint (Market, Listed, News, Disclosure, Syariah, Members, Other, Admin) yang memverifikasi respons HTTP dan format data
5. THE Test_Suite SHALL menyertakan test untuk middleware autentikasi yang memverifikasi: permintaan tanpa API key ditolak dengan HTTP 401, API key tidak valid ditolak, API key nonaktif ditolak, dan API key valid diterima
6. THE Test_Suite SHALL menyertakan test untuk validasi input yang memverifikasi: parameter tidak valid menghasilkan HTTP 400, parameter valid diterima, dan batas pagination dihormati
7. THE Test_Suite SHALL menyertakan test untuk format respons error yang memverifikasi keberadaan field success, error, statusCode, dan fetchedAt di setiap respons error
8. FOR ALL fungsi di modul format (formatBytes, cleanText), parsing lalu formatting lalu parsing SHALL menghasilkan objek yang ekuivalen (properti round-trip)

### Persyaratan 6: Optimasi Performa dan Caching

**User Story:** Sebagai pengguna API, saya ingin respons cepat dan konsisten, sehingga aplikasi saya tidak terganggu oleh latensi scraping.

#### Kriteria Penerimaan

1. THE Cache_Store SHALL terhubung ke Redis untuk semua operasi caching dan menyimpan hasil scraping Market dengan TTL 30 detik, hasil News dengan TTL 5 menit, dan data statis (Listed, Syariah, Members, Other) dengan TTL 15 menit
2. THE Cache_Store SHALL membaca konfigurasi koneksi Redis dari variabel lingkungan REDIS_URL (format redis://host:port) atau kombinasi REDIS_HOST dan REDIS_PORT (default: localhost:6379)
3. WHEN data yang diminta tersedia di cache Redis dan belum kedaluwarsa, THE API_Server SHALL mengembalikan data dari cache tanpa melakukan scraping ulang dan menyertakan field _cached bernilai true
4. IF koneksi Redis tidak tersedia atau gagal, THEN THE Cache_Store SHALL melakukan fallback ke penyimpanan in-memory sementara dan mencatat peringatan (warning) ke log, serta mencoba menghubungkan ulang ke Redis setiap 30 detik
5. THE Browser_Manager SHALL menggunakan satu instance browser yang dibagikan (shared) untuk semua permintaan scraping dan membuat page baru per permintaan
6. WHEN page Playwright selesai digunakan, THE Browser_Manager SHALL menutup page tersebut dalam blok finally untuk mencegah kebocoran memori
7. THE API_Server SHALL menyertakan header Cache-Control di respons dengan nilai max-age yang sesuai dengan TTL cache endpoint tersebut
8. WHILE jumlah page Playwright yang terbuka melebihi 5, THE Browser_Manager SHALL mengantrekan permintaan baru dan memprosesnya ketika page tersedia (connection pooling)

### Persyaratan 7: Monitoring dan Health Check

**User Story:** Sebagai operator sistem, saya ingin memantau kesehatan API secara real-time, sehingga saya dapat mendeteksi dan menangani masalah sebelum berdampak pada pengguna.

#### Kriteria Penerimaan

1. THE Health_Endpoint SHALL mengembalikan status sistem termasuk: uptime dalam detik, status browser (connected/disconnected), jumlah page aktif, status koneksi Redis (connected/disconnected/fallback), ukuran cache per tier, penggunaan memori proses, dan timestamp
2. THE Health_Endpoint SHALL dapat diakses tanpa autentikasi API key di path /api/health
3. WHEN Browser_Manager terputus atau gagal, THE Health_Endpoint SHALL melaporkan status browser sebagai "disconnected" dan API_Server SHALL mencoba menghubungkan ulang secara otomatis
4. THE API_Server SHALL mencatat setiap permintaan dalam format JSON terstruktur dengan field: timestamp, method, path, statusCode, responseTimeMs, clientIp, dan keyId (jika terautentikasi)
5. THE API_Server SHALL menyediakan endpoint /api/admin/stats yang mengembalikan: total permintaan hari ini, permintaan per tier, 10 konsumen teratas, dan jumlah key per tier
6. WHEN respons endpoint memakan waktu lebih dari 30 detik, THE API_Server SHALL mencatat peringatan (warning) dengan detail endpoint dan durasi

### Persyaratan 8: Kesiapan Deployment Docker

**User Story:** Sebagai operator sistem, saya ingin mendeploy API dengan mudah menggunakan Docker, sehingga deployment konsisten di berbagai lingkungan.

#### Kriteria Penerimaan

1. THE Dockerfile SHALL menggunakan multi-stage build untuk memisahkan tahap instalasi dependensi dan tahap runtime agar ukuran image minimal
2. THE Dockerfile SHALL menyertakan health check menggunakan instruksi HEALTHCHECK yang memanggil endpoint /api/health setiap 30 detik
3. THE API_Server SHALL membaca semua konfigurasi sensitif (ADMIN_API_KEY, API_KEYS, PORT, REDIS_URL atau REDIS_HOST/REDIS_PORT) dari variabel lingkungan dan tidak menyimpan nilai default yang tidak aman di kode sumber
4. THE API_Server SHALL menangani sinyal SIGTERM dan SIGINT dengan menutup browser, menutup koneksi Redis, dan menghentikan server secara graceful dalam waktu 10 detik
5. THE Dockerfile SHALL mendokumentasikan bahwa Redis adalah dependensi eksternal yang diperlukan dan menyertakan contoh konfigurasi docker-compose.yml yang mencakup service Redis
6. THE Dockerfile SHALL menyertakan file .dockerignore yang mengecualikan node_modules, .git, data/, logs/, dan file test
7. THE API_Server SHALL menyimpan data persisten (api-keys.json, daily-usage.json) di direktori /app/data yang dapat di-mount sebagai Docker volume

### Persyaratan 9: Dokumentasi API

**User Story:** Sebagai pengguna API, saya ingin dokumentasi yang lengkap dan akurat, sehingga saya dapat mengintegrasikan API dengan mudah.

#### Kriteria Penerimaan

1. THE API_Server SHALL menyediakan dokumentasi Swagger/OpenAPI di path /api/docs yang mencakup semua endpoint dengan deskripsi, parameter, dan contoh respons
2. THE API_Server SHALL mendokumentasikan setiap endpoint dengan: tag kategori, ringkasan singkat, deskripsi lengkap, parameter input dengan tipe data, dan contoh respons sukses dan error
3. THE API_Server SHALL mendokumentasikan skema autentikasi (X-API-Key header) dan skema admin (X-Admin-Key header) di bagian securitySchemes OpenAPI
4. THE API_Server SHALL menyertakan deskripsi kode respons HTTP (200, 400, 401, 404, 429, 500, 503) di setiap endpoint yang relevan
5. WHEN endpoint memiliki parameter opsional, THE API_Server SHALL mendokumentasikan nilai default parameter tersebut di skema OpenAPI

### Persyaratan 10: Refactoring Kualitas Kode

**User Story:** Sebagai pengembang, saya ingin kode yang bersih dan mudah dipelihara, sehingga saya dapat menambah fitur baru dengan cepat dan aman.

#### Kriteria Penerimaan

1. THE API_Server SHALL menghilangkan duplikasi pola try-catch-cache di semua route handler dengan mengekstrak ke fungsi utilitas bersama (shared utility function)
2. THE API_Server SHALL menggunakan tipe TypeScript yang eksplisit untuk semua parameter fungsi publik dan menghindari penggunaan tipe `any` di file route
3. THE File_Downloader SHALL menggunakan instance Browser_Manager yang dibagikan (shared) alih-alih membuat instance browser terpisah
4. THE API_Server SHALL memisahkan konfigurasi CORS ke modul terpisah yang dapat dikonfigurasi melalui variabel lingkungan (ALLOWED_ORIGINS)
5. THE API_Key_Manager SHALL menggunakan operasi file asinkron (async) alih-alih operasi sinkron (readFileSync, writeFileSync) untuk menghindari pemblokiran event loop
6. THE API_Server SHALL menghilangkan penggunaan console.log langsung dan menggantinya dengan logger terstruktur yang sudah ada di semua modul

### Persyaratan 11: Sistem Rate Limiting yang Robust

**User Story:** Sebagai pemilik API, saya ingin sistem pembatasan permintaan yang andal per tier, sehingga saya dapat menjual paket layanan dengan batasan yang berbeda.

#### Kriteria Penerimaan

1. THE Rate_Limiter SHALL membatasi permintaan per menit sesuai konfigurasi tier: free (30/menit), basic (60/menit), pro (unlimited), advanced (custom)
2. THE Rate_Limiter SHALL membatasi permintaan per hari sesuai konfigurasi tier: free (500/hari), basic (5000/hari), pro (unlimited), advanced (custom)
3. WHEN batas per menit terlampaui, THE API_Server SHALL mengembalikan respons HTTP 429 dengan header Retry-After yang menunjukkan detik hingga window berikutnya
4. WHEN batas per hari terlampaui, THE API_Server SHALL mengembalikan respons HTTP 429 dengan pesan yang menjelaskan bahwa batas harian tercapai dan waktu reset (tengah malam WIB)
5. THE API_Server SHALL menyertakan header X-RateLimit-Limit, X-RateLimit-Remaining, dan X-RateLimit-Reset di setiap respons yang terautentikasi
6. THE Rate_Limiter SHALL mereset hitungan harian pada tengah malam WIB (UTC+7) secara otomatis

### Persyaratan 12: Keamanan API Key

**User Story:** Sebagai pemilik API, saya ingin API key dikelola dengan aman, sehingga key pelanggan tidak dapat disalahgunakan.

#### Kriteria Penerimaan

1. THE API_Key_Manager SHALL menghasilkan API key dengan format `idsk_live_` diikuti 64 karakter hexadecimal acak yang dihasilkan menggunakan crypto.getRandomValues
2. WHEN API key ditampilkan di endpoint list atau detail, THE API_Key_Manager SHALL menampilkan key dalam bentuk tersamarkan (masked) dengan hanya menampilkan 10 karakter pertama dan 4 karakter terakhir
3. THE API_Key_Manager SHALL menyimpan API key dalam file JSON dengan izin akses file yang dibatasi (mode 0600)
4. WHEN API key memiliki tanggal kedaluwarsa (expiresAt) dan tanggal tersebut telah lewat, THE API_Key_Manager SHALL menolak key tersebut dengan pesan "API key telah kedaluwarsa"
5. THE API_Server SHALL mendukung pengiriman API key melalui header X-API-Key atau header Authorization dengan skema Bearer
6. IF API key yang diberikan tidak ditemukan di penyimpanan, THEN THE API_Server SHALL mengembalikan respons HTTP 401 dengan pesan generik "API key tidak valid" tanpa membedakan antara key tidak ada dan key nonaktif
