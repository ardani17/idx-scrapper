// Syariah Routes — IDX Syariah
// GET /api/syariah/products     — Daftar saham syariah
// GET /api/syariah/index        — Indeks syariah (JII, ISSI, dll)
// GET /api/syariah/transaction  — Transaksi sesuai syariah

import { Elysia } from 'elysia';
import { SyariahProductsClient } from '../../clients/syariah/products';
import { SyariahIndexClient } from '../../clients/syariah/index';
import { SyariahTransactionClient } from '../../clients/syariah/transaction';
import { slowCache } from '../../utils/cache';

export function syariahRoutes() {
  const products = new SyariahProductsClient();
  const index = new SyariahIndexClient();
  const transaction = new SyariahTransactionClient();

  return new Elysia({ prefix: '/syariah' })

    // ── Daftar Saham Syariah ─────────────────────
    .get('/products', async () => {
      try {
        const cached = slowCache.get('/syariah/products');
        if (cached) return { ...cached, _cached: true };

        const data = await products.getSyariahProducts();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/syariah/products', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    })

    // ── Indeks Syariah ───────────────────────────
    .get('/index', async () => {
      try {
        const cached = slowCache.get('/syariah/index');
        if (cached) return { ...cached, _cached: true };

        const data = await index.getSyariahIndex();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/syariah/index', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    })

    // ── Transaksi Sesuai Syariah ─────────────────
    .get('/transaction', async () => {
      try {
        const cached = slowCache.get('/syariah/transaction');
        if (cached) return { ...cached, _cached: true };

        const data = await transaction.getSyariahTransaction();
        const result = {
          success: true, data, total: data.length,
          fetchedAt: new Date().toISOString(),
          _source: 'https://www.idx.co.id/', _cached: false,
        };
        slowCache.set('/syariah/transaction', result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg };
      }
    });
}
