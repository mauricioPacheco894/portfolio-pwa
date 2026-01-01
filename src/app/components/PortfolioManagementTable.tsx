'use client';

import { Check, Edit2, PlusCircle, X, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { supabase } from '@/lib/supabase';
import { normalizeTicker } from '@/utils/tickerMapping';

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

  // 1. Preparar claves de target
  const targetKeys = Object.keys(allocation);

  // 2. Consolidar Holdings (BASE USD)
  // Si nos pasan ya el mapa calculado, lo usamos. Si no, lo calculamos aquí (fallback).
  let consolidatedHoldingsUSD: Record<string, number>;

  if (preCalculatedHoldingsUSD) {
    consolidatedHoldingsUSD = preCalculatedHoldingsUSD;
  } else {
    // Lógica legacy por si acaso no pasan la prop
    consolidatedHoldingsUSD = {};
    holdings.forEach((h) => {
      const normTicker = normalizeTicker(h.ticker, targetKeys);
      // Usamos marketValueGlobal que siempre es USD.
      // Si no existe, fallback a currentValue (que sería local) pero dividido por exchangeRate si es necesario, 
      // pero idealmente confiamos en que page.tsx ya normalizó a marketValueGlobal.
      const valUSD = (h as any).marketValueGlobal || ((h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue));

      consolidatedHoldingsUSD[normTicker] = (consolidatedHoldingsUSD[normTicker] || 0) + valUSD;
    });
  }

  // Calculamos el totalPortfolioValue en USD sumando los holdings consolidados para tener un denominador base consistente
  const totalPortfolioValueUSD = Object.values(consolidatedHoldingsUSD).reduce((a, b) => a + b, 0);

  // 3. Crear lista unificada de tickers para la tabla
  const allTickers = new Set([
    ...Object.keys(consolidatedHoldingsUSD),
    ...targetKeys,
  ]);

  const tableData = Array.from(allTickers).map((ticker) => {
    // Valor Base en USD
    const valueBaseUSD = consolidatedHoldingsUSD[ticker] || 0;

    // Convertimos para DISPLAY visual
    const displayValue = valueBaseUSD * exchangeRate;

    const suggestion = rebalanceSuggestions.find((s) => s.ticker === ticker);

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

        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${Math.abs(total - 100) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}
          >
            Total: {total.toFixed(2)}%
          </span>
          {hasChanges && (
            <button
              onClick={handleSaveStrategy}
              disabled={isSaving}
              className={`rounded px-3 py-1 text-sm font-medium text-white disabled:opacity-50 ${Math.abs(total - 100) < 0.01
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-zinc-400 hover:bg-zinc-500'
                }`}
            >
              {isSaving ? 'Guardando...' : 'Guardar Estrategia'}
            </button>
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
                  ${row.currentValue.toFixed(2)}
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
                <td className="px-3 py-2 text-center">
                  {row.suggestion && (
                    <button
                      className={`rounded px-2 py-1 text-xs font-bold ${row.suggestion.action === 'BUY'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}
                    >
                      {row.suggestion.action === 'BUY' ? 'Comprar' : 'Vender'} $
                      {row.suggestion.amount.toFixed(0)}
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Fila para agregar nuevo */}
            <tr className="bg-zinc-50 dark:bg-zinc-900">
              <td className="px-3 py-2">
                <input
                  type="text"
                  placeholder="Ticker"
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-sm uppercase dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  list="available-tickers"
                  suppressHydrationWarning
                />
                <datalist id="available-tickers">
                  {availableTickers.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </td>
              <td className="px-3 py-2" colSpan={2}></td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  placeholder="%"
                  min="0"
                  max="100"
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  suppressHydrationWarning
                />
              </td>
              <td className="px-3 py-2" colSpan={2}>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  <PlusCircle size={14} />
                  Agregar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
