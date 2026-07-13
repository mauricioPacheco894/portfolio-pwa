import React from 'react';

interface CurrencyBadgeProps {
  currency?: 'USD' | 'MXN' | string;
}

export const CurrencyBadge: React.FC<CurrencyBadgeProps> = ({ currency }) => {
  if (!currency) return null;
  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors inline-flex items-center ${currency === 'MXN'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/50'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/50'
        }`}
    >
      {currency}
    </span>
  );
};
