'use client';

/**
 * Portfolio Management Table Component
 *
 * Displays holdings with target allocation editing, rebalancing suggestions,
 * and the ability to add new assets to the strategy.
 *
 * Features:
 * - Inline editing of target percentages
 * - Live rebalancing suggestions as targets are modified
 * - Dynamic tolerance bands for buy/sell recommendations
 * - Ticker consolidation (e.g., NU + NUN → NU)
 */

import {
  Check,
  Edit2,
  PlusCircle,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { supabase } from '@/lib/supabase';
import { normalizeTicker } from '@/utils/tickerMapping';
import { calculateRebalancing } from '@/utils/portfolioMath';

import { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';

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
  rebalanceSuggestions,
  portfolioId,
  availableTickers,
  totalValue,
  exchangeRate = 1,
  preCalculatedHoldingsUSD,
  headerAction,
}: PortfolioManagementTableProps) {
  const router = useRouter();
  const [allocation, setAllocation] = useState<Record<string, number>>(
    currentTarget || {}
  );
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [ticker, setTicker] = useState('');
  const [percentage, setPercentage] = useState('');

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

  // Calculate live suggestions based on current (edited) allocation
  const liveSuggestions = calculateRebalancing(
    holdings,
    allocation,
    totalPortfolioValueUSD,
    derivedPrices
  );

  // Build unified list of all tickers
  const allTickers = new Set([
    ...Object.keys(consolidatedHoldingsUSD),
    ...targetKeys,
  ]);

  const tableData = Array.from(allTickers)
    .map((ticker) => {
      const valueBaseUSD = consolidatedHoldingsUSD[ticker] || 0;
      const displayValue = valueBaseUSD * exchangeRate;
      const suggestion = liveSuggestions.find((s) => s.ticker === ticker);
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
        suggestion,
      };
    })
    .filter((row) => {
      const hasValue = row.currentValue > 0.01;
      const hasTarget = row.targetPct > 0;
      return hasValue || hasTarget;
    })
    .sort((a, b) => {
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

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
            Gestión de Portafolio
          </h3>
          {headerAction && <div>{headerAction}</div>}
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums tracking-tight animate-in fade-in zoom-in-95 ${Math.abs(total - 100) < 0.01
                  ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}
            >
              Total: {total.toFixed(2)}%
            </span>
          )}
          {hasChanges && (
            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
              <button
                onClick={handleCancelStrategy}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                title="Cancelar cambios"
              >
                <X size={16} />
              </button>
              <button
                onClick={handleSaveStrategy}
                disabled={isSaving}
                className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">Activo</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-right">% Actual / Meta</th>
              <th className="px-3 py-2 text-right">Diferencia</th>
              <th className="px-3 py-2 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {tableData.map((row) => (
              <tr
                key={row.ticker}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              >
                <td className="px-3 py-2 font-bold text-zinc-900 dark:text-white">
                  {row.ticker}
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  $
                  {row.currentValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-right">
                  {editingTicker === row.ticker ? (
                    <div className="flex items-center justify-end gap-1">
                      <span
                        className={`text-sm font-semibold tabular-nums ${row.targetPct === 0
                            ? 'text-zinc-600 dark:text-zinc-400'
                            : Math.abs(row.currentPct - row.targetPct) <= 0.5
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : row.currentPct < row.targetPct
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-orange-600 dark:text-orange-400'
                          }`}
                      >
                        {row.currentPct.toFixed(1)}%
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-500">/</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-14 rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-right dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={`text-sm font-semibold tabular-nums ${row.targetPct === 0
                            ? 'text-zinc-600 dark:text-zinc-400'
                            : Math.abs(row.currentPct - row.targetPct) <= 0.5
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : row.currentPct < row.targetPct
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-orange-600 dark:text-orange-400'
                          }`}
                      >
                        {row.currentPct.toFixed(1)}%
                      </span>
                      {row.targetPct > 0 ? (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-600">/</span>
                          <button
                            onClick={() => handleStartEdit(row.ticker, row.targetPct)}
                            className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-semibold text-zinc-700 hover:bg-blue-100 hover:text-blue-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 tabular-nums transition-colors"
                            title="Editar meta"
                          >
                            {Number(row.targetPct).toLocaleString('en-US', {
                              maximumFractionDigits: 2,
                            })}
                            %
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(row.ticker, 0)}
                          className="text-xs text-zinc-400 hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400"
                          title="Agregar meta"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                      {allocation[row.ticker] !== undefined && (
                        <button
                          onClick={() => handleDelete(row.ticker)}
                          className="text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400"
                          title="Eliminar de estrategia"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {row.targetPct > 0 && (
                    <span
                      className={`text-xs font-semibold ${row.targetPct - row.currentPct > 0
                          ? 'text-blue-600'
                          : row.targetPct - row.currentPct < 0
                            ? 'text-orange-600'
                            : 'text-zinc-500'
                        }`}
                    >
                      {row.targetPct - row.currentPct >= 0 ? '+' : ''}
                      {(row.targetPct - row.currentPct).toFixed(2)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center align-middle">
                  {Math.abs(total - 100) > 0.1 ? (
                    row.targetPct > 0 ? (
                      <div className="flex justify-end">
                        <span className="inline-flex items-center justify-center rounded bg-red-100 w-24 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:bg-red-900/30 dark:text-red-400">
                          AJUSTAR %
                        </span>
                      </div>
                    ) : null
                  ) : row.suggestion ? (
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`inline-flex w-20 items-center justify-center rounded py-0.5 text-[10px] font-bold uppercase tracking-wide ${row.suggestion.action === 'BUY'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                      >
                        {row.suggestion.action === 'BUY' ? 'Comprar' : 'Vender'}
                      </span>
                      <span className="w-16 text-right text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        $
                        {(row.suggestion.amount * exchangeRate).toLocaleString(
                          'en-US',
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }
                        )}
                      </span>
                    </div>
                  ) : row.targetPct > 0 && row.currentValue < 0.01 ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="inline-flex w-20 items-center justify-center rounded bg-blue-100 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        Comprar
                      </span>
                      <span className="w-16 text-right text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        ---
                      </span>
                    </div>
                  ) : row.targetPct > 0 ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="inline-flex w-20 items-center justify-center rounded bg-gray-100 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Mantener
                      </span>
                      <span className="w-16 text-right text-[10px] text-zinc-400 dark:text-zinc-500">
                        En rango
                      </span>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="NUEVO ACTIVO (TICKER)"
              className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-9 pr-4 text-xs font-medium uppercase text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              list="available-tickers"
              suppressHydrationWarning
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <Search size={14} />
            </div>
            <datalist id="available-tickers">
              {availableTickers.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-24">
              <input
                type="number"
                placeholder="Meta"
                min="0"
                max="100"
                step="0.01"
                className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-3 pr-7 text-right text-xs font-medium text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                suppressHydrationWarning
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">
                %
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!ticker || !percentage}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <PlusCircle size={14} />
              <span>AGREGAR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
