import { createClient } from '@/lib/supabaseServer';

// Mapeo de exchanges conocidos para tickers comunes
const EXCHANGE_MAP: Record<string, string> = {
  // US Markets
  AAPL: 'NASDAQ',
  MSFT: 'NASDAQ',
  GOOGL: 'NASDAQ',
  GOOG: 'NASDAQ',
  AMZN: 'NASDAQ',
  META: 'NASDAQ',
  TSLA: 'NASDAQ',
  NVDA: 'NASDAQ',
  NFLX: 'NASDAQ',
  AMD: 'NASDAQ',
  INTC: 'NASDAQ',
  PYPL: 'NASDAQ',
  ADBE: 'NASDAQ',
  CSCO: 'NASDAQ',
  CMCSA: 'NASDAQ',
  PEP: 'NASDAQ',
  COST: 'NASDAQ',
  AVGO: 'NASDAQ',
  QCOM: 'NASDAQ',
  TXN: 'NASDAQ',
  // NYSE
  JPM: 'NYSE',
  V: 'NYSE',
  JNJ: 'NYSE',
  WMT: 'NYSE',
  PG: 'NYSE',
  MA: 'NYSE',
  UNH: 'NYSE',
  HD: 'NYSE',
  DIS: 'NYSE',
  BAC: 'NYSE',
  XOM: 'NYSE',
  KO: 'NYSE',
  PFE: 'NYSE',
  VZ: 'NYSE',
  T: 'NYSE',
  MRK: 'NYSE',
  CVX: 'NYSE',
  WFC: 'NYSE',
  ABT: 'NYSE',
  TMO: 'NYSE',
  NKE: 'NYSE',
  MCD: 'NYSE',
  LLY: 'NYSE',
  DHR: 'NYSE',
  NEE: 'NYSE',
  PM: 'NYSE',
  UNP: 'NYSE',
  IBM: 'NYSE',
  RTX: 'NYSE',
  HON: 'NYSE',
  LOW: 'NYSE',
  SBUX: 'NASDAQ',
  CAT: 'NYSE',
  GE: 'NYSE',
  BA: 'NYSE',
  GS: 'NYSE',
  BLK: 'NYSE',
  MMM: 'NYSE',
  AXP: 'NYSE',
  SPGI: 'NYSE',
  // ETFs
  SPY: 'NYSEARCA',
  VOO: 'NYSEARCA',
  VTI: 'NYSEARCA',
  QQQ: 'NASDAQ',
  IVV: 'NYSEARCA',
  VEA: 'NYSEARCA',
  VWO: 'NYSEARCA',
  VNQ: 'NYSEARCA',
  BND: 'NASDAQ',
  AGG: 'NYSEARCA',
  VIG: 'NYSEARCA',
  VYM: 'NYSEARCA',
  SCHD: 'NYSEARCA',
  VGT: 'NYSEARCA',
  XLK: 'NYSEARCA',
  XLF: 'NYSEARCA',
  XLE: 'NYSEARCA',
  XLV: 'NYSEARCA',
  XLI: 'NYSEARCA',
  XLY: 'NYSEARCA',
  XLP: 'NYSEARCA',
  ARKK: 'NYSEARCA',
};

/**
 * Obtiene precios EXCLUSIVAMENTE de la Base de Datos.
 * NO realiza scraping en tiempo real.
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

  // No fallback to scraping.
  return prices;
}

export function registerTickerExchange(ticker: string, exchange: string): void {
  EXCHANGE_MAP[ticker.toUpperCase()] = exchange.toUpperCase();
}

export function clearPriceCache(): void {
  // Legacy stub
}
