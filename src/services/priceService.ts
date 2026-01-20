/**
 * Price Service
 *
 * Fetches asset prices from the database.
 * All prices are pre-populated via external sync jobs.
 */

import { createClient } from '@/lib/supabaseServer';

/** Known exchange mappings for common tickers */
const EXCHANGE_MAP: Record<string, string> = {
  // NASDAQ
  AAPL: 'NASDAQ', MSFT: 'NASDAQ', GOOGL: 'NASDAQ', GOOG: 'NASDAQ', AMZN: 'NASDAQ',
  META: 'NASDAQ', TSLA: 'NASDAQ', NVDA: 'NASDAQ', NFLX: 'NASDAQ', AMD: 'NASDAQ',
  INTC: 'NASDAQ', PYPL: 'NASDAQ', ADBE: 'NASDAQ', CSCO: 'NASDAQ', CMCSA: 'NASDAQ',
  PEP: 'NASDAQ', COST: 'NASDAQ', AVGO: 'NASDAQ', QCOM: 'NASDAQ', TXN: 'NASDAQ',
  SBUX: 'NASDAQ', BND: 'NASDAQ', QQQ: 'NASDAQ',
  // NYSE
  JPM: 'NYSE', V: 'NYSE', JNJ: 'NYSE', WMT: 'NYSE', PG: 'NYSE', MA: 'NYSE',
  UNH: 'NYSE', HD: 'NYSE', DIS: 'NYSE', BAC: 'NYSE', XOM: 'NYSE', KO: 'NYSE',
  PFE: 'NYSE', VZ: 'NYSE', T: 'NYSE', MRK: 'NYSE', CVX: 'NYSE', WFC: 'NYSE',
  ABT: 'NYSE', TMO: 'NYSE', NKE: 'NYSE', MCD: 'NYSE', LLY: 'NYSE', DHR: 'NYSE',
  NEE: 'NYSE', PM: 'NYSE', UNP: 'NYSE', IBM: 'NYSE', RTX: 'NYSE', HON: 'NYSE',
  LOW: 'NYSE', CAT: 'NYSE', GE: 'NYSE', BA: 'NYSE', GS: 'NYSE', BLK: 'NYSE',
  MMM: 'NYSE', AXP: 'NYSE', SPGI: 'NYSE',
  // ETFs (NYSEARCA)
  SPY: 'NYSEARCA', VOO: 'NYSEARCA', VTI: 'NYSEARCA', IVV: 'NYSEARCA',
  VEA: 'NYSEARCA', VWO: 'NYSEARCA', VNQ: 'NYSEARCA', AGG: 'NYSEARCA',
  VIG: 'NYSEARCA', VYM: 'NYSEARCA', SCHD: 'NYSEARCA', VGT: 'NYSEARCA',
  XLK: 'NYSEARCA', XLF: 'NYSEARCA', XLE: 'NYSEARCA', XLV: 'NYSEARCA',
  XLI: 'NYSEARCA', XLY: 'NYSEARCA', XLP: 'NYSEARCA', ARKK: 'NYSEARCA',
};

/**
 * Fetches current prices from the database.
 * Does not perform real-time scraping.
 *
 * @param tickers - Array of ticker symbols to fetch prices for
 * @returns Map of ticker to price
 */
export async function getCurrentPrices(
  tickers: string[]
): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};

  const uniqueTickers = Array.from(new Set(tickers));
  const prices: Record<string, number> = {};

  try {
    const supabase = await createClient();
    const { data: dbPrices, error } = await supabase
      .from('asset_prices')
      .select('ticker, price')
      .in('ticker', uniqueTickers);

    if (error) {
      console.error('Error fetching prices from DB:', error);
    } else if (dbPrices) {
      dbPrices.forEach((row) => {
        prices[row.ticker] = row.price;
      });
    }
  } catch (err) {
    console.error('Failed to init Supabase client for prices:', err);
  }

  return prices;
}

/** Registers a ticker-exchange mapping */
export function registerTickerExchange(ticker: string, exchange: string): void {
  EXCHANGE_MAP[ticker.toUpperCase()] = exchange.toUpperCase();
}

/** Legacy stub - no longer needed */
export function clearPriceCache(): void { }
