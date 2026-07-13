'use client';

import { format, parseISO,startOfYear, subDays, subMonths, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEffect,useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TimeRange = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

interface ChartDataPoint {
  date: Date;
  value: number;
  invested: number;
  formattedDate: string;
}

interface PerformanceChartProps {
  currentValue: number;
  totalInvested: number;
  currency: 'USD' | 'MXN';
  showValues: boolean;
  historyData: any[];
}



// Custom Tooltip component to handle both the floating date badge and syncing state
const CustomTooltip = ({ active, payload, setHoverData }: any) => {
  // Sync hover data back to parent safely without trigger render warnings
  useEffect(() => {
    if (active && payload && payload.length) {
      setHoverData(payload[0].payload);
    } else {
      setHoverData(null);
    }
  }, [active, payload, setHoverData]);

  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 dark:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs px-2.5 py-1.5 rounded shadow-lg transform -translate-y-4">
        {payload[0].payload.formattedDate}
      </div>
    );
  }
  return null;
};

export default function PerformanceChart({ currentValue, totalInvested, currency, showValues, historyData = [] }: PerformanceChartProps) {
  const [activeRange, setActiveRange] = useState<TimeRange>('YTD');
  const [hoverData, setHoverData] = useState<ChartDataPoint | null>(null);

  // Map the real history data
  const fullData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    
    // Map to the format needed for the chart
    const mappedData: ChartDataPoint[] = historyData.map(d => ({
      date: parseISO(d.date),
      value: currency === 'USD' ? d.valueUSD : d.valueMXN,
      invested: currency === 'USD' ? d.investedUSD : d.investedMXN,
      formattedDate: d.formattedDate
    }));
    
    // Add today's current live value at the very end so the line connects to now perfectly
    if (mappedData.length > 0) {
      mappedData.push({
        date: new Date(),
        value: currentValue,
        invested: totalInvested, // Use live totalInvested to match global KPIs perfectly
        formattedDate: format(new Date(), "d MMM yyyy", { locale: es })
      });
    }
    
    return mappedData;
  }, [historyData, currency, currentValue, totalInvested]);

  // Filter data based on selected range
  const chartData = useMemo(() => {
    const today = new Date();
    let startDate = new Date();

    switch (activeRange) {
      case '1D':
        // For 1D we usually show intraday. We'll just take the last 2 days to have some line.
        startDate = subDays(today, 2); 
        break;
      case '1W':
        startDate = subDays(today, 7);
        break;
      case '1M':
        startDate = subMonths(today, 1);
        break;
      case 'YTD':
        startDate = startOfYear(today);
        break;
      case '1Y':
        startDate = subYears(today, 1);
        break;
      case 'ALL':
        return fullData;
    }

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    return fullData.filter(d => format(d.date, 'yyyy-MM-dd') >= startDateStr);
  }, [fullData, activeRange]);

  if (chartData.length === 0) return null;

  const firstPoint = chartData[0];
  const displayPoint = hoverData || chartData[chartData.length - 1];
  
  // Calculate true profit to eliminate deposit distortions
  const currentProfit = displayPoint.value - displayPoint.invested;
  const initialProfit = firstPoint.value - firstPoint.invested;
  
  // For 'ALL', the profit should be the absolute current profit (ignoring missing history)
  // to perfectly match the global historical KPIs in the header.
  const valueChange = activeRange === 'ALL' 
    ? currentProfit 
    : currentProfit - initialProfit;
  
  // The yield is relative to the current capital base
  const percentChange = displayPoint.invested > 0 ? (valueChange / displayPoint.invested) * 100 : 0;
  
  const isPositive = valueChange >= 0;

  const lineColor = isPositive ? '#10b981' : '#ef4444'; // Emerald 500 or Red 500
  const gradientId = `colorValue-${activeRange}`;

  const formatCurrency = (val: number) => {
    if (!showValues) return '****';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(val);
  };

  const ranges: TimeRange[] = ['1D', '1W', '1M', 'YTD', '1Y', 'ALL'];

  const xAxisFormatter = (val: Date) => {
    try {
      if (activeRange === '1D' || activeRange === '1W') {
        return format(val, 'd MMM', { locale: es });
      } else if (activeRange === '1M' || activeRange === 'YTD' || activeRange === '1Y') {
        return format(val, 'MMM yyyy', { locale: es });
      } else {
        return format(val, 'yyyy', { locale: es });
      }
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6 mb-6">
      {/* Header with big number and percentage */}
      <div className="flex flex-col mb-6">
        <h3 className="text-3xl font-bold text-foreground tracking-tight">
          {formatCurrency(displayPoint.value)}
        </h3>
        <div className={`flex items-center gap-2 mt-1 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          <span className="font-medium text-lg">
            {valueChange > 0 ? '+' : ''}{formatCurrency(valueChange)}
          </span>
          <span className="font-semibold text-lg">
            ({valueChange > 0 ? '+' : ''}{showValues ? percentChange.toFixed(2) : '***'}%)
          </span>
          <span className="text-muted-foreground text-sm font-normal ml-2">
            {activeRange}
          </span>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {displayPoint.formattedDate}
        </div>
      </div>

      {/* Chart */}
      <div 
        className="h-[250px] sm:h-[300px] w-full mt-4 relative" 
        onMouseLeave={() => setHoverData(null)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            onMouseLeave={() => setHoverData(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              hide={false}
              tickFormatter={xAxisFormatter}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
              minTickGap={50}
              dy={10}
              style={{ pointerEvents: 'none' }}
            />
            <YAxis 
              domain={['auto', 'auto']} 
              hide={true} // Hide axis like Google Finance
            />
            <Tooltip
              content={<CustomTooltip setHoverData={setHoverData} />}
              cursor={{ stroke: '#71717a', strokeWidth: 1, strokeDasharray: '4 4' }} // Zinc 500
              isAnimationActive={false}
              position={{ y: 220 }} // Position the date badge near the bottom like Google Finance
              wrapperStyle={{ pointerEvents: 'none', zIndex: 100 }}
            />
            <Area
              type="linear"
              dataKey="value"
              stroke={lineColor}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              activeDot={{ r: 5, fill: lineColor, stroke: 'white', strokeWidth: 2 }}
              isAnimationActive={false} // Disable animation for smoother hover experience
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2 mt-6 border-t border-border pt-4 overflow-x-auto pb-1 no-scrollbar">
        {ranges.map((range) => (
          <button
            key={range}
            onClick={() => {
              setActiveRange(range);
              setHoverData(null);
            }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              activeRange === range
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-foreground'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}
