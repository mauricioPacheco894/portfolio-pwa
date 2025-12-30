'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface AssetPosition {
  ticker: string;
  currentValue: number;
}

interface IntegratedChartProps {
  holdings: AssetPosition[];
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
];

export default function IntegratedChart({ holdings }: IntegratedChartProps) {
  if (holdings.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900">
        No hay datos para graficar
      </div>
    );
  }

  const data = holdings.map((h) => ({ name: h.ticker, value: h.currentValue }));

  return (
    <div className="h-full w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            label={({
              cx,
              cy,
              midAngle,
              innerRadius,
              outerRadius,
              startAngle,
              endAngle,
              fill,
              payload,
              percent,
              value,
              name,
            }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const RADIAN = Math.PI / 180;
              // Cálculos ajustados para tamaño mediano
              const sin = Math.sin(-midAngle * RADIAN);
              const cos = Math.cos(-midAngle * RADIAN);

              // Inicio de línea
              const sx = cx + outerRadius * cos;
              const sy = cy + outerRadius * sin;

              // Codo
              const mx = cx + (outerRadius + 8) * cos;
              const my = cy + (outerRadius + 8) * sin;

              // Línea horizontal
              const ex = mx + (cos >= 0 ? 1 : -1) * 12;
              const ey = my;

              const textAnchor = cos >= 0 ? 'start' : 'end';

              return (
                <g>
                  <path
                    d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
                    stroke="#9ca3af"
                    fill="none"
                  />
                  <circle cx={ex} cy={ey} r={2} fill="#9ca3af" stroke="none" />
                  <text
                    x={ex + (cos >= 0 ? 1 : -1) * 6}
                    y={ey}
                    textAnchor={textAnchor}
                    fill="#374151"
                    dy={3}
                    style={{ fontSize: '14px', fontWeight: 600 }}
                  >
                    {`${name}: ${(percent * 100).toFixed(1)}%`}
                  </text>
                </g>
              );
            }}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg bg-white px-3 py-2 shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mb-0.5">
                      {payload[0].name}
                    </p>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ${Number(payload[0].value).toFixed(2)}
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
