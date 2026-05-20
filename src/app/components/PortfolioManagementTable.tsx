'use client';

/**
 * Portfolio Management Table Component
 *
 * Unified table with a dropdown to select the calculation mode:
 * - Strategy: Shows tolerance-based buy/sell/hold suggestions
 * - Deposit: Shows how to distribute new money (only buys)
 * - Rebalance: Shows classic rebalance (buy/sell to match targets)
 */

import {
  ArrowDownCircle,
  ArrowUpCircle,
  MinusCircle,
  Check,
  ChevronDown,
  Edit2,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useRef, useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { normalizeTicker } from '@/utils/tickerMapping';
import {
  calculateRebalancing,
  calculateClassicRebalance,
  calculateSmartDeposit,
  prepareRebalanceItems,
} from '@/utils/portfolioMath';
import { KNOWN_TICKERS } from '@/constants/tickers';
import TickerAutocomplete from './TickerAutocomplete';

import { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';

type CalcMode = 'strategy' | 'deposit' | 'rebalance';

const MODE_OPTIONS: { value: CalcMode; label: string; description: string }[] = [
  { value: 'strategy', label: 'Estrategia', description: 'Sugerencias basadas en tolerancia' },
  { value: 'deposit', label: 'Aportar Dinero', description: 'Distribuir nueva inversión' },
  { value: 'rebalance', label: 'Rebalancear', description: 'Comprar/vender para equilibrar' },
];

interface PortfolioManagementTableProps {
  holdings: AssetPosition[];
  currentTarget: Record<string, number> | undefined;
  rebalanceSuggestions: RebalanceSuggestion[];
  portfolioId: string;
  availableTickers: string[];
  totalValue: number;
  exchangeRate: number;
  preCalculatedHoldingsUSD?: Record<string, number>;
  headerAction?: React.ReactNode;
}


export default function PortfolioManagementTable({
  holdings,
  currentTarget,
  portfolioId,
  availableTickers,
  exchangeRate = 1,
  preCalculatedHoldingsUSD,
  headerAction,
}: PortfolioManagementTableProps) {
  const router = useRouter();
  const [calcMode, setCalcMode] = useState<CalcMode>('strategy');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [allocation, setAllocation] = useState<Record<string, number>>(
    currentTarget || {}
  );
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [depositAmount, setDepositAmount] = useState<string>('5000');

  const [ticker, setTicker] = useState('');
  const [percentage, setPercentage] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartEdit = (ticker: string, currentValue: number) => {
    setEditingTicker(ticker);
    setEditValue(currentValue.toString());
  };

  const handleCancelEdit = () => {
    setEditingTicker(null);
    setEditValue('');
  };

  const handleSaveEdit = () => {
    const newVal = parseFloat(editValue);
    if (isNaN(newVal) || newVal < 0 || newVal > 100) {
      return;
    }
    if (editingTicker) {
      setAllocation({ ...allocation, [editingTicker]: newVal });
    }
    handleCancelEdit();
  };

  const handleAdd = () => {
    const trimmedTicker = ticker.trim().toUpperCase();
    const pct = parseFloat(percentage);

    if (!trimmedTicker || isNaN(pct) || pct <= 0 || pct > 100) {
      return;
    }

    setAllocation({ ...allocation, [trimmedTicker]: pct });
    setTicker('');
    setPercentage('');
  };

  const handleDelete = (tickerToDelete: string) => {
    const newAllocation = { ...allocation };
    delete newAllocation[tickerToDelete];
    setAllocation(newAllocation);
  };

  const handleSaveStrategy = async () => {
    setError('');
    setIsSaving(true);

    const total = Object.values(allocation).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.01) {
      setError(`La asignación suma ${total.toFixed(2)}%, debe ser 100%`);
      setIsSaving(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('portfolios')
        .update({ target_allocation: allocation })
        .eq('id', portfolioId);

      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }

      router.refresh();
    } catch (err) {
      setError('Error al guardar');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const total = Object.values(allocation).reduce((a, b) => a + b, 0);
  const targetKeys = Object.keys(allocation);

  // Consolidate holdings in USD
  let consolidatedHoldingsUSD: Record<string, number>;
  if (preCalculatedHoldingsUSD) {
    consolidatedHoldingsUSD = preCalculatedHoldingsUSD;
  } else {
    consolidatedHoldingsUSD = {};
    holdings.forEach((h) => {
      const normTicker = normalizeTicker(h.ticker, targetKeys);
      const valUSD =
        (h as any).marketValueGlobal ||
        (h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue);
      consolidatedHoldingsUSD[normTicker] =
        (consolidatedHoldingsUSD[normTicker] || 0) + valUSD;
    });
  }

  const totalPortfolioValueUSD = Object.values(consolidatedHoldingsUSD).reduce(
    (a, b) => a + b,
    0
  );

  // Derive prices for rebalancing calculations
  const derivedPrices: Record<string, number> = {};
  holdings.forEach((h) => {
    if (h.totalQuantity > 0) {
      derivedPrices[h.ticker] = h.currentValue / h.totalQuantity;
    }
  });

  // Calculate suggestions based on mode
  const strategySuggestions = calculateRebalancing(
    holdings,
    allocation,
    totalPortfolioValueUSD,
    derivedPrices
  );

  const rebalanceItems = useMemo(() => {
    return prepareRebalanceItems(
      consolidatedHoldingsUSD,
      allocation,
      totalPortfolioValueUSD
    );
  }, [consolidatedHoldingsUSD, allocation, totalPortfolioValueUSD]);

  const depositProposals = useMemo(() => {
    const amount = parseFloat(depositAmount) || 0;
    const amountUSD = amount / exchangeRate;
    return calculateSmartDeposit(rebalanceItems, amountUSD);
  }, [rebalanceItems, depositAmount, exchangeRate]);

  const rebalanceProposals = useMemo(() => {
    return calculateClassicRebalance(rebalanceItems);
  }, [rebalanceItems]);

  // Build unified list of all tickers
  const allTickers = new Set([
    ...Object.keys(consolidatedHoldingsUSD),
    ...targetKeys,
  ]);

  const tableData = Array.from(allTickers)
    .map((ticker) => {
      const valueBaseUSD = consolidatedHoldingsUSD[ticker] || 0;
      const displayValue = valueBaseUSD * exchangeRate;
      const strategySuggestion = strategySuggestions.find((s) => s.ticker === ticker);
      const depositProposal = depositProposals.find((p) => p.ticker === ticker);
      const rebalanceProposal = rebalanceProposals.find((p) => p.ticker === ticker);
      const currentPct =
        totalPortfolioValueUSD > 0
          ? (valueBaseUSD / totalPortfolioValueUSD) * 100
          : 0;
      const targetPct = allocation[ticker] || 0;

      return {
        ticker,
        currentValue: displayValue,
        currentPct,
        targetPct,
        strategySuggestion,
        depositProposal,
        rebalanceProposal,
      };
    })
    .filter((row) => {
      const hasValue = row.currentValue > 0.01;
      const hasTarget = row.targetPct > 0;
      return hasValue || hasTarget;
    })
    .sort((a, b) => {
      // Sort by action priority in deposit/rebalance modes
      if (calcMode !== 'strategy') {
        const aProposal = calcMode === 'deposit' ? a.depositProposal : a.rebalanceProposal;
        const bProposal = calcMode === 'deposit' ? b.depositProposal : b.rebalanceProposal;
        if (aProposal && bProposal) {
          const actionOrder = { BUY: 0, SELL: 1, HOLD: 2 };
          if (actionOrder[aProposal.action] !== actionOrder[bProposal.action]) {
            return actionOrder[aProposal.action] - actionOrder[bProposal.action];
          }
          return bProposal.amount - aProposal.amount;
        }
      }
      // Default: sort by target first, then value
      if (a.targetPct > 0 && b.targetPct === 0) return -1;
      if (a.targetPct === 0 && b.targetPct > 0) return 1;
      return b.currentValue - a.currentValue;
    });

  const handleCancelStrategy = () => {
    setAllocation(currentTarget || {});
    setError('');
  };

  const hasChanges = (() => {
    const initial = currentTarget || {};
    const currentKeys = Object.keys(allocation);
    const initialKeys = Object.keys(initial);
    if (currentKeys.length !== initialKeys.length) return true;
    for (const key of currentKeys) {
      if (allocation[key] !== initial[key]) return true;
    }
    return false;
  })();

  const hasTargets = Object.keys(allocation).length > 0;
  const showProjectedColumn = calcMode !== 'strategy' && hasTargets;

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const selectedMode = MODE_OPTIONS.find((m) => m.value === calcMode)!;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h3 className="text-base font-semibold text-foreground">
            Gestión de Portafolio
          </h3>
          {headerAction && <div>{headerAction}</div>}

          {hasTargets && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:opacity-80"
              >
                <span>{selectedMode.label}</span>
                <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-lg">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setCalcMode(option.value);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-muted ${calcMode === option.value ? 'bg-muted' : ''
                        }`}
                    >
                      <div className="text-sm font-medium text-foreground">
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {calcMode === 'deposit' && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-sm text-muted-foreground">·</span>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground/50">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="w-28 sm:w-36 rounded-lg border border-border bg-background py-1 pr-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pl-6"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums tracking-tight ${Math.abs(total - 100) < 0.01
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  }`}
              >
                Total: {total.toFixed(2)}%
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCancelStrategy}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Cancelar cambios"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSaveStrategy}
                  disabled={isSaving}
                  className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-500/20">
          {error}
        </div>
      )}

      <div className="p-4 sm:p-6">
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-foreground font-semibold shadow-sm">
              <tr>
                <th className="px-3 sm:px-4 py-2 text-left">Activo</th>
                <th className="px-3 sm:px-4 py-2 text-right">Valor</th>
                <th className="px-3 sm:px-4 py-2 text-right">% Actual / Meta</th>
                {showProjectedColumn && (
                  <th className="px-3 sm:px-4 py-2 text-right">Después</th>
                )}
                {!showProjectedColumn && (
                  <th className="px-3 sm:px-4 py-2 text-right">Diferencia</th>
                )}
                <th className="px-3 sm:px-4 py-2 text-right">Acción</th>
                <th className="px-3 sm:px-4 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tableData.map((row) => {
                const proposal = calcMode === 'deposit' ? row.depositProposal : row.rebalanceProposal;

                return (
                  <tr
                    key={row.ticker}
                    className="hover:bg-muted transition-colors"
                  >
                    <td className="px-3 sm:px-4 py-1.5 font-bold text-foreground text-sm">
                      {row.ticker}
                    </td>

                    <td className="px-3 sm:px-4 py-1.5 text-right text-muted-foreground text-sm tabular-nums">
                      $
                      {row.currentValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="px-3 sm:px-4 py-1.5 text-right">
                      {editingTicker === row.ticker ? (
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                            {row.currentPct.toFixed(1)}%
                          </span>
                          <span className="text-muted-foreground/40">/</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-14 rounded border border-border px-1.5 py-0.5 text-xs text-right bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                          />
                          <button onClick={handleSaveEdit} className="text-emerald-600 hover:text-emerald-700 transition-colors">
                            <Check size={14} />
                          </button>
                          <button onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <span
                            className={`text-sm font-semibold tabular-nums ${row.targetPct === 0
                              ? 'text-muted-foreground'
                              : Math.abs(row.currentPct - row.targetPct) <= 0.5
                                ? 'text-emerald-500'
                                : row.currentPct < row.targetPct
                                  ? 'text-primary'
                                  : 'text-orange-500'
                              }`}
                          >
                            {row.currentPct.toFixed(1)}%
                          </span>
                          {row.targetPct > 0 ? (
                            <>
                              <span className="text-border">/</span>
                              <button
                                onClick={() => handleStartEdit(row.ticker, row.targetPct)}
                                className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold text-foreground hover:bg-primary/20 hover:text-primary tabular-nums transition-colors"
                                title="Editar meta"
                              >
                                {Number(row.targetPct).toLocaleString('en-US', { maximumFractionDigits: 2 })}%
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(row.ticker, 0)}
                              className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
                              title="Agregar meta"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                          {allocation[row.ticker] !== undefined && (
                            <button
                              onClick={() => handleDelete(row.ticker)}
                              className="text-muted-foreground/30 hover:text-red-500 transition-colors"
                              title="Eliminar de estrategia"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {showProjectedColumn ? (
                      <td className="px-3 sm:px-4 py-1.5 text-right">
                        {proposal && row.targetPct > 0 ? (
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <span className="text-sm font-semibold text-foreground">
                              {proposal.projectedPct?.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              / {row.targetPct.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground/30">—</span>
                        )}
                      </td>
                    ) : (
                      <td className="px-3 sm:px-4 py-1.5 text-right whitespace-nowrap">
                        {row.targetPct > 0 ? (
                          <span
                            className={`text-sm font-semibold ${row.targetPct - row.currentPct > 0
                              ? 'text-primary'
                              : row.targetPct - row.currentPct < 0
                                ? 'text-orange-500'
                                : 'text-muted-foreground'
                              }`}
                          >
                            {row.targetPct - row.currentPct >= 0 ? '+' : ''}
                            {(row.targetPct - row.currentPct).toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground/30">—</span>
                        )}
                      </td>
                    )}

                    {calcMode === 'strategy' ? (
                      renderStrategyAction(row, total, exchangeRate)
                    ) : (
                      renderRebalanceAction(proposal, row.targetPct, exchangeRate)
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <TickerAutocomplete
                value={ticker}
                onChange={setTicker}
                suggestions={[...KNOWN_TICKERS, ...availableTickers]}
                placeholder="NUEVO ACTIVO (TICKER)"
                className="w-full rounded-md border border-border bg-background py-1.5 px-3 text-xs font-medium uppercase text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                onEnter={handleAdd}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-24">
                <input
                  type="number"
                  placeholder="Meta"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-3 pr-7 text-right text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  suppressHydrationWarning
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground/50">
                  %
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={!ticker || !percentage}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusCircle size={14} />
                <span>AGREGAR</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}

// Helper: Render strategy mode action
function renderStrategyAction(
  row: {
    ticker: string;
    currentValue: number;
    currentPct: number;
    targetPct: number;
    strategySuggestion?: RebalanceSuggestion;
  },
  total: number,
  exchangeRate: number
) {
  const isIncorrectStrategy = Math.abs(total - 100) > 0.1;

  if (isIncorrectStrategy && row.targetPct > 0) {
    return (
      <>
        <td className="px-3 sm:px-4 py-1.5 text-right">
          <span className="inline-flex w-24 items-center justify-center rounded bg-red-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-red-600 dark:bg-red-900/30 dark:text-red-400">
            AJUSTAR %
          </span>
        </td>
        <td className="px-3 sm:px-4 py-1.5 text-right text-sm text-muted-foreground/40 italic">
          Inválido
        </td>
      </>
    );
  }

  if (row.strategySuggestion && row.strategySuggestion.action !== 'HOLD') {
    return (
      <>
        <td className="px-3 sm:px-4 py-1.5 text-right">
          <span
            className={`inline-flex w-24 justify-center items-center gap-1 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${row.strategySuggestion.action === 'BUY'
              ? 'bg-primary/20 text-primary'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}
          >
            {row.strategySuggestion.action === 'BUY' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
            {row.strategySuggestion.action === 'BUY' ? 'Comprar' : 'Vender'}
          </span>
        </td>
        <td className="px-3 sm:px-4 py-1.5 text-right text-sm font-medium text-foreground tabular-nums">
          $
          {(row.strategySuggestion.amount * exchangeRate).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </td>
      </>
    );
  }

  if (row.targetPct > 0 && row.currentValue < 0.01) {
    return (
      <>
        <td className="px-3 sm:px-4 py-1.5 text-right">
          <span className="inline-flex w-24 justify-center items-center gap-1 rounded bg-primary/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
            <ArrowUpCircle size={10} />
            Comprar
          </span>
        </td>
        <td className="px-3 sm:px-4 py-1.5 text-right text-sm font-medium text-muted-foreground tabular-nums">
          ---
        </td>
      </>
    );
  }

  if (row.targetPct > 0) {
    return (
      <>
        <td className="px-3 sm:px-4 py-2 text-right">
          <span className="inline-flex w-24 justify-center items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <MinusCircle size={10} />
            Mantener
          </span>
        </td>
        <td className="px-3 sm:px-4 py-2 text-right text-[11px] text-muted-foreground/60 leading-tight">
          En rango
        </td>
      </>
    );
  }

  return (
    <>
      <td className="px-3 sm:px-4 py-2 text-right">
        <span className="inline-flex w-24 justify-center items-center rounded border border-dashed border-border/80 bg-muted/30 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/45">
          Sin meta
        </span>
      </td>
      <td className="px-3 sm:px-4 py-2 text-right">
        <span className="text-sm text-muted-foreground/30 font-medium">—</span>
      </td>
    </>
  );
}

// Helper: Render deposit/rebalance mode action
function renderRebalanceAction(
  proposal: { action: 'BUY' | 'SELL' | 'HOLD'; amount: number } | undefined,
  targetPct: number,
  exchangeRate: number
) {
  if (!proposal || (targetPct === 0 && (proposal.action === 'HOLD' || proposal.amount < 0.01))) {
    return (
      <>
        <td className="px-3 sm:px-4 py-2 text-right">
          <span className="inline-flex w-24 justify-center items-center rounded border border-dashed border-border/80 bg-muted/30 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/45">
            Sin meta
          </span>
        </td>
        <td className="px-3 sm:px-4 py-2 text-right">
          <span className="text-sm text-muted-foreground/30 font-medium">—</span>
        </td>
      </>
    );
  }

  if (proposal.action === 'HOLD' || proposal.amount < 0.01) {
    return (
      <>
        <td className="px-3 sm:px-4 py-2 text-right">
          <span className="inline-flex w-24 justify-center items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <MinusCircle size={10} />
            Mantener
          </span>
        </td>
        <td className="px-3 sm:px-4 py-2 text-right text-[11px] text-muted-foreground/60 leading-tight">
          En rango
        </td>
      </>
    );
  }

  const amountDisplay = proposal.amount * exchangeRate;

  return (
    <>
      <td className="px-3 sm:px-4 py-2 text-right">
        <span
          className={`inline-flex w-24 justify-center items-center gap-1 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${proposal.action === 'BUY'
            ? 'bg-primary/20 text-primary'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
        >
          {proposal.action === 'BUY' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
          {proposal.action === 'BUY' ? 'Comprar' : 'Vender'}
        </span>
      </td>
      <td className="px-3 sm:px-4 py-2 text-right text-sm font-medium text-foreground tabular-nums">
        $
        {amountDisplay.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}
      </td>
    </>
  );
}
