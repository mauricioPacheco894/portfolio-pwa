// Mapa de equivalencias manuales: Ticker Local -> Ticker Maestro
// Úsalo solo para casos excepcionales que no sigan la lógica estándar (ej. IVVPESO -> IVV)
export const TICKER_ALIASES: Record<string, string> = {
  IVVPESO: 'IVV',
};

/**
 * Normaliza un ticker a su versión "Base" o "Maestra".
 * @param ticker El ticker sucio o local
 * @param knownTargets (Opcional) Lista de tickers "correctos" que el usuario tiene en su target. Ayuda a inferir.
 */
export function normalizeTicker(
  ticker: string,
  knownTargets: string[] = []
): string {
  let clean = ticker.toUpperCase();

  // 1. Quitar Exchange Suffix primero para dejar el symbol "puro"
  // (.MX, :BMV, etc)
  if (clean.includes(':')) {
    clean = clean.split(':')[0];
  }
  if (clean.endsWith('.MX')) {
    clean = clean.replace('.MX', '');
  }

  // 2. Revisar alias directos conocidos (hardcoded)
  if (TICKER_ALIASES[clean]) {
    return TICKER_ALIASES[clean];
  }

  // 3. Revisar si ya coincide exactamente con un target conocido
  if (knownTargets.includes(clean)) {
    return clean;
  }

  // 4. Lógica de Inferencia SIC (Sufijo 'N')
  // Si el ticker termina en "N" y quitándosela coincide con un target conocido, asumimos que es el mismo.
  // Ej: VUAAN -> VUAA, AMZNN -> AMZN
  if (clean.endsWith('N')) {
    const withoutN = clean.slice(0, -1);
    if (knownTargets.includes(withoutN)) {
      return withoutN;
    }
    // O si coincide con un alias tras quitar la N
    if (TICKER_ALIASES[withoutN]) {
      return TICKER_ALIASES[withoutN];
    }
  }

  return clean;
}
