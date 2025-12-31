import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import AddTransactionForm from '@/app/components/AddTransactionForm';
import { Header } from '@/app/components/Header';
import PaginationControls from '@/app/components/PaginationControls';
import HoldingsTable from '@/app/components/HoldingsTable';
import PortfolioActions from '@/app/components/PortfolioActions';
import PortfolioChartModal from '@/app/components/PortfolioChartModal';
import PortfolioManagementTable from '@/app/components/PortfolioManagementTable';
import TransactionActions from '@/app/components/TransactionActions';
import TransactionFilters from '@/app/components/TransactionFilters';
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

  // Obtener precios en tiempo real
  const tickers = holdings.map((h) => h.ticker);
  const currentPrices = await getCurrentPrices(tickers);

  // Actualizar holdings con precios reales
  holdings = holdings.map((asset) => {
    const livePrice = currentPrices[asset.ticker];

    if (livePrice) {
      const newVal = asset.totalQuantity * livePrice;
      return {
        ...asset,
        marketPrice: livePrice,
        currentValue: newVal,
        plDollars: newVal - asset.totalInvested,
        plPercentage:
          asset.totalInvested > 0
            ? ((newVal - asset.totalInvested) / asset.totalInvested) * 100
            : 0,
      };
    }
    return asset;
  });

  const activeHoldings = holdings.filter((h) => h.totalQuantity > 0.000001);

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const rebalanceSuggestions = calculateRebalancing(
    holdings,
    portfolio.target_allocation || {},
    totalValue,
    currentPrices
  );
  const uniqueTickers = Array.from(new Set(holdings.map((h) => h.ticker)));
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-end justify-between gap-4 flex-wrap border-b border-zinc-200 pb-4 mb-8 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="group flex items-center justify-center rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Volver"
              >
                <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-0.5" />
              </Link>
              <PortfolioActions
                portfolioId={id}
                portfolioName={portfolio.name}
              />
            </div>

            {/* KPIs Horizontales */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-500 font-medium dark:text-zinc-400">
                  Valor:
                </span>
                <span className="text-lg font-bold text-zinc-900 dark:text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(
                    holdings.reduce((sum, h) => sum + h.currentValue, 0)
                  )}
                </span>
              </div>

              <span className="text-zinc-300 text-lg font-light dark:text-zinc-700">
                |
              </span>

              <div className="flex items-baseline gap-2">
                <span className="text-zinc-500 font-medium dark:text-zinc-400">
                  Invertido:
                </span>
                <span className="text-lg font-bold text-zinc-900 dark:text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(
                    holdings.reduce((sum, h) => sum + h.totalInvested, 0)
                  )}
                </span>
              </div>

              <span className="text-zinc-300 text-lg font-light dark:text-zinc-700">
                |
              </span>

              <div className="flex items-baseline gap-2">
                <span className="text-zinc-500 font-medium dark:text-zinc-400">
                  Ganancia:
                </span>
                <div className="flex items-baseline gap-1.5">
                  {(() => {
                    const totalInvested = holdings.reduce(
                      (sum, h) => sum + h.totalInvested,
                      0
                    );
                    const totalProfit = holdings.reduce(
                      (sum, h) => sum + h.plDollars + (h.realizedPL || 0),
                      0
                    );
                    const isProfitable = totalProfit >= 0;
                    const profitColor = isProfitable
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400';
                    // Calcular ROI sobre Inversión Total Histórica (mejor aproximación simple: Invertido Activo)
                    const percentage =
                      totalInvested > 0
                        ? (totalProfit / totalInvested) * 100
                        : 0;

                    return (
                      <>
                        <span className={`text-lg font-bold ${profitColor}`}>
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            signDisplay: 'always',
                          }).format(totalProfit)}
                        </span>
                        <span className={`text-sm font-bold ${profitColor}`}>
                          ({percentage.toFixed(2)}%)
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla Maestra de Gestión Unificada */}
        <section className="mb-6">
          <PortfolioManagementTable
            holdings={activeHoldings}
            currentTarget={portfolio.target_allocation || undefined}
            rebalanceSuggestions={rebalanceSuggestions}
            portfolioId={id}
            availableTickers={uniqueTickers}
            totalValue={holdings.reduce((sum, h) => sum + h.currentValue, 0)}
          />
        </section>

        {/* Sección de Posiciones con Gráfica Modal */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              Mis Posiciones
            </h2>
            <PortfolioChartModal holdings={activeHoldings} />
          </div>
          <HoldingsTable holdings={activeHoldings} />
        </section>

        <section className="mb-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              Transacciones
            </h2>
            <div className="flex gap-2">
              <AddTransactionForm portfolioId={id} />
            </div>
          </div>

          <div className="mb-4">
            <TransactionFilters />
          </div>

          <div className="overflow-auto rounded-lg border dark:border-zinc-700 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-600">
            <table className="w-full table-auto text-sm relative">
              <thead className="sticky top-0 z-10 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">
                    Fecha
                  </th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">
                    Ticker
                  </th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">
                    Tipo
                  </th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-right">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-right">
                    Precio Unit.
                  </th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-right">
                    Comisión
                  </th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-right">
                    Total
                  </th>
                  <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-zinc-600 dark:text-zinc-400"
                    >
                      No hay transacciones registradas aún
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const qty = Number(t.quantity);
                    const price = Number(t.price_per_unit);
                    const fees = t.fees ? Number(t.fees) : 0;
                    const total = (qty * price + fees).toFixed(2);

                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                          {(() => {
                            const d = new Date(t.date);
                            // Usar UTC explícitamente para evitar desfases de zona horaria
                            // tanto para transacciones viejas (00:00 UTC) como nuevas
                            return d.toLocaleDateString('es-ES', {
                              timeZone: 'UTC',
                            });
                          })()}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {t.ticker}
                        </td>
                        <td className="px-4 py-3">
                          {t.type === 'BUY' ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Compra
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              Venta
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{qty}</td>
                        <td className="px-4 py-3 text-right">
                          ${price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          ${fees.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-medium text-right">
                          ${total}
                        </td>
                        <td className="px-4 py-3">
                          <TransactionActions
                            transaction={t}
                            portfolioId={id}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            hasNextPage={page < totalPages}
            hasPrevPage={page > 1}
          />
        </section>
      </main>
    </div>
  );
}
