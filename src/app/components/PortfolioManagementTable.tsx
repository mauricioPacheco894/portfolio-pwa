'use client';

/**
 * Portfolio Management Table Component ("Posiciones y estrategia")
 *
 * Tabla única de posiciones y estrategia: fusiona la antigua "Mis Posiciones"
 * (HoldingsTable) con "Gestión de Portafolio". Diseño compacto: 4 columnas
 * siempre visibles (Activo | Valor | G/P | % Act. / Meta con mini barra) y
 * detalle expandible por fila (Cant., Costo, Precio, G/P, % Meta editable,
 * Diferencia/Después, Acción, Monto). Se muestran TODAS las posiciones sin
 * scroll interno ni scroll horizontal: el componente crece verticalmente.
 *
 * Los cálculos (consolidación, totales, sugerencias) viven en
 * usePortfolioCalculations a partir de la meta GUARDADA; esta tabla solo
 * presenta y edita las metas. Las sugerencias se recalculan al guardar.
 */

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  ChevronDown,
  Edit2,
  MinusCircle,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';

import { KNOWN_TICKERS } from '@/constants/tickers';
import { supabase } from '@/lib/supabase';
import { ConsolidatedPosition, RebalanceSuggestion } from '@/types/portfolio';
import { type OrderProposal } from '@/utils/portfolioMath';

import TickerAutocomplete from './TickerAutocomplete';
import { CurrencyBadge } from './ui/CurrencyBadge';

type CalcMode = 'strategy' | 'deposit' | 'rebalance';

const MODE_OPTIONS: { value: CalcMode; label: string; description: string }[] = [
  { value: 'strategy', label: 'Estrategia', description: 'Sugerencias basadas en tolerancia' },
  { value: 'deposit', label: 'Aportar Dinero', description: 'Distribuir nueva inversión' },
  { value: 'rebalance', label: 'Rebalancear', description: 'Comprar/vender para equilibrar' },
];

interface PortfolioManagementTableProps {
  /** Posiciones consolidadas por ticker normalizado (del hook). */
  consolidatedPositions: ConsolidatedPosition[];
  /** Sugerencias de estrategia calculadas por el hook con la meta guardada. */
  strategySuggestions: RebalanceSuggestion[];
  /** Propuestas de depósito calculadas por el hook con la meta guardada. */
  depositProposals: OrderProposal[];
  /** Propuestas de rebalanceo clásico calculadas por el hook. */
  rebalanceProposals: OrderProposal[];
  currentTarget: Record<string, number> | undefined;
  portfolioId: string;
  availableTickers: string[];
  /** Total del header (mismo valor que muestra PortfolioHeaderStats). */
  totalValue: number;
  exchangeRate: number;
  /** Monto de aporte del modo "Aportar Dinero" (estado del Dashboard). */
  depositAmount: string;
  onDepositAmountChange: (value: string) => void;
  headerAction?: React.ReactNode;
}


export default function PortfolioManagementTable({
  consolidatedPositions,
  strategySuggestions,
  depositProposals,
  rebalanceProposals,
  currentTarget,
  portfolioId,
  availableTickers,
  totalValue,
  exchangeRate = 1,
  depositAmount,
  onDepositAmountChange,
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

  const [ticker, setTicker] = useState('');
  const [percentage, setPercentage] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (t: string) => {
    // Si se colapsa la fila cuya meta se está editando, se cancela la edición.
    if (editingTicker === t && expandedRows.has(t)) {
      setEditingTicker(null);
      setEditValue('');
    }
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

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

  // Los cálculos (consolidación, totales, sugerencias) vienen del hook
  // (usePortfolioCalculations) a partir de la meta guardada. Esta tabla ya
  // no consolida, no calcula su propio total ni recalcula sugerencias: las
  // recibe como props. Si el usuario edita una meta sin guardar, las
  // sugerencias siguen reflejando la meta guardada y se actualizan al guardar.
  const positionsByTicker = new Map(
    consolidatedPositions.map((p) => [p.ticker, p])
  );

  // Build unified list of all tickers
  const allTickers = new Set([
    ...positionsByTicker.keys(),
    ...targetKeys,
  ]);

  const tableData = Array.from(allTickers)
    .map((ticker) => {
      const position = positionsByTicker.get(ticker);
      const valueBaseUSD = position?.marketValueUSD || 0;
      const displayValue = valueBaseUSD * exchangeRate;
      const quantity = position?.quantity || 0;
      // Costo y precio en la moneda seleccionada (base USD del hook).
      const displayCost =
        quantity > 0
          ? ((position?.totalInvestedUSD || 0) * exchangeRate) / quantity
          : 0;
      const displayPrice =
        quantity > 0 ? (valueBaseUSD * exchangeRate) / quantity : 0;
      const plDisplay = (position?.plUSD || 0) * exchangeRate;
      const plPct =
        position && position.totalInvestedUSD > 0
          ? (position.plUSD / position.totalInvestedUSD) * 100
          : 0;
      const strategySuggestion = strategySuggestions.find((s) => s.ticker === ticker);
      const depositProposal = depositProposals.find((p) => p.ticker === ticker);
      const rebalanceProposal = rebalanceProposals.find((p) => p.ticker === ticker);
      // El denominador es el total del header (prop totalValue): header y
      // tabla siempre usan el mismo total.
      const currentPct =
        totalValue > 0 ? (displayValue / totalValue) * 100 : 0;
      const targetPct = allocation[ticker] || 0;

      return {
        ticker,
        quantity,
        displayCost,
        displayPrice,
        plDisplay,
        plPct,
        isNegative: position?.isNegative ?? false,
        currency: position?.currency ?? 'USD',
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

  // Escala común de la barra de %: el largo es proporcional al % actual
  // respecto al mayor % (actual o meta) de todas las filas, redondeado
  // hacia arriba a múltiplos de 5 (mín. 10). Antes la barra era
  // actual/meta por fila, así que un 2.6% con meta 3% se veía casi tan
  // llena como un 11.2% con meta 12%.
  const barScaleMax = Math.max(
    10,
    Math.ceil(
      Math.max(...tableData.map((r) => Math.max(r.currentPct, r.targetPct)), 0) / 5
    ) * 5
  );

  const selectedMode = MODE_OPTIONS.find((m) => m.value === calcMode)!;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h3 className="text-base font-semibold text-foreground">
            Posiciones y estrategia
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
                  onChange={(e) => onDepositAmountChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {tableData.length} posiciones
          </span>
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

      <div className="p-3 sm:p-4">
        <table className="w-full table-fixed text-xs sm:text-sm">
          <colgroup>
            <col className="w-[32%] sm:w-[12%]" />
            <col className="w-[26%] sm:w-[10%]" />
            <col className="w-[14%] sm:w-[7%]" />
            <col className="hidden sm:table-col sm:w-[7%]" />
            <col className="hidden sm:table-col sm:w-[9%]" />
            <col className="hidden sm:table-col sm:w-[9%]" />
            <col className="w-[28%] sm:w-[8%]" />
            <col className="hidden sm:table-col sm:w-[9%]" />
            <col className="hidden sm:table-col sm:w-[8%]" />
            <col className="hidden sm:table-col sm:w-[11%]" />
            <col className="hidden sm:table-col sm:w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-[10px] uppercase text-muted-foreground sm:text-xs">
              <th scope="col" className="whitespace-nowrap py-2 pr-1 text-left font-semibold sm:pr-2">
                Activo
              </th>
              <th scope="col" className="whitespace-nowrap py-2 px-0.5 text-right font-semibold sm:px-1">
                Valor
              </th>
              <th scope="col" className="whitespace-nowrap py-2 px-0.5 text-right font-semibold sm:px-1">
                G/P
              </th>
              <th scope="col" className="hidden whitespace-nowrap py-2 px-1 text-right font-semibold sm:table-cell">
                Cant.
              </th>
              <th scope="col" className="hidden whitespace-nowrap py-2 px-1 text-right font-semibold sm:table-cell">
                Costo
              </th>
              <th scope="col" className="hidden whitespace-nowrap py-2 px-1 text-right font-semibold sm:table-cell">
                Precio
              </th>
              <th scope="col" className="whitespace-nowrap py-2 px-0.5 text-right font-semibold sm:px-1">
                % Act.
              </th>
              <th scope="col" className="hidden whitespace-nowrap py-2 px-1 text-right font-semibold sm:table-cell">
                % Meta
              </th>
              <th scope="col" className="hidden whitespace-nowrap py-2 px-1 text-right font-semibold sm:table-cell">
                {showProjectedColumn ? 'Después' : 'Diferencia'}
              </th>
              <th scope="col" className="hidden whitespace-nowrap py-2 px-1 text-center font-semibold sm:table-cell">
                Acción
              </th>
              <th scope="col" className="hidden whitespace-nowrap py-2 pl-1 text-right font-semibold sm:table-cell">
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => {
              const proposal =
                calcMode === 'deposit' ? row.depositProposal : row.rebalanceProposal;
              const isExpanded = expandedRows.has(row.ticker);
              const pctDiff = row.currentPct - row.targetPct;
              const pctColorClass =
                row.targetPct === 0
                  ? 'text-muted-foreground'
                  : Math.abs(pctDiff) <= 0.5
                    ? 'text-emerald-500'
                    : row.currentPct < row.targetPct
                      ? 'text-primary'
                      : 'text-orange-500';
              const barPct =
                row.targetPct > 0
                  ? Math.min((row.currentPct / barScaleMax) * 100, 100)
                  : 0;
              // Badge, monto y nota de la acción sugerida (columnas de
              // escritorio y detalle móvil comparten este cálculo).
              const action = getRowAction(row, calcMode, total, exchangeRate);
              // Editor de % meta compartido por el detalle móvil (rejilla) y
              // el detalle de escritorio (tira de edición).
              const metaEditor =
                editingTicker === row.ticker ? (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-16 rounded border border-border px-1.5 py-0.5 text-xs text-right bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
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
                      className="text-emerald-600 hover:text-emerald-700 transition-colors"
                      aria-label="Guardar meta"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Cancelar edición"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {row.targetPct > 0 ? (
                      <button
                        onClick={() => handleStartEdit(row.ticker, row.targetPct)}
                        className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold text-foreground hover:bg-primary/20 hover:text-primary tabular-nums transition-colors"
                        title="Editar meta"
                      >
                        {Number(row.targetPct).toLocaleString('en-US', {
                          maximumFractionDigits: 2,
                        })}
                        %
                      </button>
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
                        aria-label={`Eliminar meta de ${row.ticker}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                );

              return (
                <Fragment key={row.ticker}>
                  <tr className="border-t border-border/40 first:border-t-0 hover:bg-muted/50">
                    <td className="py-2 pr-1 sm:pr-2">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.ticker)}
                        aria-expanded={isExpanded}
                        aria-controls={`pos-detalle-${row.ticker}-m pos-detalle-${row.ticker}-d`}
                        aria-label={`${isExpanded ? 'Ocultar' : 'Mostrar'} detalle de ${row.ticker}`}
                        className="flex items-center gap-0.5 rounded-md px-1 py-0.5 -mx-1 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-1"
                      >
                        <ChevronDown
                          size={15}
                          aria-hidden="true"
                          className={`shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                        {row.isNegative && (
                          <span
                            className="shrink-0 text-red-500"
                            title="Error: Has vendido más de lo que compraste. Revisa tus transacciones."
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          </span>
                        )}
                        <span className="text-xs font-bold text-foreground sm:text-sm">
                          {row.ticker}
                        </span>
                        <CurrencyBadge currency={row.currency} />
                      </button>
                    </td>
                    <td className="py-2 px-0.5 text-right font-semibold tabular-nums whitespace-nowrap text-foreground sm:px-1">
                      $
                      {row.currentValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      className={`py-2 px-0.5 text-right font-semibold tabular-nums whitespace-nowrap sm:px-1 ${
                        row.plDisplay >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {row.plPct > 0 ? '+' : ''}
                      {row.plPct.toLocaleString('en-US', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      %
                    </td>
                    <td className="hidden py-2 px-1 text-right tabular-nums whitespace-nowrap text-foreground sm:table-cell">
                      {row.quantity.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="hidden py-2 px-1 text-right tabular-nums whitespace-nowrap text-foreground sm:table-cell">
                      $
                      {row.displayCost.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="hidden py-2 px-1 text-right tabular-nums whitespace-nowrap text-foreground sm:table-cell">
                      $
                      {row.displayPrice.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 pl-0.5 text-right sm:pl-1">
                      <span className={`text-xs font-semibold tabular-nums sm:text-sm ${pctColorClass}`}>
                        {row.currentPct.toFixed(1)}%
                      </span>
                      {row.targetPct > 0 && (
                        <div
                          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
                          aria-hidden="true"
                        >
                          <div
                            className={`h-full rounded-full ${
                              Math.abs(pctDiff) <= 0.5
                                ? 'bg-emerald-500'
                                : row.currentPct < row.targetPct
                                  ? 'bg-primary'
                                  : 'bg-orange-500'
                            }`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="hidden py-2 px-1 text-right sm:table-cell">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isExpanded) toggleRow(row.ticker);
                          handleStartEdit(row.ticker, row.targetPct);
                        }}
                        className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold tabular-nums text-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                        title="Editar meta"
                      >
                        {row.targetPct > 0 ? (
                          <>
                            {Number(row.targetPct).toLocaleString('en-US', {
                              maximumFractionDigits: 2,
                            })}
                            %
                          </>
                        ) : (
                          <Edit2 size={12} className="inline text-muted-foreground/60" />
                        )}
                      </button>
                      {allocation[row.ticker] !== undefined && (
                        <button
                          onClick={() => handleDelete(row.ticker)}
                          className="ml-1 text-muted-foreground/30 transition-colors hover:text-red-500"
                          title="Eliminar de estrategia"
                          aria-label={`Eliminar meta de ${row.ticker}`}
                        >
                          <Trash2 size={12} className="inline" />
                        </button>
                      )}
                    </td>
                    <td className="hidden py-2 px-1 text-right tabular-nums whitespace-nowrap sm:table-cell">
                      {showProjectedColumn ? (
                        proposal && row.targetPct > 0 ? (
                          <span>
                            <span className="font-semibold">
                              {proposal.projectedPct?.toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground">
                              {' '}
                              / {row.targetPct.toFixed(1)}%
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )
                      ) : row.targetPct > 0 ? (
                        <span
                          className={`font-semibold ${
                            row.targetPct - row.currentPct > 0
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
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="hidden py-2 px-1 text-center sm:table-cell">
                      {action.badge}
                    </td>
                    <td className="hidden py-2 pl-1 text-right tabular-nums whitespace-nowrap sm:table-cell">
                      {action.amount}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr id={`pos-detalle-${row.ticker}-m`} className="sm:hidden">
                      <td
                        colSpan={4}
                        className="border-t border-border/40 bg-muted/30 px-3 py-3"
                      >
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                          <DetailItem label="Cant.">
                            {row.quantity.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </DetailItem>
                          <DetailItem label="Costo">
                            $
                            {row.displayCost.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </DetailItem>
                          <DetailItem label="Precio">
                            $
                            {row.displayPrice.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </DetailItem>
                          <DetailItem label="G/P">
                            <span
                              className={`font-semibold tabular-nums ${
                                row.plDisplay >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-500 dark:text-red-400'
                              }`}
                            >
                              {row.plPct > 0 ? '+' : ''}
                              {row.plPct.toLocaleString('en-US', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}
                              % ({row.plDisplay >= 0 ? '+' : '-'}$
                              {Math.abs(row.plDisplay).toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                              )
                            </span>
                          </DetailItem>
                          <DetailItem label="% Meta">{metaEditor}</DetailItem>
                          {showProjectedColumn ? (
                            <DetailItem label="Después">
                              {proposal && row.targetPct > 0 ? (
                                <span className="whitespace-nowrap">
                                  <span className="font-semibold">
                                    {proposal.projectedPct?.toFixed(1)}%
                                  </span>
                                  <span className="text-muted-foreground">
                                    {' '}
                                    / {row.targetPct.toFixed(1)}%
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </DetailItem>
                          ) : (
                            <DetailItem label="Diferencia">
                              {row.targetPct > 0 ? (
                                <span
                                  className={`font-semibold ${
                                    row.targetPct - row.currentPct > 0
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
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </DetailItem>
                          )}
                          <DetailItem label="Acción">{action.badge}</DetailItem>
                          <DetailItem label="Monto">{action.amount}</DetailItem>
                        </dl>
                      </td>
                    </tr>
                  )}
                  {isExpanded && (
                    <tr id={`pos-detalle-${row.ticker}-d`} className="hidden sm:table-row">
                      <td
                        colSpan={11}
                        className="border-t border-border/40 bg-muted/30 px-3 py-2.5 sm:px-4"
                      >
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              % Meta
                            </span>
                            {metaEditor}
                          </div>
                          <span className="text-xs text-muted-foreground">{action.note}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-auto sm:max-w-xs sm:flex-1">
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

// Celda de detalle reutilizable (etiqueta + valor) dentro de la fila expandida.
function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
        {children}
      </dd>
    </div>
  );
}

// Badge, monto y nota de la acción sugerida de una fila, unificados para
// las columnas Acción/Monto de escritorio y el detalle móvil. La nota es la
// frase que acompaña a la tira de edición en escritorio.
function getRowAction(
  row: {
    ticker: string;
    currentValue: number;
    currentPct: number;
    targetPct: number;
    strategySuggestion?: RebalanceSuggestion;
    depositProposal?: OrderProposal;
    rebalanceProposal?: OrderProposal;
  },
  calcMode: CalcMode,
  total: number,
  exchangeRate: number
): { badge: React.ReactNode; amount: React.ReactNode; note: string } {
  const money = (usd: number) =>
    `$${(usd * exchangeRate).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;
  const buySellBadge = (action: 'BUY' | 'SELL') => (
    <span
      className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
        action === 'BUY'
          ? 'bg-primary/20 text-primary'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      }`}
    >
      {action === 'BUY' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
      {action === 'BUY' ? 'Comprar' : 'Vender'}
    </span>
  );
  const holdBadge = (
    <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded bg-muted px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      <MinusCircle size={10} />
      Mantener
    </span>
  );
  const noTargetBadge = (
    <span className="inline-flex items-center justify-center whitespace-nowrap rounded border border-dashed border-border/80 bg-muted/30 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/45">
      Sin meta
    </span>
  );
  const inRange = (
    <span className="text-[11px] leading-tight text-muted-foreground/60">En rango</span>
  );
  const dash = <span className="text-sm font-medium text-muted-foreground/30">—</span>;

  if (calcMode === 'strategy') {
    if (Math.abs(total - 100) > 0.1 && row.targetPct > 0) {
      return {
        badge: (
          <span className="inline-flex items-center justify-center whitespace-nowrap rounded bg-red-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-red-600 dark:bg-red-900/30 dark:text-red-400">
            AJUSTAR %
          </span>
        ),
        amount: <span className="text-sm italic text-muted-foreground/40">Inválido</span>,
        note: `La asignación suma ${total.toFixed(2)}%, debe ser 100%.`,
      };
    }

    const s = row.strategySuggestion;
    if (s && s.action !== 'HOLD') {
      return {
        badge: buySellBadge(s.action),
        amount: <span>{money(s.amount)}</span>,
        note:
          s.action === 'BUY'
            ? `Comprar ${money(s.amount)} para subir de ${fmtPct(row.currentPct)} a la meta de ${fmtPct(row.targetPct)}.`
            : `Vender ${money(s.amount)} para bajar de ${fmtPct(row.currentPct)} a la meta de ${fmtPct(row.targetPct)}.`,
      };
    }

    if (row.targetPct > 0 && row.currentValue < 0.01) {
      return {
        badge: buySellBadge('BUY'),
        amount: <span>---</span>,
        note: `Sin posición: comprar para llegar a la meta de ${fmtPct(row.targetPct)}.`,
      };
    }

    if (row.targetPct > 0) {
      return {
        badge: holdBadge,
        amount: inRange,
        note: `En rango: actual ${fmtPct(row.currentPct)}, meta ${fmtPct(row.targetPct)}.`,
      };
    }

    return {
      badge: noTargetBadge,
      amount: dash,
      note: 'Sin meta asignada.',
    };
  }

  // Modos Aportar / Rebalancear.
  const proposal = calcMode === 'deposit' ? row.depositProposal : row.rebalanceProposal;
  if (!proposal || (row.targetPct === 0 && (proposal.action === 'HOLD' || proposal.amount < 0.01))) {
    return { badge: noTargetBadge, amount: dash, note: 'Sin meta asignada.' };
  }
  if (proposal.action === 'HOLD' || proposal.amount < 0.01) {
    return {
      badge: holdBadge,
      amount: inRange,
      note: `En rango: después quedaría en ${fmtPct(proposal.projectedPct ?? row.currentPct)}.`,
    };
  }
  return {
    badge: buySellBadge(proposal.action),
    amount: <span>{money(proposal.amount)}</span>,
    note:
      proposal.action === 'BUY'
        ? `Comprar ${money(proposal.amount)}: después quedaría en ${fmtPct(proposal.projectedPct ?? row.currentPct)} (meta ${fmtPct(row.targetPct)}).`
        : `Vender ${money(proposal.amount)}: después quedaría en ${fmtPct(proposal.projectedPct ?? row.currentPct)} (meta ${fmtPct(row.targetPct)}).`,
  };
}
