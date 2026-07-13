/**
 * Standalone script to populate historical_prices table in Supabase.
 * Run with: npx tsx scripts/sync-historical-prices.ts
 * 
 * This is NOT part of the Next.js app. It's a one-off / periodic script
 * you run manually or via a cron job outside the app.
 */

import { createClient } from '@supabase/supabase-js';
import YahooFinance from 'yahoo-finance2';

// ── Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://xmgbvjkmkzhrndezozbu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const START_DATE = '2024-01-01';

if (!SUPABASE_KEY) {
  console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY env variable first.');
  console.error('   Example: $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const yahooFinance = new YahooFinance();

// ── Ticker mapping ──────────────────────────────────────────────────
// Maps our DB ticker → Yahoo Finance symbol
const sicToYahoo: Record<string, string> = {
  'AAPL': 'AAPL', 'AMD': 'AMD', 'AMZN': 'AMZN', 'ASML': 'ASML',
  'AVGO': 'AVGO', 'CEG': 'CEG', 'COPX': 'COPX', 'FIG': 'FIG',
  'GEV': 'GEV', 'GOOG': 'GOOGL', 'GOOGL': 'GOOGL', 'IAU': 'IAU',
  'LLY': 'LLY', 'LRCX': 'LRCX', 'MELI': 'MELI', 'META': 'META',
  'MSFT': 'MSFT', 'MU': 'MU', 'NU': 'NU', 'NUN': 'NU',
  'NVDA': 'NVDA', 'PLTR': 'PLTR', 'QQQ': 'QQQ', 'QQQM': 'QQQM',
  'RKLB': 'RKLB', 'SLV': 'SLV', 'SMH': 'SMH', 'SOXL': 'SOXL',
  'TSMN': 'TSM', 'URA': 'URA', 'VGT': 'VGT', 'VOO': 'VOO',
  'VRT': 'VRT', 'VT': 'VT', 'WBD': 'WBD',
  // Mexican-native BMV tickers
  'CYDSASAA': 'CYDSASA.MX', 'FEMSAUBD': 'FEMSAUBD.MX',
  'IVVPESOISHRS': 'IVVPESO.MX', 'NBISN': 'NBISHARES.MX',
  'VUAAN': 'VUA.MX', 'SNDK1': 'SNDK1.MX',
};

function mapToYahoo(dbTicker: string): string {
  if (dbTicker === 'USD-MXN') return 'MXN=X';
  const base = dbTicker.replace(':BMV', '');
  return sicToYahoo[base] || base;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Fetching tickers from transactions...');

  const { data: txRows, error } = await supabase
    .from('transactions')
    .select('ticker');

  if (error) throw error;

  const dbTickers = Array.from(new Set(txRows.map((t: any) => t.ticker as string)));
  dbTickers.push('USD-MXN'); // Always need forex

  // Group DB tickers by Yahoo symbol to avoid duplicate fetches
  const yahooMap: Record<string, string[]> = {};
  for (const t of dbTickers) {
    const y = mapToYahoo(t);
    (yahooMap[y] ??= []).push(t);
  }

  const yahooTickers = Object.keys(yahooMap);
  console.log(`📊 ${dbTickers.length} DB tickers → ${yahooTickers.length} Yahoo symbols\n`);

  let totalRows = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const [yahooTicker, mappedDbTickers] of Object.entries(yahooMap)) {
    process.stdout.write(`  ${yahooTicker.padEnd(18)} → `);

    try {
      const history = await yahooFinance.historical(yahooTicker, {
        period1: new Date(START_DATE),
        period2: new Date(),
        interval: '1d',
      });

      if (!history || history.length === 0) {
        console.log('⚠️  no data');
        continue;
      }

      for (const dbTicker of mappedDbTickers) {
        const rows = history
          .filter((h: any) => h.close != null)
          .map((h: any) => ({
            ticker: dbTicker,
            date: h.date.toISOString().split('T')[0],
            close_price: h.close,
          }));

        // Upsert in chunks of 500
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error: upsertErr } = await supabase
            .from('historical_prices')
            .upsert(chunk, { onConflict: 'ticker,date' });

          if (upsertErr) {
            console.log(`❌ upsert error: ${upsertErr.message}`);
            errorCount++;
            break;
          }
        }

        totalRows += rows.length;
      }

      console.log(`✅ ${history.length} days (for ${mappedDbTickers.join(', ')})`);
      successCount++;
    } catch (e: any) {
      console.log(`❌ ${e.message?.slice(0, 80)}`);
      errorCount++;
    }
  }

  console.log(`\n────────────────────────────────────`);
  console.log(`✅ Success: ${successCount}  ❌ Errors: ${errorCount}  📦 Total rows: ${totalRows}`);

  // Quick verification
  const { count } = await supabase.from('historical_prices').select('*', { count: 'exact', head: true });
  console.log(`📊 historical_prices table now has ${count} rows total.`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
