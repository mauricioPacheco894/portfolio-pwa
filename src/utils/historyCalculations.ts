import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { createClient } from '@/lib/supabaseServer';

export interface HistoryDataPoint {
  date: string;
  valueUSD: number;
  valueMXN: number;
  investedUSD: number;
  investedMXN: number;
  formattedDate: string;
}

export async function getPortfolioHistory(portfolioId: string): Promise<HistoryDataPoint[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_portfolio_history', {
    p_portfolio_id: portfolioId,
  });

  if (error || !data) {
    console.error('Error fetching portfolio history from RPC:', error);
    return [];
  }

  return data.map((row: any) => {
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
