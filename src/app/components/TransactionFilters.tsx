'use client';

/**
 * Transaction Filters Component
 * 
 * Provides inputs and dropdowns to filter the transactions list by ticker and type.
 * Updates the URL search parameters to trigger server-side re-fetching.
 */

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function TransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialTicker = searchParams.get('ticker')?.toString() || '';
  const [tickerValue, setTickerValue] = useState(initialTicker);

  /**
   * Applies the current filters by updating the URL query parameters.
   */
  const applyFilters = (ticker: string) => {
    const params = new URLSearchParams(searchParams);
    if (ticker.trim()) {
      params.set('ticker', ticker.trim());
    } else {
      params.delete('ticker');
    }
    params.set('page', '1');

    startTransition(() => {
      router.replace(`?${params.toString()}`);
    });
  };

  const handleSearchClick = () => {
    applyFilters(tickerValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyFilters(tickerValue);
    }
  };

  const handleTypeChange = (type: string) => {
    const params = new URLSearchParams(searchParams);
    if (type && type !== 'ALL') {
      params.set('type', type);
    } else {
      params.delete('type');
    }
    params.set('page', '1');

    startTransition(() => {
      router.replace(`?${params.toString()}`);
    });
  };

  const clearFilters = () => {
    setTickerValue('');
    router.replace('?');
  };

  const hasFilters = searchParams.has('ticker') || searchParams.has('type');

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={tickerValue}
            onChange={(e) => setTickerValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar ticker (ej: AAPL)..."
            className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>
        <button
          onClick={handleSearchClick}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          {isPending ? '...' : 'Buscar'}
        </button>
      </div>

      <select
        onChange={(e) => handleTypeChange(e.target.value)}
        value={searchParams.get('type')?.toString() || 'ALL'}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <option value="ALL">Todos los tipos</option>
        <option value="BUY">Compras</option>
        <option value="SELL">Ventas</option>
      </select>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 bg-transparent border-none cursor-pointer px-2"
        >
          <X size={14} />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
