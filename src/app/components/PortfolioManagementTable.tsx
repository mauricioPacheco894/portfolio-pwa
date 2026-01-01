'use client';

import {
  Check,
  Edit2,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
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
  totalValue: number; // Este valor viene convertido en dashboard, pero lo recalculamos internamente en USD para precisión de %
  exchangeRate: number;
  preCalculatedHoldingsUSD?: Record<string, number>; // Nueva prop opcional optimizada
  headerAction?: React.ReactNode; // Slot para botones extra (ej. Gráfica)
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

  // Para agregar nuevos tickers
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

  // 1. Preparar claves de target (incluye lo que estemos editando)
  const targetKeys = Object.keys(allocation);

  // 2. Consolidar Holdings (BASE USD)
  // ... (código existente de consolidación) ...
  let consolidatedHoldingsUSD: Record<string, number>;
  if (preCalculatedHoldingsUSD) {
    consolidatedHoldingsUSD = preCalculatedHoldingsUSD;
  } else {
    consolidatedHoldingsUSD = {};
    holdings.forEach((h) => {
      const normTicker = normalizeTicker(h.ticker, targetKeys);
      const valUSD = (h as any).marketValueGlobal || ((h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue));
      consolidatedHoldingsUSD[normTicker] = (consolidatedHoldingsUSD[normTicker] || 0) + valUSD;
    });
  }

  // Calculamos el valor total
  const totalPortfolioValueUSD = Object.values(consolidatedHoldingsUSD).reduce((a, b) => a + b, 0);

  // >>> NUEVO: Calcular Sugerencias en Tiempo Real <<<
  // Extraemos precios aproximados para el cálculo (si existen)
  const derivedPrices: Record<string, number> = {};
  holdings.forEach(h => {
    if (h.totalQuantity > 0) {
      derivedPrices[h.ticker] = h.currentValue / h.totalQuantity;
    }
  });

  // Usamos la utilidad compartida para recalcular basándonos en el allocation ACTUAL (editado)
  const liveSuggestions = calculateRebalancing(
    holdings,
    allocation,
    totalPortfolioValueUSD,
    derivedPrices
  );

  // 3. Crear lista unificada de tickers
  const allTickers = new Set([
    ...Object.keys(consolidatedHoldingsUSD),
    ...targetKeys,
  ]);

  const tableData = Array.from(allTickers).map((ticker) => {
    // Valor Base en USD
    const valueBaseUSD = consolidatedHoldingsUSD[ticker] || 0;

    // Convertimos para DISPLAY visual
    const displayValue = valueBaseUSD * exchangeRate;

    // Usamos la sugerencia EN VIVO, no la prop estática
    const suggestion = liveSuggestions.find((s) => s.ticker === ticker);

    // Porcentaje siempre calculado sobre la base USD consistente
    const currentPct = totalPortfolioValueUSD > 0 ? (valueBaseUSD / totalPortfolioValueUSD) * 100 : 0;
    const targetPct = allocation[ticker] || 0;

    return {
      ticker,
      currentValue: displayValue, // Para visualización en moneda seleccionada
      currentPct, // % real basado en valor (independiente de moneda)
      targetPct,
      suggestion,
    };
  })
    .filter((row) => {
      // Filtro Inteligente:
      // 1. Si tiene valor significativo (> 1 centavo), mostrar.
      // 2. Si tiene una meta definida (> 0%), mostrar (aunque valga 0, implica que debo comprar).
      // 3. Si vale 0 y la meta es 0, es basura/residuo/cerrada -> Ocultar.
      const hasValue = row.currentValue > 0.01;
      const hasTarget = row.targetPct > 0;

      // Mostramos si cumple cualquiera de las dos condiciones
      return hasValue || hasTarget;
    })
    .sort((a, b) => {
      // Ordenar: primero los que tienen target (estrategia), luego por valor
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
          {/* Aquí renderizamos la acción inyectada (Botón de Gráfica) */}
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
              <th className="px-3 py-2 text-right">% Actual</th>
              <th className="px-3 py-2 text-right">% Meta</th>
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
                  ${row.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 rounded bg-zinc-200 dark:bg-zinc-600">
                      <div
                        className="h-full rounded bg-blue-500"
                        style={{ width: `${Math.min(row.currentPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {row.currentPct.toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {editingTicker === row.ticker ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
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
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    // ...existing code...
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {row.targetPct.toFixed(2)}%
                      </span>
                      <button
                        onClick={() =>
                          handleStartEdit(row.ticker, row.targetPct)
                        }
                        className="text-zinc-400 hover:text-blue-500"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      {/* Check if the ticker is actually part of the strategy before showing delete */}
                      {allocation[row.ticker] !== undefined && (
                        <button
                          onClick={() => handleDelete(row.ticker)}
                          className="text-zinc-400 hover:text-red-500"
                          title="Eliminar de estrategia"
                        >
                          <Trash2 size={14} />
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
                    // Si el total no cuadra, mostramos aviso en vez de sugerencia engañosa
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

      {/* Footer separado: Agregar Nuevo */}
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
