import * as cheerio from 'cheerio';

// Tipo para caché
interface CacheEntry {
  price: number;
  lastUpdated: number;
}

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
  // ETFs (principalmente en NYSE Arca)
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
  // Mexican Market (BMV)
  AMXL: 'BMV',
  WALMEX: 'BMV',
  FEMSAUBD: 'BMV',
  GFNORTEO: 'BMV',
  TLEVISACPO: 'BMV',
  CEMEXCPO: 'BMV',
  GMEXICOB: 'BMV',
  GAPB: 'BMV',
  ASURB: 'BMV',
  BIMBOA: 'BMV',
  KIMBERA: 'BMV',
  LIVEPOLC1: 'BMV',
  ELEKTRA: 'BMV',
  GRUMAB: 'BMV',
  ALSEA: 'BMV',
  AC: 'BMV',
  GCARSOA1: 'BMV',
  OMAB: 'BMV',
  PINFRA: 'BMV',
  MEGACPO: 'BMV',
};

// Caché en memoria (se mantiene mientras el servidor de desarrollo corre)
const priceCache: Record<string, CacheEntry> = {};

// Duración del caché: 15 minutos
const CACHE_DURATION = 15 * 60 * 1000;

/**
 * Determina el exchange de un ticker
 * Primero busca si el ticker tiene formato explícito (ej: AAPL:BMV o AAPL.MX)
 * Luego busca en el mapa conocido, y finalmente intenta exchanges comunes
 */
function getExchangeForTicker(ticker: string): string[] {
  const upperTicker = ticker.toUpperCase();

  // 1. Detectar formato explícito "SYMBOL:EXCHANGE" (Google Finance style)
  if (upperTicker.includes(':')) {
    const [symbol, exchange] = upperTicker.split(':');
    return [exchange]; // Retornar solo el exchange, el ticker se limpiar antes de llamar
  }

  // 2. Detectar formato "SYMBOL.MX" (Yahoo style para México) -> Convertir a BMV
  if (upperTicker.endsWith('.MX')) {
    return ['BMV'];
  }

  // 3. Buscar en el mapa conocido
  if (EXCHANGE_MAP[upperTicker]) {
    return [EXCHANGE_MAP[upperTicker]];
  }

  // 4. Si no está en el mapa, intentar los exchanges más comunes
  return ['NASDAQ', 'NYSE', 'NYSEARCA', 'BMV'];
}

/**
 * Scrape el precio de un ticker desde Google Finance
 */
async function scrapeGoogleFinancePrice(
  ticker: string
): Promise<number | null> {
  const upperTicker = ticker.toUpperCase();
  let cleanTicker = upperTicker;

  // Limpiar ticker si viene con exchange explícito para la URL
  if (upperTicker.includes(':')) {
    cleanTicker = upperTicker.split(':')[0];
  } else if (upperTicker.endsWith('.MX')) {
    cleanTicker = upperTicker.replace('.MX', '');
  }

  const exchanges = getExchangeForTicker(ticker);

  for (const exchange of exchanges) {
    try {
      const url = `https://www.google.com/finance/quote/${cleanTicker}:${exchange}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        continue; // Intentar siguiente exchange
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // El precio está en un div con class que contiene "YMlKec fxKbKc"
      // También tiene data-last-price attribute
      let price: number | null = null;

      // Método 1: Buscar el atributo data-last-price
      $('[data-last-price]').each((_, el) => {
        const lastPrice = $(el).attr('data-last-price');
        if (lastPrice) {
          price = parseFloat(lastPrice);
          return false; // break
        }
      });

      // Método 2: Buscar el elemento con la clase del precio principal
      if (!price) {
        const priceText = $('div.YMlKec.fxKbKc').first().text();
        if (priceText) {
          // Limpiar el texto: remover $, comas, espacios
          const cleanPrice = priceText.replace(/[$,\s]/g, '');
          price = parseFloat(cleanPrice);
        }
      }

      // Método 3: Buscar cualquier elemento que tenga formato de precio después del ticker
      if (!price) {
        const priceMatch = html.match(/data-last-price="([\d.]+)"/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1]);
        }
      }

      if (price && !isNaN(price) && price > 0) {
        console.log(`✓ Scraped ${cleanTicker}:${exchange} = $${price}`);
        return price;
      }
    } catch (error) {
      console.warn(`Failed to scrape ${cleanTicker}:${exchange}:`, error);
      continue;
    }
  }

  console.warn(`✗ Could not find price for ${ticker} in any exchange`);
  return null;
}

/**
 * Obtiene los precios actuales para una lista de tickers usando scraping de Google Finance
 */
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
      // Si no hay caché o expiró, añadir a la lista para buscar
      tickersToFetch.push(ticker);
      // Usar el dato viejo mientras (stale-while-revalidate pattern simple)
      if (cached) prices[ticker] = cached.price;
    }
  });

  // Si todos los datos están en caché frescos, retornamos
  if (tickersToFetch.length === 0) {
    console.log('📦 Using cached prices for:', uniqueTickers);
    return prices;
  }

  console.log('🔍 Scraping Google Finance for:', tickersToFetch);

  // 2. Fetch en paralelo con límite de concurrencia
  const CONCURRENT_LIMIT = 3; // No más de 3 requests simultáneos para evitar bloqueos

  for (let i = 0; i < tickersToFetch.length; i += CONCURRENT_LIMIT) {
    const batch = tickersToFetch.slice(i, i + CONCURRENT_LIMIT);

    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        const price = await scrapeGoogleFinancePrice(ticker);
        return { ticker, price };
      })
    );

    batchResults.forEach(({ ticker, price }) => {
      if (price !== null) {
        prices[ticker] = price;
        priceCache[ticker] = {
          price,
          lastUpdated: now,
        };
      }
    });

    // Pequeña pausa entre batches para evitar rate limiting
    if (i + CONCURRENT_LIMIT < tickersToFetch.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return prices;
}

/**
 * Añadir un ticker al mapa de exchanges conocidos
 * Útil para cuando el usuario agrega un nuevo ticker
 */
export function registerTickerExchange(ticker: string, exchange: string): void {
  EXCHANGE_MAP[ticker.toUpperCase()] = exchange.toUpperCase();
}

/**
 * Limpiar el caché de precios (útil para forzar actualización)
 */
export function clearPriceCache(): void {
  Object.keys(priceCache).forEach((key) => delete priceCache[key]);
  console.log('🗑️ Price cache cleared');
}
