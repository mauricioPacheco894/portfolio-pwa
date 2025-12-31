import { notFound } from 'next/navigation';
import PortfolioDashboard from '@/app/components/PortfolioDashboard';
import { createClient } from '@/lib/supabaseServer';
import { getCurrentPrices } from '@/services/priceService';
import { Database } from '@/types/supabase';
import { calculateHoldings, calculateRebalancing } from '@/utils/portfolioMath';

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

async function getAllTransactions(portfolioId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('portfolio_id', portfolioId);

  if (error) {
    console.error('Error fetching all transactions', error);
    return [];
  }
  return data as Transaction[];
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
    .order('date', { ascending: false })
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

  // Fetch data in parallel
  const [allTransactions, paginatedResult] = await Promise.all([
    getAllTransactions(id),
    getPaginatedTransactions(id, page, pageSize, {
      ticker: tickerFilter,
      type: typeFilter,
    }),
  ]);

  const { data: transactions, count: totalCount } = paginatedResult;

  let holdings = calculateHoldings(allTransactions);

  // Obtener precios en tiempo real incluyendo el tipo de cambio USD/MXN
  const tickers = holdings.map((h) => h.ticker);
  const fxTicker = 'USD-MXN';

  // Añadimos el par FX a la lista de precios a buscar
  const tickersToFetch = [...tickers, fxTicker];
  const currentPrices = await getCurrentPrices(tickersToFetch);

  const usdMxnRate = currentPrices[fxTicker] || 20.0; // Fallback seguro si falla la API

  // Actualizar holdings con precios reales y conversión de moneda
  holdings = holdings.map((asset) => {
    const livePrice = currentPrices[asset.ticker];

    // Detectar si el activo es MXN (BMV)
    const isMxn = asset.ticker.endsWith('.MX') || asset.ticker.includes(':BMV');

    if (livePrice) {
      let marketPrice = livePrice;
      let currentValue = asset.totalQuantity * marketPrice;

      // Si el activo está en MXN, calculamos los valores globales en USD
      // Mantenemos los valores originales (currentValue, totalInvested) en moneda local para la tabla
      const exchangeRate = isMxn ? usdMxnRate : 1.0;

      const marketValueGlobal = currentValue / exchangeRate;
      const totalInvestedGlobal = asset.totalInvested / exchangeRate;
      const realizedPLGlobal = (asset.realizedPL || 0) / exchangeRate;

      return {
        ...asset,
        marketPrice: marketPrice, // Moneda Local
        currentValue: currentValue, // Moneda Local
        plDollars: currentValue - asset.totalInvested, // Moneda Local
        plPercentage:
          asset.totalInvested > 0
            ? ((currentValue - asset.totalInvested) / asset.totalInvested) * 100
            : 0,
        currency: isMxn ? 'MXN' : 'USD',

        // Valores Normalizados para KPIs Globales
        marketValueGlobal: marketValueGlobal,
        totalInvestedGlobal: totalInvestedGlobal,
        plDollarsGlobal: marketValueGlobal - totalInvestedGlobal,
        realizedPL: isMxn ? realizedPLGlobal : asset.realizedPL, // Normalizamos realizedPL a USD porque ese dato es histórico y mejor tenerlo base
      };
    }

    // Si no hay precio live, asumimos valores estáticos o 0, pero con estructura correcta
    return {
      ...asset,
      currency: isMxn ? 'MXN' : 'USD',
      marketValueGlobal: asset.currentValue, // Fallback (asume USD o error 1:1)
      totalInvestedGlobal: asset.totalInvested,
      plDollarsGlobal: asset.plDollars,
    };
  });

  const activeHoldings = holdings.filter(
    (h) => Math.abs(h.totalQuantity) > 0.000001
  );

  // Total para rebalancing (en USD)
  const totalValueUSD = holdings.reduce(
    (sum, h) => sum + (h.marketValueGlobal || 0),
    0
  );

  const rebalanceSuggestions = calculateRebalancing(
    holdings,
    portfolio.target_allocation || {},
    totalValueUSD,
    currentPrices
  );

  const uniqueTickers = Array.from(new Set(holdings.map((h) => h.ticker)));
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <PortfolioDashboard
      portfolio={portfolio}
      holdings={holdings}
      activeHoldings={activeHoldings}
      transactions={transactions}
      uniqueTickers={uniqueTickers}
      rebalanceSuggestions={rebalanceSuggestions}
      usdMxnRate={usdMxnRate}
      pagination={{
        page,
        totalPages,
      }}
    />
  );
}
