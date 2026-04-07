// File Downloader — Download IDX attachments via XHR inside Playwright (shared BrowserManager)

import { type Page } from 'playwright';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { browserManager } from '../utils/browser';
import { logger } from '../utils/logger';

export class FileDownloader {
  private storageDir: string;
  private readonly baseUrl = 'https://www.idx.co.id';

  constructor(storageDir: string) {
    this.storageDir = storageDir;
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
        logger.debug('File already exists, skipping', { fileName });
        return { success: true, localPath, fileName, sizeBytes: stat.size };
      }
    } catch {}

    let page: Page | null = null;
    try {
      page = await browserManager.acquirePage();

      // Navigate to IDX to pick up Cloudflare cookies
      logger.info('Navigating to idx.co.id for cookies', { fileName });
      await page.goto(this.baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);

      logger.info('Downloading file', { fileName, url: fullUrl });

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
        logger.warn('Download failed', { fileName, httpStatus: result.status });
        return { success: false, localPath: null, fileName, sizeBytes: 0, error: `HTTP ${result.status}` };
      }

      const buffer = Buffer.from(result.body, 'base64');
      await fs.writeFile(localPath, buffer);
      logger.info('Download complete', { fileName, sizeKB: (buffer.length / 1024).toFixed(1) });
      return { success: true, localPath, fileName, sizeBytes: buffer.length };

    } catch (error: any) {
      logger.error('Download error', { fileName, error: error.message });
      return { success: false, localPath: null, fileName, sizeBytes: 0, error: error.message };
    } finally {
      if (page) {
        await browserManager.releasePage(page);
      }
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
    logger.info('Batch download summary', {
      folder: `${dateSlug}/${stockCode || 'GENERAL'}`,
      downloaded: ok.length,
      failed: fail.length,
    });

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
    const resolved = join(this.storageDir, relativePath);
    const normalized = (resolved + '/').replace(/\\/g, '/');
    const base = (this.storageDir + '/').replace(/\\/g, '/');
    if (!normalized.startsWith(base)) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  async destroy(): Promise<void> {
    // Browser lifecycle is now managed by BrowserManager singleton — nothing to clean up here
  }
}
