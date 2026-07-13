'use client';

/**
 * Portfolio Dashboard Component
 *
 * Main client component for displaying portfolio data with currency toggle.
 * Handles USD/MXN conversion for display and consolidates holdings for charts.
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
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
  totalRealizedPnlUSD: number;
  totalRealizedPnlMXN: number;
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
  totalRealizedPnlUSD,
  totalRealizedPnlMXN,
  pagination,
}: Props) {
  const [currency, setCurrency] = useState<'USD' | 'MXN'>('USD');
  const [showValues, setShowValues] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_currency');
    if (saved === 'MXN') {
      setCurrency('MXN');
    }
    const savedVis = localStorage.getItem('portfolio_visibility');
    if (savedVis === 'hidden') {
      setShowValues(false);
    }
  }, []);

  const toggleVisibility = () => {
    const newVal = !showValues;
    setShowValues(newVal);
    localStorage.setItem('portfolio_visibility', newVal ? 'visible' : 'hidden');
  };

  const updateCurrency = (newCurrency: 'USD' | 'MXN') => {
    setCurrency(newCurrency);
    localStorage.setItem('portfolio_currency', newCurrency);
  };

  const exchangeRate = currency === 'USD' ? 1 : usdMxnRate;

  // Calculate totals in selected currency
  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.marketValueGlobal || 0) * exchangeRate,
    0
  );
  const totalInvested = holdings.reduce(
    (sum, h) => {
      if (currency === 'MXN') {
        // Use FX-adjusted historic cost basis for MXN display
        return sum + (h.totalInvestedMxn ?? (h.totalInvestedGlobal || 0) * exchangeRate);
      }
      return sum + (h.totalInvestedGlobal || 0);
    },
    0
  );

  const realizedPL = currency === 'MXN' ? totalRealizedPnlMXN : totalRealizedPnlUSD;
  const unrealizedPL = holdings.reduce(
    (sum, h) => {
      if (currency === 'MXN') {
        const valueMxn = (h.marketValueGlobal || 0) * exchangeRate;
        const costMxn = h.totalInvestedMxn ?? (h.totalInvestedGlobal || 0) * exchangeRate;
        return sum + (valueMxn - costMxn);
      }
      return sum + (h.plDollarsGlobal || 0);
    },
    0
  );

  const totalProfit = realizedPL + unrealizedPL;
  const percentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const isProfitable = totalProfit >= 0;
  const profitColor = isProfitable
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  const formatCurrency = (val: number) => {
    if (!showValues) return '****';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      signDisplay: 'always',
    }).format(val);
  };

  const formatTotal = (val: number) => {
    if (!showValues) return '****';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(val);
  };

  // Consolidate holdings by normalized ticker for charts (USD base)
  const consolidatedMapUSD: Record<string, number> = {};
  const targetKeys = portfolio.target_allocation
    ? Object.keys(portfolio.target_allocation)
    : [];

  holdings.forEach((h) => {
    const normTicker = normalizeTicker(h.ticker, targetKeys);
    const valUSD =
      h.marketValueGlobal ||
      (h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue);
    consolidatedMapUSD[normTicker] = (consolidatedMapUSD[normTicker] || 0) + valUSD;
  });

  // Prepare chart data (converted to display currency, filtered for meaningful values)
  const consolidatedAssetsForChart = Object.entries(consolidatedMapUSD)
    .map(([ticker, valUSD]) => ({
      ticker,
      currentValue: valUSD * exchangeRate,
    }))
    .filter((asset) => asset.currentValue > 0.1)
    .sort((a, b) => b.currentValue - a.currentValue);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-background dark:to-zinc-900/50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:gap-6 border-b border-border pb-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-start sm:items-center gap-3 w-full">
                <Link
                  href="/"
                  className="group flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted shrink-0 mt-1 sm:mt-0"
                  aria-label="Volver"
                >
                  <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-0.5" />
                </Link>
                <div className="flex-1 min-w-0">
                  <PortfolioActions
                    portfolioId={portfolio.id}
                    portfolioName={portfolio.name}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  onClick={toggleVisibility}
                  className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={showValues ? 'Ocultar valores' : 'Mostrar valores'}
                  title={showValues ? 'Ocultar valores' : 'Mostrar valores'}
                >
                  {showValues ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <button
                    onClick={() => updateCurrency('USD')}
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${currency === 'USD'
                      ? 'bg-white dark:bg-primary text-zinc-900 dark:text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    USD
                  </button>
                  <button
                    onClick={() => updateCurrency('MXN')}
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${currency === 'MXN'
                      ? 'bg-white dark:bg-primary text-zinc-900 dark:text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    MXN
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-start gap-0.5 sm:gap-3 sm:gap-x-8 text-sm w-full">
              <div className="flex justify-between sm:justify-start items-baseline gap-2 w-full sm:w-auto whitespace-nowrap">
                <span className="text-base text-muted-foreground font-medium">
                  Valor:
                </span>
                <span className="text-lg font-bold text-foreground">
                  {formatTotal(totalValue)}
                </span>
              </div>

              <div className="flex justify-between sm:justify-start items-baseline gap-2 w-full sm:w-auto whitespace-nowrap">
                <span className="text-base text-muted-foreground font-medium">
                  Invertido:
                </span>
                <span className="text-lg font-bold text-foreground">
                  {formatTotal(totalInvested)}
                </span>
              </div>

              <div className="flex justify-between sm:justify-start items-baseline gap-2 w-full sm:w-auto whitespace-nowrap">
                <span className="text-base text-muted-foreground font-medium">
                  Ganancia:
                </span>
                <div className="relative group cursor-help flex items-baseline gap-1.5">
                  <div className="flex items-baseline gap-1.5 border-b border-dotted border-border pb-0.5">
                    <span className={`text-lg font-bold ${profitColor}`}>
                      {formatCurrency(totalProfit)}
                    </span>
                    <span className={`text-sm font-bold ${profitColor}`}>
                      ({showValues ? `${percentage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '***'})
                    </span>
                  </div>

                  <div className="absolute top-full right-0 md:left-1/2 md:-translate-x-1/2 md:right-auto mt-2 w-56 rounded-xl bg-card p-4 shadow-xl ring-1 ring-border text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0 text-foreground whitespace-normal text-left">
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
                      <div className="border-t border-border pt-2 flex justify-between items-center font-bold text-foreground">
                        <span>Total Neto:</span>
                        <span className={`font-mono text-sm ${profitColor}`}>
                          {formatCurrency(totalProfit)}
                        </span>
                      </div>
                      <div className="absolute bottom-full right-8 md:right-1/2 md:translate-x-1/2 border-8 border-transparent border-b-white dark:border-b-card"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        <section className="mb-6">
          <PortfolioManagementTable
            holdings={activeHoldings}
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

        <section className="mb-6">
          <DashboardSections
            activeHoldings={activeHoldings}
            transactions={transactions}
            portfolioId={portfolio.id}
            pagination={pagination}
            uniqueTickers={uniqueTickers}
            usdMxnRate={usdMxnRate}
            holdings={holdings}
          />
        </section>
      </main>
    </div>
  );
}

/** Tabbed section for Positions and Transactions */
const CurrencyBadge = ({ currency }: { currency?: 'USD' | 'MXN' }) => {
  if (!currency) return null;
  return (
    <span
      className={`text-[9px] font-bold px-1 py-0 rounded transition-colors inline-flex items-center ${currency === 'MXN'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/50'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/50'
        }`}
    >
      {currency}
    </span>
  );
};

function DashboardSections({
  activeHoldings,
  transactions,
  portfolioId,
  pagination,
  uniqueTickers,
  usdMxnRate,
  holdings,
}: {
  activeHoldings: AssetPosition[];
  transactions: Transaction[];
  portfolioId: string;
  pagination: { page: number; totalPages: number };
  uniqueTickers: string[];
  usdMxnRate: number;
  holdings: AssetPosition[];
}) {
  const [expandedTxRows, setExpandedTxRows] = useState<Set<string>>(new Set());
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);

  const toggleTxRow = (id: string) => {
    setExpandedTxRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Posiciones */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-4 sm:px-6 border-b border-border bg-muted/30">
          <h2 className="text-lg font-semibold text-foreground">Mis Posiciones</h2>
        </div>
        <div className="p-4 sm:p-0">
          <HoldingsTable holdings={activeHoldings} />
        </div>
      </div>

      {/* Transacciones */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-4 sm:px-6 bg-card transition-colors hover:bg-muted/50"
          onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
        >
          <h2 className="text-lg font-semibold text-foreground">Historial de Transacciones</h2>
          <span className="text-muted-foreground bg-muted p-1 rounded-full">
            {isTransactionsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </button>
        
        {isTransactionsOpen && (
          <div className="p-4 sm:p-6 border-t border-border">
            <div className="overflow-x-hidden">
              <div className="pb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-border">
                <AddTransactionForm portfolioId={portfolioId} availableTickers={uniqueTickers} usdMxnRate={usdMxnRate} />
                <div className="flex-1 sm:max-w-md">
                  <TransactionFilters />
                </div>
              </div>

              <div className="pt-4 overflow-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-600">
                <table className="w-full table-auto text-sm relative block md:table text-left">
                  <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground hidden md:table-header-group">
                    <tr className="md:table-row">
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Ticker</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Precio Unit.</th>
                      <th className="px-3 py-2 text-right">Comisión</th>
                      <th className="px-3 py-2 text-right">T. Cambio</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="block md:table-row-group divide-y-0 md:divide-y divide-border/40 p-2 md:p-0">
                    {transactions.length === 0 ? (
                      <tr className="block md:table-row">
                        <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground block md:table-cell">
                          No hay transacciones registradas aún
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => {
                        const isExpanded = expandedTxRows.has(t.id);
                        const qty = Number(t.quantity);
                        const price = Number(t.price_per_unit);
                        const fees = t.fees ? Number(t.fees) : 0;
                        const amount = qty * price;
                        const netTotal = t.type === 'BUY' ? amount + fees : amount - fees;
                        const totalStr = netTotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });

                        const assetFromHoldings = holdings.find(h => h.ticker === t.ticker);
                        const tCurrency = assetFromHoldings?.currency || (Number(t.fx_rate) > 1 ? 'USD' : 'MXN');
                        
                        const dateObj = new Date(t.date);
                        const dateStr = dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC' });

                        return (
                          <tr key={t.id} className="hover:bg-muted transition-colors block md:table-row mb-2 md:mb-0 rounded-xl md:rounded-none border border-border md:border-0 p-3 md:p-0 shadow-sm md:shadow-none bg-card md:bg-transparent">
                            <td 
                              className={`flex justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 font-bold text-foreground text-sm cursor-pointer md:cursor-auto ${isExpanded ? 'border-b border-border/40 pb-2 mb-2 md:border-0 md:pb-1.5 md:mb-0' : ''}`}
                              onClick={() => toggleTxRow(t.id)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="md:hidden flex items-center text-muted-foreground">
                                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base md:text-sm">{t.ticker}</span>
                                  <CurrencyBadge currency={tCurrency as any} />
                                  <span className="md:hidden ml-1">
                                    {t.type === 'BUY' ? (
                                      <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-900/20 dark:text-green-400">C</span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-900/20 dark:text-red-400">V</span>
                                    )}
                                  </span>
                                </div>
                              </div>
                              <div className="md:hidden text-right font-semibold tabular-nums text-base">
                                ${totalStr}
                              </div>
                            </td>
                            {/* Fecha */}
                            <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right md:text-left text-muted-foreground`}>
                              <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Fecha</span>
                              <span>{dateStr}</span>
                            </td>
                            {/* Tipo (desktop only or expanded) */}
                            <td className={`hidden justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right md:text-left`}>
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
                            {/* Cantidad */}
                            <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                              <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Cantidad</span>
                              <span>{qty.toLocaleString('en-US')}</span>
                            </td>
                            {/* Precio */}
                            <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                              <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Precio Unit.</span>
                              <span>${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </td>
                            {/* Comisión */}
                            <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                              <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Comisión</span>
                              <span>${fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </td>
                            {/* T Cambio */}
                            <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                              <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">T. Cambio</span>
                              {t.fx_rate !== 1 ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{Number(t.fx_rate).toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            {/* Total (desktop) */}
                            <td className="hidden md:table-cell px-3 py-1.5 font-semibold text-right text-foreground">
                              ${totalStr}
                            </td>
                            {/* Acciones */}
                            <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-2 md:py-1.5 text-center border-t md:border-0 border-border/40 pt-3 md:pt-1.5 mt-3 md:mt-0`}>
                              <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Acciones</span>
                              <div className="flex justify-end w-full md:justify-center">
                                <TransactionActions transaction={t} portfolioId={portfolioId} usdMxnRate={usdMxnRate} />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 pb-1">
                <PaginationControls
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  hasNextPage={pagination.page < pagination.totalPages}
                  hasPrevPage={pagination.page > 1}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
