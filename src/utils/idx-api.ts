// IDX API Helpers — Cloudflare bypass v2
// Strategy: navigate langsung ke URL API sebagai page (CF solve untuk URL itu)

import { createPage } from './browser';
import { logger } from './logger';

export interface FetchIdxOptions {
  /** API path relatif, e.g. "/primary/Home/GetTradeSummary" */
  apiPath: string;
  /** Query params */
  params?: Record<string, string>;
  /** Landing page URL to visit first for cookie/auth context (optional) */
  landingPage?: string;
  /** page.goto timeout (ms) */
  timeout?: number;
  /** Max retry attempts */
  maxRetries?: number;
}

/**
 * Fetch IDX JSON API dengan Cloudflare bypass.
 * 
 * KEY: page.goto(apiUrl) — CF solves untuk URL tersebut.
 * Lalu baca responseText dari body.
 */
export async function fetchIdxApi<T = any>(options: FetchIdxOptions): Promise<T> {
  const {
    apiPath,
    params,
    landingPage,
    timeout = 60000,
    maxRetries = 2,
  } = options;

  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const apiUrl = `https://www.idx.co.id${apiPath}${qs}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const page = await createPage();
    try {
      // Optionally visit landing page first for cookie context
      if (landingPage) {
        await page.goto(landingPage, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }

      // Navigate langsung ke URL API → CF auto-solve
      const resp = await page.goto(apiUrl, {
        waitUntil: 'networkidle',
        timeout,
      });

      await page.waitForTimeout(2000);

      if (!resp) throw new Error('No response');

      const contentType = resp.headers()['content-type'] || '';

      // JSON response — parse body text
      if (contentType.includes('application/json') || !contentType.includes('text/html')) {
        const text = await page.evaluate(() => document.body?.innerText || '');
        return JSON.parse(text) as T;
      }

      // HTML response — cek CF challenge
      const html = await page.content();
      if (html.includes('Just a moment') || html.includes('cloudflare-challenge')) {
        await page.waitForTimeout(5000);
        const html2 = await page.content();
        if (!html2.includes('Just a moment')) {
          const text = await page.evaluate(() => document.body?.innerText || '');
          return JSON.parse(text) as T;
        }
        throw new Error(`CF challenge not solved (attempt ${attempt})`);
      }

      // Bukan CF — coba parse body
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      try {
        return JSON.parse(bodyText) as T;
      } catch {
        throw new Error(`Non-JSON: ${bodyText.slice(0, 100)}`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('IdxApi retry', {
        apiPath, attempt, maxAttempts: maxRetries + 1,
        error: lastError.message,
      });
    } finally {
      await page.close().catch(() => {});
    }

    if (attempt <= maxRetries) {
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }

  throw lastError || new Error('fetchIdxApi failed');
}
