// Market Routes — Index (Route Assembler)
// Menggabungkan semua sub-routes market ke dalam satu Elysia group /api/market

import { Elysia } from 'elysia';
import { TradingSummaryClient } from '../../clients/market/trading-summary';
import { IndexSummaryClient } from '../../clients/market/index-summary';
import { StockSummaryClient } from '../../clients/market/stock-summary';
import { BrokerSummaryClient } from '../../clients/market/broker-summary';
import { SuspendDataClient } from '../../clients/market/suspend-data';
import { StockListClient } from '../../clients/market/stock-list';
import { MarginStocksClient } from '../../clients/market/margin-stocks';
import { PreOpenStocksClient } from '../../clients/market/pre-open-stocks';
import { LpStocksClient } from '../../clients/market/lp-stocks';
import { BondSummaryClient } from '../../clients/market/bond-sukuk';
import { IndobexClient } from '../../clients/market/indobex';
import { DerivativesClient } from '../../clients/market/derivatives';
import { EtfClient } from '../../clients/market/etf';
import { tradingRoutes } from './trading';
import { indicesRoutes } from './indices';
import { stocksRoutes } from './stocks';
import { stockListRoute } from './stock-list';
import { stockExtraRoutes } from './stock-extra';
import { bondsRoutes } from './bonds';
import { derivativesRoutes } from './derivatives';

/**
 * Build semua market routes dengan prefix `/market`.
 *
 * Sub-routes:
 *   - trading:   /trading-summary, /broker-summary
 *   - indices:   /index-summary
 *   - stocks:    /stock-summary, /top-gainer, /top-loser, /top-volume,
 *                /top-value, /top-frequent, /suspend
 */
export function marketRoutes() {
  // Init clients
  const tradingClient = new TradingSummaryClient();
  const indexClient = new IndexSummaryClient();
  const stockClient = new StockSummaryClient();
  const brokerClient = new BrokerSummaryClient();
  const suspendClient = new SuspendDataClient();

  // Phase 2 clients
  const stockListClient = new StockListClient();
  const marginClient = new MarginStocksClient();
  const preOpenClient = new PreOpenStocksClient();
  const lpClient = new LpStocksClient();

  return new Elysia({ prefix: '/market' })
    .use(tradingRoutes(tradingClient, brokerClient))
    .use(indicesRoutes(indexClient))
    .use(stocksRoutes(stockClient, suspendClient))
    .use(stockListRoute(stockListClient))
    .use(stockExtraRoutes(marginClient, preOpenClient, lpClient))
    .use(bondsRoutes(new BondSummaryClient(), new IndobexClient()))
    .use(derivativesRoutes(new DerivativesClient(), new EtfClient()));
}
