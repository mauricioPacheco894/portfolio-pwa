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
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c',
  '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1',
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
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900">
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
              if (percent < 0.03) return null;

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
                  <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#9ca3af" fill="none" />
                  <circle cx={ex} cy={ey} r={2} fill="#9ca3af" stroke="none" />
                  <text
                    x={ex + (cos >= 0 ? 1 : -1) * (isMobile ? 3 : 6)}
                    y={ey}
                    textAnchor={textAnchor}
                    fill="#374151"
                    dy={3}
                    style={{ fontSize: fontSize, fontWeight: 600 }}
                  >
                    {`${name}: ${(percent * 100).toFixed(1)}%`}
                  </text>
                </g>
              );
            }}
            labelLine={false}
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
                  <div className="rounded-lg bg-white px-3 py-2 shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10 z-50">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mb-0.5">
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
