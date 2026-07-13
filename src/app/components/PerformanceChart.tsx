'use client';

import { format, parseISO, startOfYear, subDays, subMonths, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  timestamp: number;
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
  const [isMouseInChart, setIsMouseInChart] = useState(false);

  // Hold-to-compare: pixel-based drag using an HTML overlay
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);

  // Map the real history data
  const fullData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];

    const mappedData: ChartDataPoint[] = historyData.map(d => {
      const dt = parseISO(d.date);
      return {
        date: dt,
        timestamp: dt.getTime(),
        value: currency === 'USD' ? d.valueUSD : d.valueMXN,
        invested: currency === 'USD' ? d.investedUSD : d.investedMXN,
        formattedDate: d.formattedDate
      };
    });

    if (mappedData.length > 0) {
      const now = new Date();
      mappedData.push({
        date: now,
        timestamp: now.getTime(),
        value: currentValue,
        invested: totalInvested,
        formattedDate: format(now, "d MMM yyyy", { locale: es })
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

  // Map pixel X to the nearest data index
  const getDataIndexFromPixelX = useCallback((pixelX: number): number => {
    const container = chartContainerRef.current;
    if (!container || chartData.length === 0) return 0;
    const containerWidth = container.offsetWidth;
    const clampedX = Math.max(0, Math.min(pixelX, containerWidth));
    const ratio = clampedX / containerWidth;
    const index = Math.round(ratio * (chartData.length - 1));
    return Math.max(0, Math.min(index, chartData.length - 1));
  }, [chartData]);

  // Mouse handlers — drag only activates after moving 15px+ while holding
  const dragStartPixelRef = useRef<number | null>(null);
  const pendingDragIdxRef = useRef<number | null>(null);
  const DRAG_THRESHOLD = 15; // pixels before entering drag mode

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = chartContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = getDataIndexFromPixelX(x);

    // Don't enter drag mode yet — just record start position
    dragStartPixelRef.current = x;
    pendingDragIdxRef.current = idx;
    setIsMouseDown(true);
  }, [getDataIndexFromPixelX]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const container = chartContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));

    // If mouse is down but we haven't entered drag mode yet, check threshold
    if (dragStartPixelRef.current !== null && !isDragging) {
      const distance = Math.abs(x - dragStartPixelRef.current);
      if (distance >= DRAG_THRESHOLD) {
        // Now enter drag mode
        setIsDragging(true);
        setDragStartIdx(pendingDragIdxRef.current);
        setDragEndIdx(getDataIndexFromPixelX(x));
        setHoverData(null);
      }
      return;
    }

    // Already dragging — update end position
    if (isDragging) {
      setDragEndIdx(getDataIndexFromPixelX(x));
    }
  }, [isDragging, getDataIndexFromPixelX]);

  // On release, clear everything — go back to normal
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsMouseDown(false);
    setDragStartIdx(null);
    setDragEndIdx(null);
    dragStartPixelRef.current = null;
    pendingDragIdxRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStartIdx(null);
      setDragEndIdx(null);
    }
    setIsMouseDown(false);
    dragStartPixelRef.current = null;
    pendingDragIdxRef.current = null;
    setHoverData(null);
    setIsMouseInChart(false);
  }, [isDragging]);

  // Catch mouseup outside the chart
  useEffect(() => {
    if (!isDragging) return;
    const onMouseUp = () => handleMouseUp();
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [isDragging, handleMouseUp]);

  // Robust detection of mouse leaving chart area (catches fast exits)
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const onDocMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (inside) {
        setIsMouseInChart(true);
      } else {
        setIsMouseInChart(false);
        setHoverData(null);
      }
    };

    document.addEventListener('mousemove', onDocMouseMove);
    return () => document.removeEventListener('mousemove', onDocMouseMove);
  }, []);

  if (chartData.length === 0) return null;

  // Determine comparison points
  const firstPoint = chartData[0];
  const displayPoint = hoverData || chartData[chartData.length - 1];

  let compareStart = firstPoint;
  let compareEnd = displayPoint;
  let isHoldCompare = false;

  if (isDragging && dragStartIdx !== null && dragEndIdx !== null) {
    const lo = Math.min(dragStartIdx, dragEndIdx);
    const hi = Math.max(dragStartIdx, dragEndIdx);
    if (lo !== hi && chartData[lo] && chartData[hi]) {
      compareStart = chartData[lo];
      compareEnd = chartData[hi];
      isHoldCompare = true;
    }
  }

  // Calculate true profit to eliminate deposit distortions
  const currentProfit = compareEnd.value - compareEnd.invested;
  const initialProfit = compareStart.value - compareStart.invested;

  const valueChange = (activeRange === 'ALL' && !isHoldCompare)
    ? currentProfit
    : currentProfit - initialProfit;

  const percentChange = compareEnd.invested > 0 ? (valueChange / compareEnd.invested) * 100 : 0;
  const isPositive = valueChange >= 0;

  const lineColor = isPositive ? '#10b981' : '#ef4444';
  const gradientId = `colorValue-${activeRange}`;

  const formatCurrency = (val: number) => {
    if (!showValues) return '****';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(val);
  };

  const ranges: TimeRange[] = ['1D', '1W', '1M', 'YTD', '1Y', 'ALL'];

  const xAxisFormatter = (val: number) => {
    try {
      const date = new Date(val);
      if (activeRange === '1D' || activeRange === '1W') {
        return format(date, 'd MMM', { locale: es });
      } else if (activeRange === '1M' || activeRange === 'YTD' || activeRange === '1Y') {
        return format(date, 'MMM yyyy', { locale: es });
      } else {
        return format(date, 'yyyy', { locale: es });
      }
    } catch {
      return '';
    }
  };

  // Calculate pixel positions for the highlight overlay
  let highlightLeft: number | null = null;
  let highlightWidth: number | null = null;

  if (isDragging && dragStartIdx !== null && dragEndIdx !== null && chartContainerRef.current) {
    const containerWidth = chartContainerRef.current.offsetWidth;
    const lo = Math.min(dragStartIdx, dragEndIdx);
    const hi = Math.max(dragStartIdx, dragEndIdx);
    const startPx = (lo / (chartData.length - 1)) * containerWidth;
    const endPx = (hi / (chartData.length - 1)) * containerWidth;
    highlightLeft = startPx;
    highlightWidth = endPx - startPx;
  }

  return (
    <div className="w-full bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6 mb-6">
      {/* Header with big number and percentage */}
      <div className="flex flex-col mb-6">
        <h3 className="text-3xl font-bold text-foreground tracking-tight">
          {formatCurrency(isHoldCompare ? compareEnd.value : displayPoint.value)}
        </h3>
        <div className={`flex items-center gap-2 mt-1 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          <span className="font-medium text-lg">
            {valueChange > 0 ? '+' : ''}{formatCurrency(valueChange)}
          </span>
          <span className="font-semibold text-lg">
            ({valueChange > 0 ? '+' : ''}{showValues ? percentChange.toFixed(2) : '***'}%)
          </span>
          <span className="text-muted-foreground text-sm font-normal ml-2">
            {isHoldCompare
              ? `${format(compareStart.date, 'd MMM yyyy', { locale: es })} – ${format(compareEnd.date, 'd MMM yyyy', { locale: es })}`
              : activeRange}
          </span>
        </div>
        <div className="text-sm text-muted-foreground mt-1 h-5">
          {!isHoldCompare && displayPoint.formattedDate}
        </div>
      </div>

      {/* Chart with hold-to-compare overlay */}
      <div
        ref={chartContainerRef}
        className="h-[250px] sm:h-[300px] w-full mt-4 relative select-none [&_.recharts-wrapper]:outline-none [&_.recharts-wrapper]:border-none [&_.recharts-wrapper]:shadow-none [&_.recharts-surface]:outline-none [&_svg]:outline-none [&_*:focus]:outline-none [&_*:focus-visible]:outline-none"
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent browser text/element selection
          handleMouseDown(e);
        }}
        onMouseLeave={handleMouseLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            style={{ outline: 'none', border: 'none' }}
            onMouseLeave={() => setHoverData(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              hide={false}
              tickFormatter={xAxisFormatter}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
              minTickGap={50}
              dy={10}
              style={{ pointerEvents: 'none' }}
              type="number"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              domain={['auto', 'auto']}
              hide={true}
            />
            {/* Only show tooltip when mouse is in chart and NOT dragging */}
            {!isDragging && isMouseInChart && (
              <Tooltip
                content={<CustomTooltip setHoverData={setHoverData} />}
                cursor={{ stroke: '#71717a', strokeWidth: 1, strokeDasharray: '4 4' }}
                isAnimationActive={false}
                position={{ y: 220 }}
                wrapperStyle={{ pointerEvents: 'none', zIndex: 100 }}
              />
            )}
            <Area
              type="linear"
              dataKey="value"
              stroke={lineColor}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              activeDot={isDragging || !isMouseInChart ? false : { r: 5, fill: lineColor, stroke: 'white', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Overlay — captures mousemove while mouse is pressed (for threshold detection and active dragging) */}
        {(isDragging || isMouseDown) && (
          <div
            className="absolute inset-0"
            style={{
              zIndex: 30,
              cursor: isDragging ? 'col-resize' : 'default',
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        )}

        {/* Highlight band while holding */}
        {highlightLeft !== null && highlightWidth !== null && highlightWidth > 2 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none rounded-sm"
            style={{
              zIndex: 15,
              left: `${highlightLeft}px`,
              width: `${highlightWidth}px`,
              background: isPositive
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              borderLeft: `1.5px solid ${isPositive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              borderRight: `1.5px solid ${isPositive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            }}
          />
        )}
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
