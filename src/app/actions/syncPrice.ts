'use server';

import { createClient } from '@supabase/supabase-js';
import YahooFinance from 'yahoo-finance2';
import { env } from '@/env';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

/**
 * Normalizes a ticker symbol for use with Yahoo Finance.
 * Handles special cases (such as BMV tickers) using a simple heuristic.
 */
function normalizeSymbolForYahoo(ticker: string): string {
    // Ex: If it ends in :BMV, Yahoo Finance expects .MX
    if (ticker.endsWith(':BMV')) {
        return ticker.replace(':BMV', '.MX');
    }
    return ticker;
}

/**
 * Server Action to sync a specific price on-demand.
 * Fetches the latest quote from Yahoo Finance and inserts
 * or updates it in the `asset_prices` table.
 * 
 * @param ticker The symbol of the asset to sync.
 * @returns Object indicating success or failure.
 */
export async function syncSingleTickerPrice(ticker: string) {
    if (!ticker) {
        return { success: false, error: 'Ticker is required' };
    }

    const normalizedSymbol = normalizeSymbolForYahoo(ticker.toUpperCase());

    try {
        // We use the service role key to bypass RLS limits since this is a server-side trusted action.
        const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        // Fetch quote from Yahoo Finance
        const quote = await yahooFinance.quote(normalizedSymbol) as any;

        if (quote && quote.regularMarketPrice !== undefined) {
            const price = quote.regularMarketPrice;
            const currency = quote.currency || 'USD';

            const payload = {
                ticker: ticker.toUpperCase(), // Save exactly as provided in DB
                price,
                currency,
                last_updated: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('asset_prices')
                .upsert(payload, { onConflict: 'ticker' });

            if (error) {
                console.error(`Error during asset_prices upsert for ${ticker}:`, error);
                return { success: false, error: error.message };
            }

            return { success: true, ticker, price, currency };
        } else {
            console.warn(`No regular market price found for ${normalizedSymbol}`);
            return { success: false, error: 'No price found' };
        }
    } catch (error) {
        console.error(`Yahoo Finance error for ticker ${normalizedSymbol}:`, error);
        return { success: false, error: String(error) };
    }
}
