// Legacy HTML Scraper — Fallback for announcements when API fails
// Dipisah dari announcements.ts untuk menjaga file size < 150 baris

import { createPage } from '../utils/browser';
import type { Announcement } from '../types';
import { DEFAULT_CONFIG } from '../types';

/**
 * Scrape pengumuman dari halaman Keterbukaan Informasi (HTML fallback).
 * Digunakan saat IDX API gagal (Cloudflare, timeout, dll).
 */
export async function scrapeAnnouncementsHTML(
  baseUrl: string = DEFAULT_CONFIG.idxBaseUrl,
  max = 50,
): Promise<Announcement[]> {
  const page = await createPage();
  try {
    console.log('[Announcements] Scraping (HTML fallback)...');
    await page.goto(`${baseUrl}/id/perusahaan-tercatat/keterbukaan-informasi/`, {
      waitUntil: 'networkidle', timeout: 60000,
    });
    await page.waitForTimeout(5000);

    const items = await page.evaluate(() => {
      const result: Announcement[] = [];
      const container = document.querySelector('.disclosure-tab');
      if (!container) return result;

      container.querySelectorAll('.attach-card').forEach((card: any) => {
        const timeEl = card.querySelector('time');
        const titleEl = card.querySelector('.title, h6 a, h6');
        if (!timeEl || !titleEl) return;

        const titleLinkEl = titleEl.tagName === 'A' ? titleEl : titleEl.querySelector('a');
        const titleText = (titleLinkEl?.textContent || titleEl.textContent || '').replace(/\s+/g, ' ').trim();
        const fullText = card.textContent?.replace(/\s+/g, ' ').trim() || '';

        const dateMatch = fullText.match(/(\d{2}\s+\w+\s+\d{4})\s+(\d{2}:\d{2}:\d{2})/);
        const codeMatch = titleText.match(/\[([A-Z]{1,6})\s*\]/);

        const titleHref = titleLinkEl?.getAttribute('href') || '';
        const files: { name: string; url: string }[] = [];
        const seen = new Set<string>();

        card.querySelectorAll('a[href*="StaticData"]').forEach((link: any) => {
          const name = link.textContent?.trim() || '';
          const href = link.getAttribute('href') || '';
          if (name && href && !seen.has(name) && href !== titleHref && !name.match(/^\[.*\]$/)) {
            seen.add(name);
            files.push({ name, url: href });
          }
        });

        result.push({
          date: dateMatch?.[1] || '', time: dateMatch?.[2] || '',
          title: titleText, stockCode: codeMatch?.[1]?.trim() || null, files,
        });
      });

      return result;
    });

    console.log(`[Announcements] HTML scrape returned ${items.length} items`);
    return items.slice(0, max);
  } finally {
    await page.close();
  }
}
