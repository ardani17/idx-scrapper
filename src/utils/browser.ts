// BrowserManager — Connection pool with semaphore pattern for Playwright pages

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { logger } from './logger';

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-devshm-usage',
  '--disable-gpu',
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ACQUIRE_TIMEOUT_MS = 30_000;

interface QueueEntry {
  resolve: (page: Page) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface IBrowserManager {
  acquirePage(): Promise<Page>;
  releasePage(page: Page): Promise<void>;
  getActivePagesCount(): number;
  isConnected(): boolean;
  destroy(): Promise<void>;
}

export class BrowserManager implements IBrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePages = 0;
  private readonly maxPages: number;
  private readonly waitQueue: QueueEntry[] = [];
  private reconnecting = false;

  constructor(maxPages?: number) {
    this.maxPages = maxPages ?? parseInt(process.env.MAX_BROWSER_PAGES || '5', 10);
  }

  // ── Browser lifecycle ─────────────────────────

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.reconnecting) {
      // Wait briefly for an in-flight reconnect to finish
      await new Promise((r) => setTimeout(r, 500));
      if (this.browser && this.browser.isConnected()) return this.browser;
    }

    this.reconnecting = true;
    try {
      // Clean up stale references
      await this.closeBrowserSilently();

      logger.info('Launching browser');
      this.browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });

      // Auto-reconnect on unexpected disconnect
      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected unexpectedly');
        this.browser = null;
        this.context = null;
        // Reject all queued waiters so they can retry
        this.drainQueueWithError(new Error('Browser disconnected'));
      });

      this.context = null; // reset context when browser restarts
      return this.browser;
    } finally {
      this.reconnecting = false;
    }
  }

  private async ensureContext(): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();
    if (!this.context) {
      this.context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
      });
    }
    return this.context;
  }

  // ── Public API ────────────────────────────────

  async acquirePage(): Promise<Page> {
    // Fast path: slot available
    if (this.activePages < this.maxPages) {
      this.activePages++;
      try {
        const ctx = await this.ensureContext();
        return await ctx.newPage();
      } catch (err) {
        this.activePages--;
        throw err;
      }
    }

    // Slow path: wait in FIFO queue with timeout
    return new Promise<Page>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const idx = this.waitQueue.findIndex((e) => e.resolve === resolve);
        if (idx !== -1) this.waitQueue.splice(idx, 1);
        reject(new Error(`acquirePage timeout after ${ACQUIRE_TIMEOUT_MS}ms — pool full (${this.maxPages} pages)`));
      }, ACQUIRE_TIMEOUT_MS);

      this.waitQueue.push({ resolve, reject, timeoutId });
    });
  }

  async releasePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch {
      // page may already be closed or browser disconnected
    }

    this.activePages = Math.max(0, this.activePages - 1);

    // Signal next waiter in FIFO queue
    this.processQueue();
  }

  getActivePagesCount(): number {
    return this.activePages;
  }

  isConnected(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  async destroy(): Promise<void> {
    this.drainQueueWithError(new Error('BrowserManager destroyed'));
    await this.closeBrowserSilently();
    this.activePages = 0;
  }

  // ── Internal helpers ──────────────────────────

  private processQueue(): void {
    if (this.waitQueue.length === 0 || this.activePages >= this.maxPages) return;

    const entry = this.waitQueue.shift()!;
    clearTimeout(entry.timeoutId);
    this.activePages++;

    this.ensureContext()
      .then((ctx) => ctx.newPage())
      .then((page) => entry.resolve(page))
      .catch((err) => {
        this.activePages = Math.max(0, this.activePages - 1);
        entry.reject(err);
        // Try next waiter
        this.processQueue();
      });
  }

  private drainQueueWithError(error: Error): void {
    while (this.waitQueue.length > 0) {
      const entry = this.waitQueue.shift()!;
      clearTimeout(entry.timeoutId);
      entry.reject(error);
    }
  }

  private async closeBrowserSilently(): Promise<void> {
    if (this.context) {
      try { await this.context.close(); } catch {}
      this.context = null;
    }
    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
    }
  }
}

// ── Backward-compatible exports ─────────────────

/** Singleton instance for the entire application */
export const browserManager = new BrowserManager();

/** @deprecated Use browserManager.acquirePage() instead */
export async function createPage(): Promise<Page> {
  return browserManager.acquirePage();
}

/** @deprecated Use browserManager.destroy() instead */
export async function destroyBrowser(): Promise<void> {
  return browserManager.destroy();
}

/** @deprecated Use browserManager.acquirePage() instead */
export async function getBrowser(): Promise<Browser> {
  // Keep for any legacy code that needs the raw browser
  return (browserManager as any).ensureBrowser();
}

/** @deprecated Use browserManager.acquirePage() instead */
export async function getContext(): Promise<BrowserContext> {
  return (browserManager as any).ensureContext();
}
