import { useMemo } from 'react';

import { AssetPosition, ConsolidatedPosition, RebalanceSuggestion } from '@/types/portfolio';
import { Database } from '@/types/supabase';
import {
  calculateClassicRebalance,
  calculateRebalancing,
  calculateSmartDeposit,
  type OrderProposal,
  prepareRebalanceItems,
  type RebalanceItem,
} from '@/utils/portfolioMath';
import { normalizeTicker } from '@/utils/tickerMapping';
import { calculateTimeWeightedReturn, HistoryDataPoint } from '@/utils/timeWeightedReturn';

type Portfolio = Database['public']['Tables']['portfolios']['Row'];

export function usePortfolioCalculations(
  holdings: AssetPosition[],
  portfolio: Portfolio,
  currency: 'USD' | 'MXN',
  usdMxnRate: number,
  totalRealizedPnlUSD: number,
  totalRealizedPnlMXN: number,
  historyData: HistoryDataPoint[] = [],
  depositAmount: string = '0'
) {
  const exchangeRate = currency === 'USD' ? 1 : usdMxnRate;

  // Única consolidación por ticker normalizado (una sola pasada): mapa de
  // valor en USD, posiciones consolidadas con cantidad/costo/precio/G-P y
  // precios derivados por ticker crudo. Todo lo demás (gráfica, totales,
  // sugerencias) se deriva de aquí, no se vuelve a consolidar.
  const consolidated = useMemo(() => {
    const targetKeys = portfolio.target_allocation
      ? Object.keys(portfolio.target_allocation)
      : [];
    const mapUSD: Record<string, number> = {};
    const positionsByTicker = new Map<string, ConsolidatedPosition>();
    const dominantCurrency = new Map<
      string,
      { value: number; currency: 'USD' | 'MXN' }
    >();
    const derivedPrices: Record<string, number> = {};

    holdings.forEach((h) => {
      const normTicker = normalizeTicker(h.ticker, targetKeys);
      const valUSD =
        h.marketValueGlobal ||
        (h.currency === 'MXN' ? h.currentValue / exchangeRate : h.currentValue);
      mapUSD[normTicker] = (mapUSD[normTicker] || 0) + valUSD;

      const investedUSD = h.totalInvestedGlobal || 0;
      const plUSD = h.plDollarsGlobal || 0;
      const existing = positionsByTicker.get(normTicker);
      if (existing) {
        existing.quantity += h.totalQuantity;
        existing.marketValueUSD += valUSD;
        existing.totalInvestedUSD += investedUSD;
        existing.plUSD += plUSD;
      } else {
        positionsByTicker.set(normTicker, {
          ticker: normTicker,
          quantity: h.totalQuantity,
          marketValueUSD: valUSD,
          totalInvestedUSD: investedUSD,
          plUSD,
          isNegative: false,
          currency: h.currency ?? 'USD',
        });
      }

      const dominant = dominantCurrency.get(normTicker);
      if (!dominant || valUSD > dominant.value) {
        dominantCurrency.set(normTicker, {
          value: valUSD,
          currency: h.currency ?? 'USD',
        });
      }

      // Precio derivado por ticker crudo, como lo hacía la tabla de gestión
      // (para calculateRebalancing, que busca por ticker meta o normalizado).
      if (h.totalQuantity > 0) {
        derivedPrices[h.ticker] =
          h.marketPrice ?? h.currentValue / h.totalQuantity;
      }
    });

    const positions = Array.from(positionsByTicker.values());
    positions.forEach((p) => {
      p.isNegative = p.quantity < 0;
      p.currency = dominantCurrency.get(p.ticker)?.currency ?? 'USD';
    });

    return { mapUSD, positions, derivedPrices };
  }, [holdings, portfolio.target_allocation, exchangeRate]);

  const consolidatedPositions = consolidated.positions;

  // Gráfica: se deriva del mismo mapa, no se vuelve a consolidar.
  const consolidatedAssetsForChart = useMemo(() => {
    return Object.entries(consolidated.mapUSD)
      .map(([ticker, valUSD]) => ({
        ticker,
        currentValue: valUSD * exchangeRate,
      }))
      .filter((asset) => asset.currentValue > 0.1)
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [consolidated, exchangeRate]);

  // Total único en USD (base de la consolidación). El total del header y el
  // denominador de los % de la tabla salen de este mismo valor.
  const totalValueUSD = useMemo(
    () => Object.values(consolidated.mapUSD).reduce((a, b) => a + b, 0),
    [consolidated]
  );

  // Total en la moneda seleccionada (mismo total único, convertido).
  const totalValue = totalValueUSD * exchangeRate;

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

  // Sugerencias calculadas una sola vez a partir de la meta GUARDADA
  // (portfolio.target_allocation). Antes el servidor y la tabla de gestión
  // las calculaban por separado con metas distintas (guardada vs editada sin
  // guardar) y el cálculo del servidor se descartaba. Ahora hay una sola
  // versión: si el usuario edita una meta sin guardar, las sugerencias
  // siguen reflejando la meta guardada y se actualizan al guardar
  // (router.refresh tras persistir la estrategia).
  const strategySuggestions: RebalanceSuggestion[] = useMemo(
    () =>
      calculateRebalancing(
        holdings,
        portfolio.target_allocation || {},
        totalValueUSD,
        consolidated.derivedPrices
      ),
    [holdings, portfolio.target_allocation, totalValueUSD, consolidated]
  );

  const rebalanceItems: RebalanceItem[] = useMemo(
    () =>
      prepareRebalanceItems(
        consolidated.mapUSD,
        portfolio.target_allocation || {},
        totalValueUSD
      ),
    [consolidated, portfolio.target_allocation, totalValueUSD]
  );

  const depositProposals: OrderProposal[] = useMemo(() => {
    const amount = parseFloat(depositAmount) || 0;
    return calculateSmartDeposit(rebalanceItems, amount / exchangeRate);
  }, [rebalanceItems, depositAmount, exchangeRate]);

  const rebalanceProposals: OrderProposal[] = useMemo(
    () => calculateClassicRebalance(rebalanceItems),
    [rebalanceItems]
  );

  // Month and YTD returns, time-weighted from the history series. The base
  // point is the last history point on or before the target date (never the
  // first point after it: with gaps in the history that would silently
  // measure a shorter, arbitrary period). Daily returns net out each day's
  // cash flow, so deposits and withdrawals do not inflate the return, and
  // the denominator is each day's starting value rather than the current
  // invested amount.
  const { monthlyReturn, ytdReturn } = useMemo(() => {
    if (!historyData || historyData.length < 2) {
      return { monthlyReturn: 0, ytdReturn: 0 };
    }

    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    const ytdDate = new Date(today.getFullYear(), 0, 1); // Jan 1st

    return {
      monthlyReturn:
        calculateTimeWeightedReturn(historyData, formatYMD(oneMonthAgo), currency) * 100,
      ytdReturn:
        calculateTimeWeightedReturn(historyData, formatYMD(ytdDate), currency) * 100,
    };
  }, [historyData, currency]);

  return {
    exchangeRate,
    totalValue,
    totalValueUSD,
    totalInvested,
    realizedPL,
    unrealizedPL,
    totalProfit,
    percentage,
    consolidatedAssetsForChart,
    consolidatedPositions,
    strategySuggestions,
    rebalanceItems,
    depositProposals,
    rebalanceProposals,
    otherPnL,
    monthlyReturn,
    ytdReturn
  };
}
