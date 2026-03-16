'use client';

/**
 * Integrated Portfolio Chart
 * 
 * Renders a responsive pie chart using Recharts to visualize asset distribution.
 * Adjusts layout (inner/outer radius, label positioning) dynamically for mobile vs desktop views.
 * 
 * Features:
 * - Dynamic SVG labels with "elbow" connectors
 * - Interactive tooltips
 * - Mobile-optimized sizing
 * - Smart label visibility (hides labels for small slices)
 */

import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface AssetPosition {
  ticker: string;
  currentValue: number;
  color?: string;
}

interface IntegratedChartProps {
  holdings: AssetPosition[];
}

const DEFAULT_COLORS = [
  '#2563eb', // Blue 600
  '#3b82f6', // Blue 500
  '#06b6d4', // Cyan 500
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#f97316', // Orange 500
  '#ef4444', // Red 500
  '#ec4899', // Pink 500
];

export default function IntegratedChart({ holdings }: IntegratedChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (holdings.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-sm text-muted-foreground">
        No hay datos para graficar
      </div>
    );
  }

  const data = holdings.map((h) => ({
    name: h.ticker,
    value: h.currentValue,
    color: h.color
  }));

  const innerRadiusVal = isMobile ? '35%' : '30%';
  const outerRadiusVal = isMobile ? '50%' : '45%';

  const labelOffsetCodo = isMobile ? 15 : 25;
  const labelOffsetHoriz = isMobile ? 15 : 30;
  const fontSize = isMobile ? '10px' : '12px';

  return (
    <div className="h-full w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadiusVal}
            outerRadius={outerRadiusVal}
            paddingAngle={2}
            dataKey="value"
            label={({
              cx, cy, midAngle, outerRadius, percent, name,
            }: any) => {
              if (percent < 0.01) return null;

              const RADIAN = Math.PI / 180;
              const sin = Math.sin(-midAngle * RADIAN);
              const cos = Math.cos(-midAngle * RADIAN);

              const sx = cx + outerRadius * cos;
              const sy = cy + outerRadius * sin;
              const mx = cx + (outerRadius + labelOffsetCodo) * cos;
              const my = cy + (outerRadius + labelOffsetCodo) * sin;
              const ex = mx + (cos >= 0 ? 1 : -1) * labelOffsetHoriz;
              const ey = my;

              const textAnchor = cos >= 0 ? 'start' : 'end';

              return (
                <g>
                  <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="currentColor" strokeOpacity={0.3} fill="none" />
                  <circle cx={ex} cy={ey} r={2} fill="currentColor" fillOpacity={0.5} stroke="none" />
                  <text
                    x={ex + (cos >= 0 ? 1 : -1) * (isMobile ? 3 : 6)}
                    y={ey}
                    textAnchor={textAnchor}
                    fill="currentColor"
                    fillOpacity={0.8}
                    dy={3}
                    style={{ fontSize: fontSize, fontWeight: 600 }}
                  >
                    {`${name}: ${(percent * 100).toFixed(1)}%`}
                  </text>
                </g>
              );
            }}
            labelLine={false}
            className="text-foreground"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg bg-card px-3 py-2 shadow-xl ring-1 ring-border z-50">
                    <p className="text-xs font-bold text-foreground mb-0.5">
                      {payload[0].name}
                    </p>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ${Number(payload[0].value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
