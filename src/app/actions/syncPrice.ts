'use server';

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { env } from '@/env';

/**
 * Mapeo de mercados conocidos para acelerar la búsqueda.
 */
const EXCHANGE_MAP: Record<string, string> = {
    AAPL: 'NASDAQ', MSFT: 'NASDAQ', GOOGL: 'NASDAQ', GOOG: 'NASDAQ', AMZN: 'NASDAQ',
    META: 'NASDAQ', TSLA: 'NASDAQ', NVDA: 'NASDAQ', Netflix: 'NASDAQ', AMD: 'NASDAQ',
    INTC: 'NASDAQ', PYPL: 'NASDAQ', SPY: 'NYSEARCA', VOO: 'NYSEARCA', QQQ: 'NASDAQ',
    AMXL: 'BMV', WALMEX: 'BMV', BIMBOA: 'BMV', CEMEXCPO: 'BMV', NU: 'NYSE',
};

/**
 * Determina en qué mercados buscar un ticker
 */
function getExchangesForTicker(ticker: string): string[] {
    const upperTicker = ticker.toUpperCase()
    if (upperTicker === 'USD-MXN') return ['']
    if (upperTicker.includes(':')) return [upperTicker.split(':')[1]]
    if (upperTicker.endsWith('.MX')) return ['BMV']
    if (EXCHANGE_MAP[upperTicker]) return [EXCHANGE_MAP[upperTicker]]

    // Si no sabemos, probamos los más probables
    return ['NASDAQ', 'NYSE', 'BMV', 'NYSEARCA']
}

/**
 * Scraper optimizado con Regex para máxima velocidad.
 */
async function fetchPriceFromGoogle(ticker: string): Promise<{ price: number, currency: string } | null> {
    const cleanTicker = ticker.replace('.MX', '').split(':')[0]
    const exchanges = getExchangesForTicker(ticker)

    for (const exchange of exchanges) {
        try {
            const suffix = exchange ? `:${exchange}` : '';
            const url = `https://www.google.com/finance/quote/${cleanTicker}${suffix}`

            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                next: { revalidate: 0 } // No cache para acciones inmediatas
            })

            if (!response.ok) continue

            const html = await response.text()

            // BÚSQUEDA POR REGEX (Ultra rápida)
            const priceRegex = /class="YMlKec fxKbKc">\$?([0-9,.]+)</;
            const match = html.match(priceRegex);
            let price: number | null = null;

            if (match?.[1]) {
                price = parseFloat(match[1].replace(/,/g, ''));
            } else {
                // Fallback a Cheerio solo si falla el Regex
                const $ = cheerio.load(html.substring(0, 150000))
                const priceText = $('div.YMlKec.fxKbKc').first().text()
                price = priceText ? parseFloat(priceText.replace(/[$,\s]/g, '')) : null
            }

            if (price && price > 0) {
                const isMexican = exchange === 'BMV' ||
                    ticker.toUpperCase().endsWith('.MX') ||
                    ticker.toUpperCase().endsWith(':BMV') ||
                    ticker === 'USD-MXN';

                return { price, currency: isMexican ? 'MXN' : 'USD' }
            }
        } catch (e) {
            console.error(`Error scraping ${ticker} on ${exchange}:`, e)
            continue
        }
    }
    return null
}

/**
 * Server Action to sync a specific price on-demand.
 * Now runs directly on the server side for maximum speed, 
 * avoiding the cold start of Edge Functions.
 * 
 * @param ticker The symbol of the asset to sync.
 * @returns Object indicating success or failure.
 */
export async function syncSingleTickerPrice(ticker: string) {
    if (!ticker) {
        return { success: false, error: 'Ticker is required' };
    }

    const upperTicker = ticker.toUpperCase();

    try {
        const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        console.log(`🚀 Fast Sync (Server Side) for ${upperTicker}...`);

        // Ejecutar el scraper directamente en el servidor de Next.js
        const result = await fetchPriceFromGoogle(upperTicker);

        if (result && result.price > 0) {
            // Lógica de auto-corrección de moneda (MXN para activos BMV)
            const isMexican = upperTicker.endsWith('.MX') ||
                upperTicker.endsWith(':BMV') ||
                upperTicker === 'USD-MXN';

            let finalCurrency = result.currency;

            if (isMexican) {
                finalCurrency = 'MXN';
            } else {
                // Respetar lo que ya existe si no es mexicano
                const { data: existing } = await supabase
                    .from('asset_prices')
                    .select('currency')
                    .eq('ticker', upperTicker)
                    .single();

                if (existing?.currency) {
                    finalCurrency = existing.currency;
                }
            }

            const payload = {
                ticker: upperTicker,
                price: result.price,
                currency: finalCurrency,
                last_updated: new Date().toISOString(),
            };

            const { error: dbError } = await supabase
                .from('asset_prices')
                .upsert(payload, { onConflict: 'ticker' });

            if (dbError) throw dbError;

            return {
                success: true,
                ticker: upperTicker,
                price: result.price,
                currency: finalCurrency
            };
        } else {
            return { success: false, error: 'No se pudo obtener el precio de Google Finance' };
        }

    } catch (error) {
        console.error(`Sync error for ticker ${upperTicker}:`, error);
        return { success: false, error: String(error) };
    }
}
