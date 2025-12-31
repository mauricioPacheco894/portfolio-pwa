'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AssetPosition } from '@/types/portfolio';

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
    key: 'currentValue', // Por defecto ordenamos por Valor total
    direction: 'desc', // De mayor a menor
  });

  const currencyFormatter = (
    value: number,
    currency: 'USD' | 'MXN' = 'USD'
  ) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const currencyFormatterWithSign = (
    value: number,
    currency: 'USD' | 'MXN' = 'USD'
  ) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      signDisplay: 'always',
    }).format(value);
  };

  const CurrencyBadge = ({ currency }: { currency?: 'USD' | 'MXN' }) => (
    <span
      className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        currency === 'MXN'
          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      }`}
    >
      {currency || 'USD'}
    </span>
  );

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
        <ArrowUpDown className="ml-1 h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-50 transition-opacity" />
      );
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 text-blue-500" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-blue-500" />
    );
  };

  const HeaderCell = ({
    columnKey,
    label,
    align = 'right',
  }: {
    columnKey: SortKey;
    label: string;
    align?: 'left' | 'right';
  }) => (
    <th
      className={`cursor-pointer px-4 py-3 bg-zinc-50 dark:bg-zinc-900 font-semibold text-zinc-900 dark:text-zinc-200 select-none group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
        align === 'left' ? 'text-left' : 'text-right'
      }`}
      onClick={() => handleSort(columnKey)}
    >
      <div
        className={`flex items-center ${
          align === 'left' ? 'justify-start' : 'justify-end'
        }`}
      >
        {label}
        <SortIcon columnKey={columnKey} />
      </div>
    </th>
  );

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="overflow-auto max-h-[500px] scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-600">
        <table className="w-full text-left text-sm relative">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-xs uppercase text-zinc-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <HeaderCell columnKey="ticker" label="Activo" align="left" />
              <HeaderCell columnKey="totalQuantity" label="Cantidad" />
              <HeaderCell columnKey="averageCost" label="Costo Prom." />
              <HeaderCell columnKey="marketPrice" label="Precio Actual" />
              <HeaderCell columnKey="currentValue" label="Valor Mercado" />
              <HeaderCell columnKey="plDollars" label="Ganancia / Pérdida" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {sortedHoldings.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400"
                >
                  Agrega transacciones para ver tus posiciones.
                </td>
              </tr>
            ) : (
              sortedHoldings.map((asset) => (
                <tr
                  key={asset.ticker}
                  className={`transition-colors ${
                    asset.isNegative
                      ? 'bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <td className="px-4 py-2 font-bold text-zinc-900 dark:text-white text-left">
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
                      {asset.ticker}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {asset.totalQuantity.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {currencyFormatter(asset.averageCost, asset.currency)}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center justify-end gap-1">
                      {asset.marketPrice
                        ? currencyFormatter(asset.marketPrice, asset.currency)
                        : currencyFormatter(
                            asset.currentValue / asset.totalQuantity,
                            asset.currency
                          )}

                      <CurrencyBadge currency={asset.currency} />

                      {asset.marketPrice && (
                        <span
                          className="text-[10px] font-bold text-blue-500 ml-0.5"
                          title="Precio en tiempo real"
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                    {currencyFormatter(asset.currentValue, asset.currency)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div
                      className={`flex items-center justify-end gap-1.5 font-semibold ${
                        asset.plDollars >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      <span className="text-sm">
                        {asset.plPercentage > 0 ? '+' : ''}
                        {asset.plPercentage.toFixed(2)}%
                      </span>
                      <span className="text-xs opacity-80 font-normal">
                        (
                        {currencyFormatterWithSign(
                          asset.plDollars,
                          asset.currency
                        )}
                        )
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
