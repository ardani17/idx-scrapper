// Market Client — INDOBeX (Bond Index via HTML scrape)
// https://www.idx.co.id/en/market-data/bond-data/indobex/

import { browserManager } from '../../utils/browser';
import { logger } from '../../utils/logger';

export interface IndobexItem {
  name: string;
  index: string;
  yield_value: string;
  change: string;
}

export class IndobexClient {
  async getIndobex(): Promise<IndobexItem[]> {
    logger.info('Fetching INDOBeX bond index data...');

    const page = await browserManager.acquirePage();
    try {
      await page.goto('https://www.idx.co.id/en/market-data/bond-data/indobex/', {
        waitUntil: 'networkidle',
        timeout: 60000,
      });

      // Wait for table or data to load
      try {
        await page.waitForSelector('table, .bond-table, [class*="table"]', { timeout: 10000 });
      } catch {
        // Table might not exist — proceed with what's available
      }

      await page.waitForTimeout(3000);

      const items = await page.evaluate(() => {
        const results: { name: string; index: string; yield_value: string; change: string }[] = [];

        // Strategy 1: Try standard table rows
        const rows = document.querySelectorAll('table tbody tr');
        if (rows.length > 0) {
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
              results.push({
                name: cells[0]?.textContent?.trim() || '',
                index: cells[1]?.textContent?.trim() || '',
                yield_value: cells[2]?.textContent?.trim() || '',
                change: cells[3]?.textContent?.trim() || '',
              });
            }
          });
        }

        // Strategy 2: Try table without tbody
        if (results.length === 0) {
          const allRows = document.querySelectorAll('table tr');
          allRows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
              results.push({
                name: cells[0]?.textContent?.trim() || '',
                index: cells[1]?.textContent?.trim() || '',
                yield_value: cells[2]?.textContent?.trim() || '',
                change: cells[3]?.textContent?.trim() || '',
              });
            }
          });
        }

        // Strategy 3: Try to find any card/grid layout with bond data
        if (results.length === 0) {
          // Look for specific IDX page structure
          const cards = document.querySelectorAll('[class*="bond"], [class*="index"], [class*="card"]');
          const text = document.body.innerText;
          // Extract anything that looks like bond index data
          const lines = text.split('\n').filter(l => l.trim());
          for (let i = 0; i < lines.length - 3; i++) {
            // Pattern: name, number, number, number
            if (/^[A-Z]/.test(lines[i]) && /\d/.test(lines[i + 1])) {
              results.push({
                name: lines[i].trim(),
                index: lines[i + 1].trim(),
                yield_value: lines[i + 2].trim(),
                change: lines[i + 3].trim(),
              });
            }
          }
        }

        return results;
      });

      logger.info('INDOBeX data fetched', { count: items.length });
      return items;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('INDOBeX fetch failed', { error: msg });
      throw err;
    } finally {
      await browserManager.releasePage(page);
    }
  }
}

export default IndobexClient;
