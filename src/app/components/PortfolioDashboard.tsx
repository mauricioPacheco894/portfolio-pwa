'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import AddTransactionForm from './AddTransactionForm';
import { Header } from './Header';
import PaginationControls from './PaginationControls';
import HoldingsTable from './HoldingsTable';
import PortfolioActions from './PortfolioActions';
import PortfolioChartModal from './PortfolioChartModal';
import PortfolioManagementTable from './PortfolioManagementTable';
import TransactionActions from './TransactionActions';
import TransactionFilters from './TransactionFilters';
import { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';
import { Database } from '@/types/supabase';
import { normalizeTicker } from '@/utils/tickerMapping';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type Portfolio = Database['public']['Tables']['portfolios']['Row'];

interface Props {
  portfolio: Portfolio;
  holdings: AssetPosition[];
  activeHoldings: AssetPosition[];
  transactions: Transaction[];
  uniqueTickers: string[];
  rebalanceSuggestions: RebalanceSuggestion[];
  usdMxnRate: number;
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function PortfolioDashboard({
  portfolio,
  holdings,
  activeHoldings,
  transactions,
  uniqueTickers,
  rebalanceSuggestions,
  usdMxnRate,
  pagination,
}: Props) {
  const [currency, setCurrency] = useState<'USD' | 'MXN'>('USD');

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_currency');
    if (saved === 'MXN') {
      setCurrency('MXN');
    }
  }, []);

  const updateCurrency = (newCurrency: 'USD' | 'MXN') => {
    setCurrency(newCurrency);
    localStorage.setItem('portfolio_currency', newCurrency);
  };

  const exchangeRate = currency === 'USD' ? 1 : usdMxnRate;

  // Cálculos dinámicos en la moneda seleccionada
  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.marketValueGlobal || 0) * exchangeRate,
    0
  );
  const totalInvested = holdings.reduce(
    (sum, h) => sum + (h.totalInvestedGlobal || 0) * exchangeRate,
    0
  );

  // Realized PL y Unrealized PL también deben convertirse
  const realizedPL = holdings.reduce(
    (sum, h) => sum + (h.realizedPL || 0) * exchangeRate,
    0
  );
  const unrealizedPL = holdings.reduce(
    (sum, h) => sum + (h.plDollarsGlobal || 0) * exchangeRate,
    0
  );

  const totalProfit = realizedPL + unrealizedPL;

  const percentage =
    totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const isProfitable = totalProfit >= 0;
  const profitColor = isProfitable
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      signDisplay: 'always',
    }).format(val);

  const formatTotal = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(val);

  // Consolidación de datos CENTRALIZADA (Base USD)
  // Esto evita que la tabla y la gráfica calculen cosas diferentes o dupliquen trabajo
  const consolidatedMapUSD: Record<string, number> = {};

  // Obtenemos keys del target para ayudar a la inferencia
  const targetKeys = portfolio.target_allocation
    ? Object.keys(portfolio.target_allocation)
    : [];

  holdings.forEach((h) => {
    const normTicker = normalizeTicker(h.ticker, targetKeys);
    // Base siempre en USD
    const valUSD = h.marketValueGlobal || ((h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue));
    consolidatedMapUSD[normTicker] = (consolidatedMapUSD[normTicker] || 0) + valUSD;
  });

  // 1. Datos para la Gráfica (Convertidos a moneda visual)
  // Filtramos activos con valor casi nulo para evitar saturar la gráfica con etiquetas "0.0%"
  const consolidatedAssetsForChart = Object.entries(consolidatedMapUSD)
    .map(([ticker, valUSD]) => ({
      ticker,
      currentValue: valUSD * exchangeRate,
    }))
    .filter((asset) => asset.currentValue > 0.1) // Filtro: Valor > 10 centavos
    .sort((a, b) => b.currentValue - a.currentValue); // Ordenar de mayor a menor ayuda al renderizado

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b border-zinc-200 pb-6 mb-8 dark:border-zinc-800">
            <div className="flex items-center justify-between w-full md:w-auto gap-3">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="group flex items-center justify-center rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Volver"
                >
                  <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-0.5" />
                </Link>
                <PortfolioActions
                  portfolioId={portfolio.id}
                  portfolioName={portfolio.name}
                />
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-6 w-full md:w-auto">
              {/* Selector de Moneda */}
              <div className="flex items-center bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1 self-start md:self-center">
                <button
                  onClick={() => updateCurrency('USD')}
                  className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${currency === 'USD'
                    ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                >
                  USD
                </button>
                <button
                  onClick={() => updateCurrency('MXN')}
                  className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${currency === 'MXN'
                    ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                >
                  MXN
                </button>
              </div>

              {/* KPIs Grid Responsivo -> Flex en Desktop para ancho variable */}
              <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-row md:items-center gap-y-2 gap-x-6 md:gap-x-8 text-sm w-full md:w-auto">
                <div className="flex justify-between md:justify-start items-baseline gap-2">
                  <span className="text-zinc-500 font-medium dark:text-zinc-400">
                    Valor:
                  </span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                    {formatTotal(totalValue)}
                  </span>
                </div>

                <div className="flex justify-between md:justify-start items-baseline gap-2">
                  <span className="text-zinc-500 font-medium dark:text-zinc-400">
                    Invertido:
                  </span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                    {formatTotal(totalInvested)}
                  </span>
                </div>

                <div className="flex justify-between md:justify-start items-baseline gap-2">
                  <span className="text-zinc-500 font-medium dark:text-zinc-400">
                    Ganancia:
                  </span>
                  <div className="relative group cursor-help flex items-baseline gap-1.5 whitespace-nowrap">
                    <div className="flex items-baseline gap-1.5 border-b border-dotted border-zinc-300 dark:border-zinc-700 pb-0.5">
                      <span className={`text-lg font-bold ${profitColor}`}>
                        {formatCurrency(totalProfit)}
                      </span>
                      <span className={`text-sm font-bold ${profitColor}`}>
                        ({percentage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
                      </span>
                    </div>

                    {/* Tooltip Detallado */}
                    <div className="absolute top-full right-0 md:left-1/2 md:-translate-x-1/2 md:right-auto mt-2 w-56 rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-xl ring-1 ring-zinc-200 dark:ring-zinc-700 text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0 text-zinc-600 dark:text-zinc-300 whitespace-normal text-left">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Latente (Actual):</span>
                        <span
                          className={`font-mono ${unrealizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {formatCurrency(unrealizedPL)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium">
                          Realizada (Histórico):
                        </span>
                        <span
                          className={`font-mono ${realizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {formatCurrency(realizedPL)}
                        </span>
                      </div>
                      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 flex justify-between items-center font-bold text-zinc-900 dark:text-white">
                        <span>Total Neto:</span>
                        <span className={`font-mono text-sm ${profitColor}`}>
                          {formatCurrency(totalProfit)}
                        </span>
                      </div>

                      {/* Flecha del tooltip */}
                      <div className="absolute bottom-full right-8 md:right-1/2 md:translate-x-1/2 border-8 border-transparent border-b-white dark:border-b-zinc-800"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla Maestra de Gestión Unificada */}
        <section className="mb-6">
          <PortfolioManagementTable
            holdings={activeHoldings}
            // Pasamos los datos pre-calculados para optimizar
            preCalculatedHoldingsUSD={consolidatedMapUSD}
            currentTarget={portfolio.target_allocation || undefined}
            rebalanceSuggestions={rebalanceSuggestions}
            portfolioId={portfolio.id}
            availableTickers={uniqueTickers}
            totalValue={totalValue}
            exchangeRate={exchangeRate}
            headerAction={
              <PortfolioChartModal
                holdings={consolidatedAssetsForChart as any}
                targetAllocation={portfolio.target_allocation || undefined}
                totalValue={totalValue}
              />
            }
          />
        </section>

        {/* Sección de Posiciones */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              Mis Posiciones
            </h2>
          </div>
          <HoldingsTable holdings={activeHoldings} />
        </section>

        {/* Transacciones */}
        <section className="mb-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              Transacciones
            </h2>
            <div className="flex gap-2">
              <AddTransactionForm portfolioId={portfolio.id} />
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
                    const total = (qty * price + fees).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                          {(() => {
                            const d = new Date(t.date);
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
                        <td className="px-4 py-3 text-right">{qty.toLocaleString('en-US')}</td>
                        <td className="px-4 py-3 text-right">
                          ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          ${fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 font-medium text-right">
                          ${total}
                        </td>
                        <td className="px-4 py-3">
                          <TransactionActions
                            transaction={t}
                            portfolioId={portfolio.id}
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
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            hasNextPage={pagination.page < pagination.totalPages}
            hasPrevPage={pagination.page > 1}
          />
        </section>
      </main>
    </div>
  );
}
