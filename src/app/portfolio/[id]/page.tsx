/**
 * Portfolio Detail Page (Server Component)
 *
 * Fetches all portfolio data from Supabase RPCs and renders the dashboard.
 * Data sources:
 * - get_portfolio_positions: Holdings with unrealized P&L
 * - get_realized_pnl: Realized gains/losses from closed positions
 * - asset_prices: Exchange rates (USD-MXN)
 */


import { notFound } from 'next/navigation';

import PortfolioDashboard from '@/app/components/PortfolioDashboard';
import { createClient } from '@/lib/supabaseServer';
import { AssetPosition, TickerHistory } from '@/types/portfolio';
import { Database } from '@/types/supabase';
import { getPortfolioHistory } from '@/utils/historyCalculations';
import { buildTickerHistoryMap } from '@/utils/tickerHistory';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type Portfolio = Database['public']['Tables']['portfolios']['Row'];

async function getPortfolio(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getPortfolio] Query error:', error.message);
    return null;
  }

  return data as Portfolio;
}

async function getPaginatedTransactions(
  portfolioId: string,
  page: number,
  pageSize: number,
  filters?: { ticker?: string; type?: string }
) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('portfolio_id', portfolioId);

  if (filters?.ticker) {
    query = query.ilike('ticker', `%${filters.ticker}%`);
  }

  if (filters?.type && filters.type !== 'ALL') {
    query = query.eq('type', filters.type);
  }

  const { data, count, error } = await query
    // Orden determinista: sin el desempate por id, Postgres puede ordenar
    // distinto las filas con la misma fecha entre consultas y una fila del
    // borde entre páginas aparece duplicada o se omite (todas las
    // transacciones de un mismo día comparten timestamp).
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching paginated transactions', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data as Transaction[]) || [],
    count: count || 0,
  };
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * All the portfolio's transactions (unpaginated), only to build the
 * per-asset summarized history of the desktop expanded detail.
 * About 216 rows; the page's Transactions History keeps using the
 * paginated version above.
 */
async function getAllTransactions(portfolioId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('Error fetching all transactions', error);
    return [] as Transaction[];
  }

  return (data as Transaction[]) || [];
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const page = Number(resolvedSearchParams.page) || 1;
  const pageSize = 10;
  const tickerFilter = resolvedSearchParams.ticker as string | undefined;
  const typeFilter = resolvedSearchParams.type as string | undefined;

  const portfolio = await getPortfolio(id);
  if (!portfolio) {
    return notFound();
  }

  // Fetch all data in parallel
  const supabase = await createClient();
  const [paginatedResult, rpcResult, rateResult, pnlResult, historyData, allTransactions] = await Promise.all([
    getPaginatedTransactions(id, page, pageSize, {
      ticker: tickerFilter,
      type: typeFilter,
    }),
    supabase.rpc('get_portfolio_positions', { p_portfolio_id: id }),
    supabase.from('asset_prices').select('price').eq('ticker', 'USD-MXN').maybeSingle(),
    supabase.rpc('get_realized_pnl', { p_portfolio_id: id }),
    getPortfolioHistory(id),
    getAllTransactions(id)
  ]);

  const { data: transactions, count: totalCount } = paginatedResult;
  const positions = rpcResult.data || [];
  const usdMxnRate = rateResult.data?.price || 20.0;
  const pnlValues = pnlResult.data || [];

  // Per-asset summarized history (desktop expanded detail): built from
  // the transactions and the per-asset breakdown that the
  // get_realized_pnl RPC already returns (before, only the totals were
  // passed down).
  const targetKeys = Object.keys(portfolio.target_allocation || {});
  const tickerHistory: Record<string, TickerHistory> = buildTickerHistoryMap(
    allTransactions,
    pnlValues,
    targetKeys,
    usdMxnRate
  );

  if (rpcResult.error) {
    console.error('Error fetching RPC positions:', rpcResult.error);
  }

  // Build realized P&L map and calculate total in USD and MXN
  const pnlMap = new Map<string, number>();
  let totalRealizedPnlUSD = 0;
  let totalRealizedPnlMXN = 0;

  pnlValues.forEach((p: Database['public']['Functions']['get_realized_pnl']['Returns'][0]) => {
    pnlMap.set(p.ticker, p.realized_pnl);
    const isMxn = p.currency === 'MXN';
    totalRealizedPnlUSD += isMxn ? p.realized_pnl / usdMxnRate : p.realized_pnl;
    totalRealizedPnlMXN += isMxn ? p.realized_pnl : (Number(p.realized_pnl_mxn) ?? p.realized_pnl * usdMxnRate);
  });

  // Transform RPC positions to AssetPosition format
  const holdings: AssetPosition[] = positions.map(
    (pos: Database['public']['Functions']['get_portfolio_positions']['Returns'][0]) => {
      const currency = pos.currency as 'USD' | 'MXN';
      const isMxn = currency === 'MXN';
      const exchangeRate = isMxn ? usdMxnRate : 1.0;

      // Derive market price from value/shares
      let marketPrice = 0;
      if (pos.total_shares > 0) {
        marketPrice = pos.current_value / pos.total_shares;
      }

      const realizedPL = pnlMap.get(pos.ticker) || 0;

      // Normalize all values to USD base
      const marketValueGlobal = (pos.current_value || 0) / exchangeRate;
      const totalInvestedGlobal = pos.total_invested / exchangeRate;
      const realizedPLGlobal = realizedPL / exchangeRate;
      const plDollarsGlobal = marketValueGlobal - totalInvestedGlobal;

      return {
        ticker: pos.ticker,
        totalQuantity: Number(pos.total_shares),
        averageCost: Number(pos.average_buy_price),
        totalInvested: Number(pos.total_invested),
        currentValue: Number(pos.current_value),
        marketPrice,
        plDollars: pos.unrealized_pnl ?? 0,
        plPercentage: pos.unrealized_pnl_percent ?? 0,
        realizedPL: isMxn ? realizedPLGlobal : realizedPL,
        currency,
        // Cantidad negativa = se vendió más de lo comprado (sobreventa).
        // La tabla de posiciones lo usa para mostrar la advertencia.
        isNegative: Number(pos.total_shares) < 0,
        lastUpdated: undefined,
        marketValueGlobal,
        totalInvestedGlobal,
        plDollarsGlobal,
        totalInvestedMxn: Number(pos.total_invested_mxn),
      } as AssetPosition;
    }
  );

  const uniqueTickers = Array.from(new Set(holdings.map((h) => h.ticker)));
  const totalPages = Math.ceil(totalCount / pageSize);

  // Calculate real Monthly and YTD returns from historyData
  return (
    <PortfolioDashboard
      portfolio={portfolio}
      holdings={holdings}
      transactions={transactions}
      uniqueTickers={uniqueTickers}
      usdMxnRate={usdMxnRate}
      totalRealizedPnlUSD={totalRealizedPnlUSD}
      totalRealizedPnlMXN={totalRealizedPnlMXN}
      tickerHistory={tickerHistory}
      pagination={{ page, totalPages }}
      historyData={historyData}
    />
  );
}
