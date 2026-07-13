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
  totalRealizedPnlMXN: number,
  historyData: any[] = []
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
    // Financial Rigor: Use Net Cash Flow (Total Deposits - Total Withdrawals)
    if (historyData && historyData.length > 0) {
      const lastPoint = historyData[historyData.length - 1];
      return currency === 'MXN' ? lastPoint.investedMXN : lastPoint.investedUSD;
    }
    
    // Fallback to active positions cost basis if no history
    return holdings.reduce((sum, h) => {
      if (currency === 'MXN') {
        return sum + (h.totalInvestedMxn ?? (h.totalInvestedGlobal || 0) * exchangeRate);
      }
      return sum + (h.totalInvestedGlobal || 0);
    }, 0);
  }, [holdings, currency, exchangeRate, historyData]);

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

  // True holistic profit based on Net Cash Flow
  const totalProfit = (historyData && historyData.length > 0)
    ? totalValue - totalInvested
    : realizedPL + unrealizedPL;
    
  // Un-attributed profit (Dividends, FX on cash, Fees)
  const otherPnL = totalProfit - (realizedPL + unrealizedPL);

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

  const { monthlyReturn, ytdReturn } = useMemo(() => {
    let monthlyReturn = 0;
    let ytdReturn = 0;
    
    if (historyData && historyData.length > 1) {
      const today = new Date();
      // Import these directly or assume they are available if we add them to imports
      // Actually we need to ensure date-fns is imported
      const oneMonthAgoDate = new Date();
      oneMonthAgoDate.setMonth(today.getMonth() - 1);
      
      const ytdDate = new Date(today.getFullYear(), 0, 1); // Jan 1st

      // Simple YYYY-MM-DD formatter since we can't easily add imports here without replacing the whole file header
      const formatYMD = (d: Date) => d.toISOString().split('T')[0];

      const oneMonthStr = formatYMD(oneMonthAgoDate);
      let monthAgoPoint = historyData.find((d: any) => d.date >= oneMonthStr);
      if (!monthAgoPoint) monthAgoPoint = historyData[0];

      const ytdStr = formatYMD(ytdDate);
      let ytdPoint = historyData.find((d: any) => d.date >= ytdStr);
      if (!ytdPoint) ytdPoint = historyData[0];

      const currentProfit = totalValue - totalInvested;
      
      const monthAgoValue = currency === 'USD' ? monthAgoPoint.valueUSD : monthAgoPoint.valueMXN;
      const monthAgoInvested = currency === 'USD' ? monthAgoPoint.investedUSD : monthAgoPoint.investedMXN;
      
      if (monthAgoInvested > 0) {
        const monthAgoProfit = monthAgoValue - monthAgoInvested;
        const profitGeneratedThisMonth = currentProfit - monthAgoProfit;
        monthlyReturn = totalInvested > 0 ? (profitGeneratedThisMonth / totalInvested) * 100 : 0;
      }
      
      const ytdValue = currency === 'USD' ? ytdPoint.valueUSD : ytdPoint.valueMXN;
      const ytdInvested = currency === 'USD' ? ytdPoint.investedUSD : ytdPoint.investedMXN;
      
      if (ytdInvested > 0) {
        const ytdProfit = ytdValue - ytdInvested;
        const profitGeneratedYTD = currentProfit - ytdProfit;
        ytdReturn = totalInvested > 0 ? (profitGeneratedYTD / totalInvested) * 100 : 0;
      }
    }
    
    return { monthlyReturn, ytdReturn };
  }, [historyData, currency, totalValue, totalInvested]);

  return {
    exchangeRate,
    totalValue,
    totalInvested,
    realizedPL,
    unrealizedPL,
    totalProfit,
    percentage,
    consolidatedAssetsForChart,
    preCalculatedHoldingsUSD,
    otherPnL,
    monthlyReturn,
    ytdReturn
  };
}
