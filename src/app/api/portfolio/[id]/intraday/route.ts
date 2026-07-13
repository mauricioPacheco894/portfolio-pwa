import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { createClient } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing portfolio id' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // 1. Get active positions
    const { data: positions, error } = await supabase.rpc('get_portfolio_positions', {
      p_portfolio_id: id,
    });

    if (error || !positions) {
      return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
    }

    const activePositions = positions.filter((p: any) => p.total_shares > 0);
    
    // 2. Fetch USD-MXN rate
    const { data: rateData } = await supabase
      .from('asset_prices')
      .select('price')
      .eq('ticker', 'USD-MXN')
      .maybeSingle();
    const fallbackRate = rateData?.price || 20.0;

    // Fetch intraday USDMXN=X
    let usdMxnQuotes: { date: Date, close: number }[] = [];
    const period1 = new Date();
    period1.setHours(0, 0, 0, 0);

    try {
      const res = await yahooFinance.chart('USDMXN=X', { period1, interval: '15m' });
      usdMxnQuotes = res.quotes.map(q => ({ date: q.date, close: q.close || fallbackRate }));
    } catch (e) {
      console.error('Failed to fetch intraday USDMXN=X, using fallback');
    }

    // Helper to get exchange rate at a specific timestamp
    const getExchangeRate = (timestamp: number) => {
      if (usdMxnQuotes.length === 0) return fallbackRate;
      // Find closest quote before or at timestamp
      let closest = usdMxnQuotes[0].close;
      let minDiff = Infinity;
      for (const q of usdMxnQuotes) {
        const diff = timestamp - q.date.getTime();
        if (diff >= 0 && diff < minDiff) {
          minDiff = diff;
          closest = q.close;
        }
      }
      return closest;
    };

    // 3. Fetch intraday data for all active tickers
    const tickerQuotes = new Map<string, { date: Date, close: number }[]>();
    const allTimestamps = new Set<number>();

    await Promise.all(
      activePositions.map(async (pos: any) => {
        try {
          const res = await yahooFinance.chart(pos.ticker, { period1, interval: '15m' });
          const quotes = res.quotes
            .filter(q => q.close !== null)
            .map(q => ({ date: q.date, close: q.close! }));
          tickerQuotes.set(pos.ticker, quotes);
          quotes.forEach(q => allTimestamps.add(q.date.getTime()));
        } catch (e) {
          console.error(`Failed to fetch intraday for ${pos.ticker}`, e);
          tickerQuotes.set(pos.ticker, []);
        }
      })
    );

    // 4. Align timestamps and calculate portfolio value
    // If no intraday data at all, return empty array
    if (allTimestamps.size === 0) {
      return NextResponse.json({ data: [] });
    }

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    let totalInvestedUSD = 0;
    let totalInvestedMXN = 0;

    const dataPoints = sortedTimestamps.map(ts => {
      let valueUSD = 0;
      let valueMXN = 0;
      let currentInvestedUSD = 0;
      let currentInvestedMXN = 0;

      const currentRate = getExchangeRate(ts);

      activePositions.forEach((pos: any) => {
        const quotes = tickerQuotes.get(pos.ticker) || [];
        // Find closest price before or at ts
        let currentPrice = pos.current_value / pos.total_shares; // fallback to db price
        
        let found = false;
        let lastValidPrice = currentPrice;
        for (const q of quotes) {
          if (q.date.getTime() <= ts) {
            lastValidPrice = q.close;
            found = true;
          } else {
            break; // Since quotes are chronological
          }
        }
        
        if (found) {
          currentPrice = lastValidPrice;
        }

        const isMxn = pos.currency === 'MXN';
        const assetValue = currentPrice * pos.total_shares;

        if (isMxn) {
          valueMXN += assetValue;
          valueUSD += assetValue / currentRate;
        } else {
          valueUSD += assetValue;
          valueMXN += assetValue * currentRate;
        }
        
        if (isMxn) {
          currentInvestedMXN += pos.total_invested;
          currentInvestedUSD += pos.total_invested / currentRate;
        } else {
          currentInvestedUSD += pos.total_invested;
          currentInvestedMXN += pos.total_invested * currentRate;
        }
      });

      return {
        date: new Date(ts).toISOString(),
        timestamp: ts,
        valueUSD,
        valueMXN,
        investedUSD: currentInvestedUSD,
        investedMXN: currentInvestedMXN,
      };
    });

    return NextResponse.json({ data: dataPoints });
  } catch (error) {
    console.error('Error in intraday API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
