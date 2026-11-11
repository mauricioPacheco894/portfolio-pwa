import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { createClient } from '@/lib/supabaseServer';
import { Database } from '@/types/supabase';
import { HistoryDataPoint } from '@/utils/timeWeightedReturn';

/**
 * Server-only fetch of the portfolio history series.
 *
 * This module imports the Supabase server client (which needs
 * next/headers), so it must only be imported from server components.
 * The pure TWR math over the series lives in timeWeightedReturn.ts,
 * which is safe to import from client components.
 */

// One row of the get_portfolio_history RPC, typed against the Database
// declaration (src/types/supabase.ts): if the RPC changes its return
// shape, this stops compiling instead of silently returning undefined.
type HistoryRow =
  Database['public']['Functions']['get_portfolio_history']['Returns'][0];

export async function getPortfolioHistory(
  portfolioId: string
): Promise<HistoryDataPoint[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_portfolio_history', {
    p_portfolio_id: portfolioId,
  });

  if (error || !data) {
    console.error('Error fetching portfolio history from RPC:', error);
    return [];
  }

  return data.map((row: HistoryRow) => {
    // row.history_date is YYYY-MM-DD
    const parsedDate = parseISO(row.history_date);
    return {
      date: row.history_date,
      valueUSD: Number(row.value_usd) || 0,
      valueMXN: Number(row.value_mxn) || 0,
      investedUSD: Number(row.invested_usd) || 0,
      investedMXN: Number(row.invested_mxn) || 0,
      formattedDate: format(parsedDate, 'd MMM yyyy', { locale: es }),
    };
  });
}
