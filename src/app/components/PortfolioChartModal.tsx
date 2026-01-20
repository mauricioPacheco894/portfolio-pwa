'use client';

/**
 * Portfolio Chart Modal
 * 
 * A modal dialog that displays side-by-side distribution charts:
 * - Current Holdings: Actual distribution of assets.
 * - Target Allocation: Ideal distribution based on user strategy.
 * 
 * Helps users visually identify allocation gaps.
 */

import { PieChart, X } from 'lucide-react';
import { useState } from 'react';

import IntegratedChart from './IntegratedChart';

interface AssetPosition {
  ticker: string;
  currentValue: number;
}

interface Props {
  holdings: AssetPosition[];
  targetAllocation?: Record<string, number>;
  totalValue?: number;
}

export default function PortfolioChartModal({
  holdings,
  targetAllocation,
  totalValue = 0,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const targetHoldings: AssetPosition[] = targetAllocation
    ? Object.entries(targetAllocation).map(([ticker, pct]) => ({
      ticker,
      currentValue: totalValue * (pct / 100),
    }))
      .filter((h) => h.currentValue > 0)
      .sort((a, b) => b.currentValue - a.currentValue)
    : [];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <PieChart className="h-4 w-4" />
        <span className="hidden sm:inline">Ver Gráfica</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className={`w-full ${targetHoldings.length > 0 ? 'max-w-6xl' : 'max-w-4xl'
              } rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                Distribución del Portafolio
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <div className={`grid gap-8 ${targetHoldings.length > 0 ? 'lg:grid-cols-2' : ''} h-full`}>
                <div className="flex flex-col h-[400px] lg:h-[500px]">
                  <h4 className="text-center text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
                    Actual
                  </h4>
                  <div className="flex-1 min-h-0 bg-zinc-50/50 dark:bg-zinc-800/20 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700/50 p-2">
                    <IntegratedChart holdings={holdings} />
                  </div>
                </div>

                {targetHoldings.length > 0 && (
                  <div className="flex flex-col h-[400px] lg:h-[500px]">
                    <h4 className="text-center text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
                      Meta (Estrategia)
                    </h4>
                    <div className="flex-1 min-h-0 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl border border-dashed border-blue-200 dark:border-blue-800/30 p-2">
                      <IntegratedChart holdings={targetHoldings} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
