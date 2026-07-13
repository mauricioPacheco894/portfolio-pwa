'use client';

/**
 * Portfolio Dashboard Component
 *
 * Main client component for displaying portfolio data with currency toggle.
 * Handles USD/MXN conversion for display and consolidates holdings for charts.
 */

import { ChevronDown, ChevronLeft, ChevronUp,Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect,useState } from 'react';

import { usePortfolioCalculations } from '@/hooks/usePortfolioCalculations';
import { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';
import { Database } from '@/types/supabase';
import { getPortfolioIntraday } from '@/utils/intradayCalculations';

import AddTransactionForm from './AddTransactionForm';
import { Header } from './Header';
import HoldingsTable from './HoldingsTable';
import PaginationControls from './PaginationControls';
import PerformanceChart from './PerformanceChart';
import PortfolioActions from './PortfolioActions';
import PortfolioChartModal from './PortfolioChartModal';
import PortfolioHeaderStats from './PortfolioHeaderStats';
import PortfolioManagementTable from './PortfolioManagementTable';
import TransactionFilters from './TransactionFilters';
import TransactionsTable from './TransactionsTable';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type Portfolio = Database['public']['Tables']['portfolios']['Row'];

interface PortfolioDashboardProps {
  portfolio: Portfolio;
  holdings: AssetPosition[];
  activeHoldings: AssetPosition[];
  transactions: Transaction[];
  uniqueTickers: string[];
  rebalanceSuggestions: any[];
  usdMxnRate: number;
  totalRealizedPnlUSD: number;
  totalRealizedPnlMXN: number;
  pagination: { page: number; totalPages: number };
  historyData: any[];
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
  historyData,
}: PortfolioDashboardProps) {
  const [currency, setCurrency] = useState<'USD' | 'MXN'>('MXN');
  const [showValues, setShowValues] = useState(true);
  const [intradayData, setIntradayData] = useState<any[] | null>(null);
  const [isLoadingIntraday, setIsLoadingIntraday] = useState(true);

  // Use the custom hook to calculate all totals
  const {
    exchangeRate,
    totalValue: dbTotalValue,
    totalInvested: dbTotalInvested,
    realizedPL,
    unrealizedPL: dbUnrealizedPL,
    totalProfit: dbTotalProfit,
    percentage: dbPercentage,
    consolidatedAssetsForChart,
    preCalculatedHoldingsUSD,
    otherPnL,
    monthlyReturn,
    ytdReturn
  } = usePortfolioCalculations(
    holdings, 
    portfolio, 
    currency, 
    usdMxnRate, 
    totalRealizedPnlUSD,
    totalRealizedPnlMXN,
    historyData
  );

  // Sync with live intraday data if available (most recent Yahoo Finance 15m tick)
  let totalValue = dbTotalValue;
  let totalInvested = dbTotalInvested;
  
  if (intradayData && intradayData.length > 0) {
    const lastTick = intradayData[intradayData.length - 1];
    totalValue = currency === 'USD' ? lastTick.valueUSD : lastTick.valueMXN;
    totalInvested = currency === 'USD' ? lastTick.investedUSD : lastTick.investedMXN;
  }

  const totalProfit = totalValue - totalInvested;
  const percentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const unrealizedPL = totalProfit - realizedPL - (otherPnL || 0);

  useEffect(() => {
    let isMounted = true;
    getPortfolioIntraday(portfolio.id).then(data => {
      if (isMounted) {
        setIntradayData(data);
        setIsLoadingIntraday(false);
      }
    });
    return () => { isMounted = false; };
  }, [portfolio.id]);

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

            <PortfolioHeaderStats
              totalValue={totalValue}
              totalInvested={totalInvested}
              totalProfit={totalProfit}
              realizedPL={realizedPL}
              unrealizedPL={unrealizedPL}
              otherPnL={otherPnL}
              percentage={percentage}
              currency={currency}
              showValues={showValues}
              monthlyReturn={monthlyReturn}
              ytdReturn={ytdReturn}
            />
            </div>
          </div>

        <section className="mb-6">
          <PerformanceChart 
            currentValue={totalValue} 
            totalInvested={totalInvested}
            currency={currency} 
            showValues={showValues} 
            historyData={historyData}
            intradayData={intradayData || undefined}
            isLoadingIntraday={isLoadingIntraday}
          />
        </section>

        <section className="mb-6">
          <PortfolioManagementTable
            holdings={activeHoldings}
            preCalculatedHoldingsUSD={preCalculatedHoldingsUSD}
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
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);

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

              <TransactionsTable
                transactions={transactions}
                portfolioId={portfolioId}
                usdMxnRate={usdMxnRate}
                holdings={holdings}
              />

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
