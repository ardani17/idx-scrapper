// Listed Client — ESG Rating
// Scrape from https://www.idx.co.id/en/listed-companies/esg/

import { browserManager } from '../../utils/browser';
import { logger } from '../../utils/logger';

export interface EsgRatingItem {
  company: string;
  code: string;
  rating: string;
  year: string;
}

export class EsgRatingClient {
  async getEsgRatings(): Promise<EsgRatingItem[]> {
    logger.info('Fetching ESG ratings...');

    const page = await browserManager.acquirePage();
    try {
      await page.goto('https://www.idx.co.id/en/listed-companies/esg/', {
        waitUntil: 'networkidle',
        timeout: 60000,
      });

      // Wait for table or data to load
      try {
        await page.waitForSelector('table, [class*="table"], [class*="esg"]', { timeout: 10000 });
      } catch {
        // Table might not exist — proceed with what's available
      }

      await page.waitForTimeout(3000);

      const items = await page.evaluate(() => {
        const results: EsgRatingItem[] = [];

        // Strategy 1: Standard table with tbody
        const rows = document.querySelectorAll('table tbody tr');
        if (rows.length > 0) {
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              results.push({
                company: cells[0]?.textContent?.trim() || '',
                code: cells[1]?.textContent?.trim() || '',
                rating: cells[2]?.textContent?.trim() || '',
                year: cells[3]?.textContent?.trim() || '',
              });
            }
          });
        }

        // Strategy 2: Table without tbody
        if (results.length === 0) {
          const allRows = document.querySelectorAll('table tr');
          allRows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              results.push({
                company: cells[0]?.textContent?.trim() || '',
                code: cells[1]?.textContent?.trim() || '',
                rating: cells[2]?.textContent?.trim() || '',
                year: cells[3]?.textContent?.trim() || '',
              });
            }
          });
        }

        // Strategy 3: Look for cards/grid or list items
        if (results.length === 0) {
          // Try to find list items or divs with ESG data
          const text = document.body.innerText;
          const lines = text.split('\n').filter(l => l.trim());
          for (let i = 0; i < lines.length - 2; i++) {
            // Pattern: company name, code, rating
            if (lines[i].length > 3 && /^[A-Z]{4,6}$/i.test(lines[i + 1]?.trim())) {
              results.push({
                company: lines[i].trim(),
                code: lines[i + 1].trim(),
                rating: lines[i + 2].trim(),
                year: lines[i + 3]?.trim() || '',
              });
            }
          }
        }

        // Filter out header-like rows
        return results.filter(item =>
          item.code && item.code.length >= 4 &&
          !item.code.toLowerCase().includes('code') &&
          !item.code.toLowerCase().includes('company')
        );
      });

      logger.info('ESG ratings fetched', { count: items.length });
      return items;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('ESG fetch failed', { error: msg });
      throw err;
    } finally {
      await browserManager.releasePage(page);
    }
  }
}

export default EsgRatingClient;
