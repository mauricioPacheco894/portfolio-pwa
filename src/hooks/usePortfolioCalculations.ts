import { useMemo } from 'react';
import { AssetPosition } from '@/types/portfolio';
import { Database } from '@/types/supabase';
import { normalizeTicker } from '@/utils/tickerMapping';

type Portfolio = Database['public']['Tables']['portfolios']['Row'];

export function usePortfolioCalculations(
  holdings: AssetPosition[],
  portfolio: Portfolio,
  currency: 'USD' | 'MXN',
  usdMxnRate: number,
  totalRealizedPnlUSD: number,
  totalRealizedPnlMXN: number
) {
  const exchangeRate = currency === 'USD' ? 1 : usdMxnRate;

  // Calculate totals in selected currency
  const totalValue = useMemo(() => {
    return holdings.reduce(
      (sum, h) => sum + (h.marketValueGlobal || 0) * exchangeRate,
      0
    );
  }, [holdings, exchangeRate]);

  const totalInvested = useMemo(() => {
    return holdings.reduce((sum, h) => {
      if (currency === 'MXN') {
        // Use FX-adjusted historic cost basis for MXN display
        return sum + (h.totalInvestedMxn ?? (h.totalInvestedGlobal || 0) * exchangeRate);
      }
      return sum + (h.totalInvestedGlobal || 0);
    }, 0);
  }, [holdings, currency, exchangeRate]);

  const realizedPL = currency === 'MXN' ? totalRealizedPnlMXN : totalRealizedPnlUSD;
  
  const unrealizedPL = useMemo(() => {
    return holdings.reduce((sum, h) => {
      if (currency === 'MXN') {
        const valueMxn = (h.marketValueGlobal || 0) * exchangeRate;
        const costMxn = h.totalInvestedMxn ?? (h.totalInvestedGlobal || 0) * exchangeRate;
        return sum + (valueMxn - costMxn);
      }
      return sum + (h.plDollarsGlobal || 0);
    }, 0);
  }, [holdings, currency, exchangeRate]);

  const totalProfit = realizedPL + unrealizedPL;
  const percentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Consolidate holdings by normalized ticker for charts (USD base)
  const consolidatedAssetsForChart = useMemo(() => {
    const consolidatedMapUSD: Record<string, number> = {};
    const targetKeys = portfolio.target_allocation
      ? Object.keys(portfolio.target_allocation)
      : [];

    holdings.forEach((h) => {
      const normTicker = normalizeTicker(h.ticker, targetKeys);
      const valUSD =
        h.marketValueGlobal ||
        (h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue);
      consolidatedMapUSD[normTicker] = (consolidatedMapUSD[normTicker] || 0) + valUSD;
    });

    return Object.entries(consolidatedMapUSD)
      .map(([ticker, valUSD]) => ({
        ticker,
        currentValue: valUSD * exchangeRate,
      }))
      .filter((asset) => asset.currentValue > 0.1)
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [holdings, portfolio.target_allocation, exchangeRate]);

  const preCalculatedHoldingsUSD = useMemo(() => {
    const consolidatedMapUSD: Record<string, number> = {};
    const targetKeys = portfolio.target_allocation
      ? Object.keys(portfolio.target_allocation)
      : [];

    holdings.forEach((h) => {
      const normTicker = normalizeTicker(h.ticker, targetKeys);
      const valUSD =
        h.marketValueGlobal ||
        (h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue);
      consolidatedMapUSD[normTicker] = (consolidatedMapUSD[normTicker] || 0) + valUSD;
    });
    return consolidatedMapUSD;
  }, [holdings, portfolio.target_allocation, exchangeRate]);


  return {
    exchangeRate,
    totalValue,
    totalInvested,
    realizedPL,
    unrealizedPL,
    totalProfit,
    percentage,
    consolidatedAssetsForChart,
    preCalculatedHoldingsUSD
  };
}
