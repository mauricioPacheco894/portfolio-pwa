/**
 * Price Service
 *
 * Fetches asset prices from the database.
 * All prices are pre-populated via external sync jobs.
 */

import { EXCHANGE_MAP as BASE_EXCHANGE_MAP } from '@/constants/tickers';
import { createClient } from '@/lib/supabaseServer';

/** Known exchange mappings for common tickers */
const EXCHANGE_MAP: Record<string, string> = { ...BASE_EXCHANGE_MAP };

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
