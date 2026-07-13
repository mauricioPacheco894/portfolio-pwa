'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TransactionActions from './TransactionActions';
import { AssetPosition } from '@/types/portfolio';
import { Database } from '@/types/supabase';
import { CurrencyBadge } from './ui/CurrencyBadge';

type Transaction = Database['public']['Tables']['transactions']['Row'];

interface TransactionsTableProps {
  transactions: Transaction[];
  portfolioId: string;
  usdMxnRate: number;
  holdings: AssetPosition[];
}

export default function TransactionsTable({
  transactions,
  portfolioId,
  usdMxnRate,
  holdings,
}: TransactionsTableProps) {
  const [expandedTxRows, setExpandedTxRows] = useState<Set<string>>(new Set());

  const toggleTxRow = (id: string) => {
    setExpandedTxRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
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
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right md:text-left text-muted-foreground`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Fecha</span>
                  <span>{dateStr}</span>
                </td>
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
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Cantidad</span>
                  <span>{qty.toLocaleString('en-US')}</span>
                </td>
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Precio Unit.</span>
                  <span>${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </td>
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">Comisión</span>
                  <span>${fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </td>
                <td className={`${isExpanded ? 'flex' : 'hidden'} justify-between items-center md:table-cell px-0 md:px-3 py-1.5 md:py-1.5 text-right font-mono text-foreground/80`}>
                  <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase">T. Cambio</span>
                  {t.fx_rate !== 1 ? (
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">{Number(t.fx_rate).toFixed(2)}</span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="hidden md:table-cell px-3 py-1.5 font-semibold text-right text-foreground">
                  ${totalStr}
                </td>
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
  );
}
