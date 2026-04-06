// File Downloader — Download IDX attachments via XHR inside Playwright

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { promises as fs } from 'fs';
import { join, basename } from 'path';

export class FileDownloader {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private storageDir: string;
  private readonly baseUrl = 'https://www.idx.co.id';

  constructor(storageDir: string) {
    this.storageDir = storageDir;
  }

  // ── Page management (reuse single page) ────────

  private async getPage(): Promise<Page> {
    if (this.page) {
      try {
        if (this.page.url().includes('idx.co.id')) return this.page;
      } catch {}
    }
    return this.initPage();
  }

  private async initPage(): Promise<Page> {
    await this.close();

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-devshm-usage', '--disable-gpu'],
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });

    this.page = await this.context.newPage();
    console.log('[Downloader] Loading idx.co.id...');
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await this.page.waitForTimeout(5000);
    console.log('[Downloader] Page ready ✓');
    return this.page;
  }

  // ── Download via XHR (Cloudflare cookies included) ──

  async downloadFile(fileUrl: string, destDir: string): Promise<{
    success: boolean; localPath: string | null; fileName: string; sizeBytes: number; error?: string;
  }> {
    await fs.mkdir(destDir, { recursive: true });

    const fullUrl = fileUrl.startsWith('http') ? fileUrl : this.baseUrl + fileUrl;
    const fileName = decodeURIComponent(basename(new URL(fullUrl).pathname)) || 'download';
    const localPath = join(destDir, fileName);

    // Skip if exists
    try {
      const stat = await fs.stat(localPath);
      if (stat.size > 0) {
        console.log(`[Downloader] ⏭️ ${fileName} (exists)`);
        return { success: true, localPath, fileName, sizeBytes: stat.size };
      }
    } catch {}

    const page = await this.getPage();

    try {
      console.log(`[Downloader] ⬇️ ${fileName}...`);

      const result = await page.evaluate(async (url: string) => {
        return new Promise<{ ok: boolean; status: number; body: string; size: number }>(resolve => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.responseType = 'arraybuffer';
          xhr.timeout = 120000;
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 400) {
              const bytes = new Uint8Array(xhr.response);
              let binary = '';
              const chunk = 8192;
              for (let i = 0; i < bytes.length; i += chunk) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
              }
              resolve({ ok: true, status: xhr.status, body: btoa(binary), size: bytes.length });
            } else {
              resolve({ ok: false, status: xhr.status, body: '', size: 0 });
            }
          };
          xhr.onerror = () => resolve({ ok: false, status: 0, body: '', size: 0 });
          xhr.ontimeout = () => resolve({ ok: false, status: 0, body: '', size: 0 });
          xhr.send();
        });
      }, fullUrl);

      if (!result.ok || result.size === 0) {
        console.log(`[Downloader] ❌ ${fileName}: HTTP ${result.status}`);
        if (result.status === 403) this.page = null; // reset for fresh cookies
        return { success: false, localPath: null, fileName, sizeBytes: 0, error: `HTTP ${result.status}` };
      }

      const buffer = Buffer.from(result.body, 'base64');
      await fs.writeFile(localPath, buffer);
      console.log(`[Downloader] ✅ ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
      return { success: true, localPath, fileName, sizeBytes: buffer.length };

    } catch (error: any) {
      console.log(`[Downloader] ❌ ${fileName}: ${error.message}`);
      this.page = null;
      return { success: false, localPath: null, fileName, sizeBytes: 0, error: error.message };
    }
  }

  // ── Batch download ─────────────────────────────

  async downloadFiles(
    files: { name: string; url: string }[],
    date: string,
    stockCode: string | null,
  ) {
    const dateSlug = date.replace(/(\d{2})\s+(\w+)\s+(\d{4})/, (_, d, m, y) => {
      const months: Record<string, string> = {
        Januari: '01', Februari: '02', Maret: '03', April: '04', Mei: '05', Juni: '06',
        Juli: '07', Agustus: '08', September: '09', Oktober: '10', November: '11', Desember: '12',
      };
      return `${y}-${months[m] || '00'}-${d}`;
    });

    const destDir = join(this.storageDir, dateSlug, stockCode || 'GENERAL');
    const results = await Promise.all(
      files.map(f => this.downloadFile(f.url, destDir).catch(e => ({
        success: false, localPath: null, fileName: f.name, sizeBytes: 0, error: e.message,
      })))
    );

    const ok = results.filter(r => r.success);
    const fail = results.filter(r => !r.success);
    console.log(`[Downloader] 📁 ${dateSlug}/${stockCode || 'GENERAL'}: ${ok.length} OK, ${fail.length} failed`);

    return {
      folder: `${dateSlug}/${stockCode || 'GENERAL'}`,
      results,
      totalDownloaded: ok.length,
      totalFailed: fail.length,
      totalSize: ok.reduce((sum, r) => sum + r.sizeBytes, 0),
    };
  }

  // ── File listing ───────────────────────────────

  async listFiles(subfolder?: string): Promise<{
    folders: { name: string; files: { name: string; size: number; modified: string }[] }[];
    totalSize: number;
  }> {
    const baseDir = subfolder ? join(this.storageDir, subfolder) : this.storageDir;
    const folders: any[] = [];
    let totalSize = 0;

    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        if (entry.isFile()) {
          const stat = await fs.stat(join(baseDir, entry.name));
          files.push({ name: entry.name, size: stat.size, modified: stat.mtime.toISOString() });
          totalSize += stat.size;
        }
      }
      if (files.length) folders.push({ name: subfolder || '', files });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nested = await this.listFiles(`${subfolder ? subfolder + '/' : ''}${entry.name}`);
          folders.push(...nested.folders);
          totalSize += nested.totalSize;
        }
      }
    } catch {}

    return { folders, totalSize };
  }

  // ── Helpers ────────────────────────────────────

  resolvePath(relativePath: string): string {
    return join(this.storageDir, relativePath);
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  private async close() {
    try { if (this.page) await this.page.close(); } catch {}
    try { if (this.context) await this.context.close(); } catch {}
    try { if (this.browser) await this.browser.close(); } catch {}
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  async destroy() { await this.close(); }
}
