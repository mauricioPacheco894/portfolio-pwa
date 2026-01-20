// Re-export types from shared file
export type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';

import type { AssetPosition, RebalanceSuggestion } from '@/types/portfolio';
import { normalizeTicker } from './tickerMapping';

// Calcula sugerencias de rebalanceo basado en la asignación objetivo
export function calculateRebalancing(
  holdings: AssetPosition[],
  targetAllocation: Record<string, number>,
  totalPortfolioValue: number,
  currentPrices: Record<string, number>
): RebalanceSuggestion[] {
  if (!targetAllocation || totalPortfolioValue === 0) return [];

  const suggestions: RebalanceSuggestion[] = [];

  // 1. Consolidar holdings actuales por ticker normalizado
  // Mapa: TickerNormalizado -> ValorTotalEnUSD (marketValueGlobal)
  const consolidatedValues: Record<string, number> = {};

  // Extraemos las claves de los targets para ayudar a la inferencia (Inyección de dependencia)
  const targetKeys = Object.keys(targetAllocation);

  holdings.forEach((h) => {
    // Aquí pasamos los targets conocidos para que normalizeTicker sepa que VUAAN -> VUAA
    const normTicker = normalizeTicker(h.ticker, targetKeys);

    // Usamos marketValueGlobal para sumar peras con peras (todo en USD)
    const val = h.marketValueGlobal || h.currentValue;
    consolidatedValues[normTicker] =
      (consolidatedValues[normTicker] || 0) + val;
  });

  Object.entries(targetAllocation).forEach(([targetTicker, targetPct]) => {
    // Normalizamos target también para consistencia
    const normTarget = normalizeTicker(targetTicker, targetKeys);

    // El valor actual es la suma de todas las variantes (NU + NUN + NUN.MX...)
    const currentVal = consolidatedValues[normTarget] || 0;

    // Precio para calcular "cantidad de acciones":
    // Intentamos obtener el precio del ticker objetivo específico, o del normalizado
    // Ojo: Esto es una estimación. Si el usuario compra NUN (pesos) vs NU (dólares), el *número* de acciones diferirá por el tipo de cambio.
    // Aquí usamos el precio del targetTicker original si existe en currentPrices, sino una media.
    const price = currentPrices[targetTicker] || currentPrices[normTarget] || 0;

    const currentPct = (currentVal / totalPortfolioValue) * 100;
    const targetVal = totalPortfolioValue * (targetPct / 100);
    const diffVal = targetVal - currentVal;

    // LÓGICA DE BANDAS DINÁMICAS GENERALIZADA
    // Determinar Acción: BUY, SELL o HOLD
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Tolerancia dinámica basada en el tamaño de la posición (evita hardcodear 7.5% o 5%)
    // - Posiciones pequeñas (<= 6%): Tolerancia más ajustada (+2.5%)
    // - Posiciones grandes (> 6%): Tolerancia estándar (+3.0%)
    const tolerance = targetPct <= 6.0 ? 2.5 : 3.0;

    // Umbral de venta
    const sellThreshold = targetPct + tolerance;

    if (currentPct >= sellThreshold) {
      action = 'SELL';
    }
    // Compra (Underweight)
    else if (currentPct < targetPct) {
      action = 'BUY';
    }
    // Mantener (Dentro de banda de tolerancia)
    else {
      action = 'HOLD';
    }

    // Solo generamos sugerencia si la acción NO es HOLD y el monto vale la pena (> $10)
    if (action !== 'HOLD' && Math.abs(diffVal) > 10) {
      suggestions.push({
        ticker: targetTicker,
        currentPct,
        targetPct,
        action: action as 'BUY' | 'SELL', // Cast for now, as types/portfolio only has BUY/SELL usually
        amount: Math.abs(diffVal),
        quantity: price > 0 ? Math.abs(diffVal) / price : 0,
      });
    }
  });

  return suggestions.sort((a, b) => b.amount - a.amount);
}
