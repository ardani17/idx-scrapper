// Shared Playwright browser management — persistent context for cookie reuse

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-devshm-usage',
  '--disable-gpu',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
    context = null; // reset context when browser restarts
  }
  return browser;
}

/** Get or create persistent browser context (reuses cookies across calls) */
export async function getContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  if (!context || !context.pages().length) {
    // Check if old context is still valid
    try {
      if (context) await context.close();
    } catch {}
    
    context = await b.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });
  }
  return context;
}

/** Create new page in persistent context */
export async function createPage(): Promise<Page> {
  const ctx = await getContext();
  return ctx.newPage();
}

export async function destroyBrowser(): Promise<void> {
  if (context) { try { await context.close(); } catch {} context = null; }
  if (browser) { try { await browser.close(); } catch {} browser = null; }
}
