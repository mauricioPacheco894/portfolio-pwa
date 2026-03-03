'use server';

import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';

/**
 * Server Action to sync a specific price on-demand.
 * Uses the Supabase SDK to invoke the Edge Function.
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

        console.log(`📡 Invoking Edge Function for ${upperTicker}...`);

        // Usamos el SDK de Supabase para llamar a la función de forma limpia
        const { data, error: functionError } = await supabase.functions.invoke(`update-prices?ticker=${upperTicker}`, {
            method: 'GET'
        });

        if (functionError) {
            throw new Error(`Edge Function error: ${functionError.message}`);
        }

        if (data && data.success) {
            return {
                success: true,
                ticker: data.ticker,
                price: data.price,
                currency: data.currency
            };
        } else {
            return { success: false, error: data?.error || 'Unknown error' };
        }

    } catch (error) {
        console.error(`Sync error for ticker ${upperTicker}:`, error);
        return { success: false, error: String(error) };
    }
}
