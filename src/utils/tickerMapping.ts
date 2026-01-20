/**
 * Ticker Mapping Utilities
 *
 * Normalizes ticker symbols to their canonical form.
 * Handles exchange suffixes (.MX, :BMV) and SIC variants (ticker + "N" suffix).
 */

/** Manual aliases for exceptional cases that don't follow standard patterns */
export const TICKER_ALIASES: Record<string, string> = {
  IVVPESO: 'IVV',
};

/**
 * Normalizes a ticker to its canonical "base" version.
 *
 * @param ticker - The raw ticker symbol
 * @param knownTargets - Optional list of target tickers to help with inference
 * @returns The normalized ticker symbol
 *
 * @example
 * normalizeTicker('VUAAN', ['VUAA']) // Returns 'VUAA'
 * normalizeTicker('NU.MX', [])       // Returns 'NU'
 */
export function normalizeTicker(
  ticker: string,
  knownTargets: string[] = []
): string {
  let clean = ticker.toUpperCase();

  // Remove exchange suffixes (.MX, :BMV, etc.)
  if (clean.includes(':')) {
    clean = clean.split(':')[0];
  }
  if (clean.endsWith('.MX')) {
    clean = clean.replace('.MX', '');
  }

  // Check direct aliases
  if (TICKER_ALIASES[clean]) {
    return TICKER_ALIASES[clean];
  }

  // Check if it matches a known target exactly
  if (knownTargets.includes(clean)) {
    return clean;
  }

  // SIC inference: If ticker ends in "N" and removing it matches a target
  if (clean.endsWith('N')) {
    const withoutN = clean.slice(0, -1);
    if (knownTargets.includes(withoutN)) {
      return withoutN;
    }
    if (TICKER_ALIASES[withoutN]) {
      return TICKER_ALIASES[withoutN];
    }
  }

  return clean;
}
