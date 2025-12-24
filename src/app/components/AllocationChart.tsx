'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { AssetPosition } from '@/utils/portfolioMath'

// Colores profesionales para finanzas
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c']

interface Props {
  holdings: AssetPosition[]
}

export default function AllocationChart({ holdings }: Props) {
  // Preparamos los datos para la gráfica
  const data = holdings.map(h => ({
    name: h.ticker,
    value: h.currentValue
  }))

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
        No hay datos para graficar
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-4 font-semibold text-zinc-700 dark:text-zinc-200">Distribución Actual</h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => `$${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
            />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
