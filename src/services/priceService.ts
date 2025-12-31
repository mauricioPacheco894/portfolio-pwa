import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Tipo para caché
interface CacheEntry {
  price: number;
  lastUpdated: number;
}

// Caché en memoria (se mantiene mientras el servidor de desarrollo corre)
const priceCache: Record<string, CacheEntry> = {};

// Duración del caché: 15 minutos (evita spam a la API)
const CACHE_DURATION = 15 * 60 * 1000;

interface YahooQuote {
  symbol?: string;
  regularMarketPrice?: number;
}

export async function getCurrentPrices(
  tickers: string[]
): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};

  const uniqueTickers = Array.from(new Set(tickers));
  const now = Date.now();
  const prices: Record<string, number> = {};
  const tickersToFetch: string[] = [];

  // 1. Revisar caché primero
  uniqueTickers.forEach((ticker) => {
    const cached = priceCache[ticker];
    if (cached && now - cached.lastUpdated < CACHE_DURATION) {
      // Usar dato caché si es fresco
      prices[ticker] = cached.price;
    } else {
      // Si no hay caché o expiro, añadir a la lista para buscar
      tickersToFetch.push(ticker);
      // Usar el dato viejo mientras (stale-while-revalidate pattern simple)
      if (cached) prices[ticker] = cached.price;
    }
  });

  // Si todos los datos están en caché frescos, retornamos
  if (tickersToFetch.length === 0) {
    console.log('Using cached prices for:', uniqueTickers);
    return prices;
  }

  console.log('Fetching fresh prices for:', tickersToFetch);

  try {
    // 2. Fetch solo para los que faltan
    const results = await yahooFinance.quote(tickersToFetch);
    const quotes = (Array.isArray(results) ? results : [results]) as YahooQuote[];

    quotes.forEach((quote) => {
      if (quote.symbol && quote.regularMarketPrice) {
        // Actualizar mapa de retorno
        prices[quote.symbol] = quote.regularMarketPrice;

        // Actualizar caché
        priceCache[quote.symbol] = {
          price: quote.regularMarketPrice,
          lastUpdated: now,
        };
      }
    });
  } catch (error) {
    console.warn('Yahoo Finance API Error (rate limit likely):', error);
    // 3. Fallback: Si falla el fetch, intentamos devolver lo que haya en caché aunque sea viejo
    // Ya llenamos 'prices' con datos viejos arriba en el else, por lo que devolveremos eso.
    console.log('Falling back to cached/stale data due to API error.');
  }

  return prices;
}
