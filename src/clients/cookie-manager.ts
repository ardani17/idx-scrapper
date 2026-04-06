// Cookie Manager — Playwright-based Cloudflare cookie refresh

import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { CookieJar, ScraperConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';

export class CookieManager {
  private jar: CookieJar | null = null;
  private config: ScraperConfig;
  private refreshing = false;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setCookies(cookieString: string): void {
    this.jar = {
      cookies: cookieString,
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.config.cookieMaxAge,
    };
  }

  getCookies(): string {
    if (!this.jar) throw new Error('No cookies available');
    return this.jar.cookies;
  }

  isValid(): boolean {
    return !!this.jar && Date.now() < this.jar.expiresAt;
  }

  getStatus(): { valid: boolean; updatedAt: number; expiresAt: number; remainingMs: number } {
    if (!this.jar) return { valid: false, updatedAt: 0, expiresAt: 0, remainingMs: 0 };
    return {
      valid: this.isValid(),
      updatedAt: this.jar.updatedAt,
      expiresAt: this.jar.expiresAt,
      remainingMs: Math.max(0, this.jar.expiresAt - Date.now()),
    };
  }

  async ensure(): Promise<string> {
    if (this.isValid()) return this.getCookies();
    return this.refresh();
  }

  async refresh(): Promise<string> {
    if (this.refreshing) {
      while (this.refreshing) await new Promise(r => setTimeout(r, 500));
      return this.getCookies();
    }

    this.refreshing = true;
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-devshm-usage', '--disable-gpu'],
      });

      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
      });

      const page = await context.newPage();
      await page.goto(this.config.idxBaseUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);

      const cookies = await context.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      if (!cookieString) throw new Error('No cookies extracted');

      this.jar = {
        cookies: cookieString,
        updatedAt: Date.now(),
        expiresAt: Date.now() + this.config.cookieMaxAge,
      };

      console.log(`[Cookies] Refreshed (${cookies.length} cookies)`);
      return cookieString;
    } finally {
      try { if (context) await context.close(); } catch {}
      try { if (browser) await browser.close(); } catch {}
      this.refreshing = false;
    }
  }
}
