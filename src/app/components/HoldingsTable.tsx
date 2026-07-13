'use client';

/**
 * Holdings Table Component
 * 
 * Displays a sortable list of asset positions in the portfolio.
 * Features include:
 * - Real-time "LIVE" pricing badges
 * - Sortable columns (Ticker, Quantity, Cost, Price, Value, P&L)
 * - Visual warning for negative positions (oversold)
 * - Automatic currency formatting (USD/MXN)
 */

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AssetPosition } from '@/types/portfolio';
import { currencyFormatter, currencyFormatterWithSign } from '@/utils/formatters';

import { CurrencyBadge } from './ui/CurrencyBadge';

type SortKey = keyof AssetPosition;
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface HoldingsTableProps {
  holdings: AssetPosition[];
}

export default function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'currentValue',
    direction: 'desc',
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (ticker: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };



  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings];
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || bValue === undefined) return 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [holdings, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary" />
    );
  };

  const HeaderCell = ({
    columnKey,
    label,
    align = 'right',
    className = '',
  }: {
    columnKey: SortKey;
    label: string;
    align?: 'left' | 'right';
    className?: string;
  }) => (
    <th
      className={`cursor-pointer px-3 sm:px-4 py-2 bg-muted font-semibold text-foreground select-none group hover:bg-muted/80 transition-colors ${align === 'left' ? 'text-left' : 'text-right'
        } ${className}`}
      onClick={() => handleSort(columnKey)}
    >
      <div
        className={`flex items-center ${align === 'left' ? 'justify-start' : 'justify-end'
          }`}
      >
        {label}
        <SortIcon columnKey={columnKey} />
      </div>
    </th>
  );

  return (
    <div className="overflow-auto max-h-[524px] scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-600">
      <table className="w-full text-left text-sm relative block md:table">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground shadow-sm hidden md:table-header-group">
          <tr className="md:table-row">
            <HeaderCell columnKey="ticker" label="Activo" align="left" />
            <HeaderCell columnKey="totalQuantity" label="Cant." align="right" />
            <HeaderCell columnKey="averageCost" label="Costo" align="right" />
            <HeaderCell columnKey="marketPrice" label="Precio" align="right" />
            <HeaderCell columnKey="currentValue" label="Valor" align="right" />
            <HeaderCell columnKey="plPercentage" label="G/P" align="right" />
          </tr>
        </thead>
        <tbody className="block md:table-row-group divide-y-0 md:divide-y divide-border p-2 md:p-0">
          {sortedHoldings.length === 0 ? (
            <tr className="block md:table-row">
              <td
                colSpan={6}
                className="px-3 py-4 text-center text-muted-foreground block md:table-cell"
              >
                Agrega transacciones para ver tus posiciones.
              </td>
            </tr>
          ) : (
            sortedHoldings.map((asset) => {
              const isExpanded = expandedRows.has(asset.ticker);
              return (
              <tr
                key={asset.ticker}
                className={`transition-colors block md:table-row mb-2 md:mb-0 rounded-xl md:rounded-none border border-border md:border-0 p-3 md:p-0 shadow-sm md:shadow-none ${asset.isNegative
                  ? 'bg-red-500/5 hover:bg-red-500/10'
                  : 'bg-card md:bg-transparent hover:bg-muted'
                  }`}
              >
                <td 
                  className={`flex justify-between items-center md:table-cell px-0 md:px-4 py-1.5 md:py-1.5 font-bold text-foreground text-left cursor-pointer md:cursor-auto ${isExpanded ? 'border-b border-border/40 pb-2 mb-2 md:border-0 md:pb-1.5 md:mb-0' : ''}`}
                  onClick={() => toggleRow(asset.ticker)}
                >
                  <div className="flex items-center gap-2">
                    <span className="md:hidden flex items-center text-muted-foreground">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                    <div className="flex items-center gap-2">
                      {asset.isNegative && (
                        <div
                          className="text-red-500"
                          title="Error: Has vendido más de lo que compraste. Revisa tus transacciones."
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </div>
                      )}
                      <span className="text-base md:text-sm">{asset.ticker}</span>
                      <CurrencyBadge currency={asset.currency} />
                    </div>
                  </div>
                  
                  <div className="md:hidden text-right font-semibold tabular-nums text-base">
                    {currencyFormatter(asset.currentValue)}
                  </div>
                </td>
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-4 py-1.5 md:py-1.5 text-right text-muted-foreground tabular-nums`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Cant.</span>
                  <span>{asset.totalQuantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </td>
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-4 py-1.5 md:py-1.5 text-right text-muted-foreground tabular-nums`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Costo</span>
                  <span>{currencyFormatter(asset.averageCost)}</span>
                </td>
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-4 py-1.5 md:py-1.5 text-right text-muted-foreground tabular-nums`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Precio</span>
                  <div className="flex items-center justify-end gap-1">
                    {asset.marketPrice
                      ? currencyFormatter(asset.marketPrice)
                      : currencyFormatter(
                        asset.currentValue / asset.totalQuantity
                      )}

                    {asset.marketPrice && (
                      <span className="relative flex h-2 w-2 ml-1.5" title="Precio en tiempo real">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden md:table-cell px-4 py-1.5 text-right font-semibold text-foreground tabular-nums">
                  <span>{currencyFormatter(asset.currentValue)}</span>
                </td>
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-1.5 text-right border-t md:border-0 border-border/40 pt-3 md:pt-1.5 mt-3 md:mt-0`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">G/P</span>
                  <div
                    className={`flex items-center justify-end gap-1.5 font-semibold tabular-nums whitespace-nowrap ${asset.plDollars >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                      }`}
                  >
                    <span className="text-sm">
                      {asset.plPercentage > 0 ? '+' : ''}
                      {asset.plPercentage.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </span>
                    <span className="text-[11px] opacity-70 font-normal">
                      ({currencyFormatterWithSign(asset.plDollars)})
                    </span>
                  </div>
                </td>
              </tr>
            );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
