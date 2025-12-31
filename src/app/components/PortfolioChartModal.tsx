'use client';

import { PieChart, X } from 'lucide-react';
import { useState } from 'react';

import IntegratedChart from './IntegratedChart';

interface AssetPosition {
  ticker: string;
  currentValue: number;
}

interface Props {
  holdings: AssetPosition[];
}

export default function PortfolioChartModal({ holdings }: Props) {
  const [isOpen, setIsOpen] = useState(false);

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
            className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
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

            <div className="h-[500px] w-full">
              <IntegratedChart holdings={holdings} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
