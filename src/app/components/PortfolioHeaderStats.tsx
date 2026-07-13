

interface PortfolioHeaderStatsProps {
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  realizedPL: number;
  unrealizedPL: number;
  percentage: number;
  currency: 'USD' | 'MXN';
  showValues: boolean;
}

export default function PortfolioHeaderStats({
  totalValue,
  totalInvested,
  totalProfit,
  realizedPL,
  unrealizedPL,
  percentage,
  currency,
  showValues
}: PortfolioHeaderStatsProps) {

  const isProfitable = totalProfit >= 0;
  const profitColor = isProfitable
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  const formatTotalValue = (val: number) => {
    if (!showValues) return '****';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(val);
  };

  const formatCurrencyValue = (val: number) => {
    if (!showValues) return '****';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      signDisplay: 'always',
    }).format(val);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-start gap-0.5 sm:gap-3 sm:gap-x-8 text-sm w-full">
      <div className="flex justify-between sm:justify-start items-baseline gap-2 w-full sm:w-auto whitespace-nowrap">
        <span className="text-base text-muted-foreground font-medium">
          Valor:
        </span>
        <span className="text-lg font-bold text-foreground">
          {formatTotalValue(totalValue)}
        </span>
      </div>

      <div className="flex justify-between sm:justify-start items-baseline gap-2 w-full sm:w-auto whitespace-nowrap">
        <span className="text-base text-muted-foreground font-medium">
          Invertido:
        </span>
        <span className="text-lg font-bold text-foreground">
          {formatTotalValue(totalInvested)}
        </span>
      </div>

      <div className="flex justify-between sm:justify-start items-baseline gap-2 w-full sm:w-auto whitespace-nowrap">
        <span className="text-base text-muted-foreground font-medium">
          Ganancia:
        </span>
        <div className="relative group cursor-help flex items-baseline gap-1.5">
          <div className="flex items-baseline gap-1.5 border-b border-dotted border-border pb-0.5">
            <span className={`text-lg font-bold ${profitColor}`}>
              {formatCurrencyValue(totalProfit)}
            </span>
            <span className={`text-sm font-bold ${profitColor}`}>
              ({showValues ? `${percentage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '***'})
            </span>
          </div>

          <div className="absolute top-full right-0 md:left-1/2 md:-translate-x-1/2 md:right-auto mt-2 w-56 rounded-xl bg-card p-4 shadow-xl ring-1 ring-border text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0 text-foreground whitespace-normal text-left">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Latente (Actual):</span>
              <span
                className={`font-mono ${unrealizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {formatCurrencyValue(unrealizedPL)}
              </span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-medium">
                Realizada (Histórico):
              </span>
              <span
                className={`font-mono ${realizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {formatCurrencyValue(realizedPL)}
              </span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between items-center font-bold text-foreground">
              <span>Total Neto:</span>
              <span className={`font-mono text-sm ${profitColor}`}>
                {formatCurrencyValue(totalProfit)}
              </span>
            </div>
            <div className="absolute bottom-full right-8 md:right-1/2 md:translate-x-1/2 border-8 border-transparent border-b-white dark:border-b-card"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
