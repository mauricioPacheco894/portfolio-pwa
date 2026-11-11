'use server';

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

import { env } from '@/env';

/**
 * Mapping of known markets to speed up the search.
 */
const EXCHANGE_MAP: Record<string, string> = {
    AAPL: 'NASDAQ', MSFT: 'NASDAQ', GOOGL: 'NASDAQ', GOOG: 'NASDAQ', AMZN: 'NASDAQ',
    META: 'NASDAQ', TSLA: 'NASDAQ', NVDA: 'NASDAQ', Netflix: 'NASDAQ', AMD: 'NASDAQ',
    INTC: 'NASDAQ', PYPL: 'NASDAQ', SPY: 'NYSEARCA', VOO: 'NYSEARCA', QQQ: 'NASDAQ',
    AMXL: 'BMV', WALMEX: 'BMV', BIMBOA: 'BMV', CEMEXCPO: 'BMV', NU: 'NYSE',
};

/**
 * Determines which markets to search for a ticker
 */
function getExchangesForTicker(ticker: string): string[] {
    const upperTicker = ticker.toUpperCase()
    if (upperTicker === 'USD-MXN') return ['']
    if (upperTicker.includes(':')) return [upperTicker.split(':')[1]]
    if (upperTicker.endsWith('.MX')) return ['BMV']
    if (EXCHANGE_MAP[upperTicker]) return [EXCHANGE_MAP[upperTicker]]

    // If we don't know, we try the most likely ones
    return ['NASDAQ', 'NYSE', 'BMV', 'NYSEARCA']
}

// HOISTED REGULAR EXPRESSION (js-hoist-regexp rule) - Removed; JSON API is used instead

/**
 * Converts the ticker to the format Yahoo Finance expects.
 */
function getYahooTicker(ticker: string): string {
    const upperTicker = ticker.toUpperCase();
    if (upperTicker === 'USD-MXN') return 'USDMXN=X';
    
    const cleanTicker = upperTicker.split(':')[0];
    
    // If it already has .MX, leave it as is
    if (cleanTicker.endsWith('.MX')) return cleanTicker;
    
    // If it is from the Mexican market, append .MX
    if (upperTicker.endsWith(':BMV') || EXCHANGE_MAP[cleanTicker] === 'BMV') {
        return `${cleanTicker}.MX`;
    }
    
    return cleanTicker;
}

/**
 * Optimized scraper using Yahoo Finance's public JSON API.
 * Faster and much more stable than scraping HTML from Google.
 */
async function fetchPrice(ticker: string): Promise<{ price: number, currency: string } | null> {
    const yahooTicker = getYahooTicker(ticker);
    
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            next: { revalidate: 0 } // No cache
        });

        if (!response.ok) {
            console.error(`Error fetching from Yahoo for ${yahooTicker}: HTTP ${response.status}`);
            return null;
        }

        const json = await response.json();
        const result = json.chart?.result?.[0];
        
        if (result && result.meta && result.meta.regularMarketPrice) {
            return {
                price: result.meta.regularMarketPrice,
                currency: result.meta.currency || 'USD'
            };
        }
    } catch (e) {
        console.error(`Error fetching ${ticker} from Yahoo:`, e);
    }
    return null;
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

        // async-parallel rule: Run the fetch and the DB query in parallel to eliminate the waterfall
        const isMexican = upperTicker.endsWith('.MX') ||
            upperTicker.endsWith(':BMV') ||
            upperTicker === 'USD-MXN';

        const [result, existingCurrencyData] = await Promise.all([
            fetchPrice(upperTicker),
            !isMexican ? supabase
                .from('asset_prices')
                .select('currency')
                .eq('ticker', upperTicker)
                .single() : Promise.resolve({ data: null })
        ]);

        if (result && result.price > 0) {
            let finalCurrency = result.currency;

            if (isMexican) {
                finalCurrency = 'MXN';
            } else if (existingCurrencyData?.data?.currency) {
                finalCurrency = existingCurrencyData.data.currency;
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
