'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface AssetPosition {
    ticker: string
    currentValue: number
}

interface IntegratedChartProps {
    holdings: AssetPosition[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c']

export default function IntegratedChart({ holdings }: IntegratedChartProps) {
    if (holdings.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900">
                No hay datos para graficar
            </div>
        )
    }

    const data = holdings.map(h => ({ name: h.ticker, value: h.currentValue }))

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value, name }: any) => {
                            const RADIAN = Math.PI / 180
                            // Cálculos super compactos para evitar recortes
                            const sin = Math.sin(-midAngle * RADIAN)
                            const cos = Math.cos(-midAngle * RADIAN)

                            // Inicio de línea pegado al borde
                            const sx = cx + (outerRadius) * cos
                            const sy = cy + (outerRadius) * sin

                            // Codo mucho más cerca (solo 10px fuera)
                            const mx = cx + (outerRadius + 10) * cos
                            const my = cy + (outerRadius + 10) * sin

                            // Línea horizontal corta (10px)
                            const ex = mx + (cos >= 0 ? 1 : -1) * 10
                            const ey = my

                            const textAnchor = cos >= 0 ? 'start' : 'end'

                            return (
                                <g>
                                    <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#9ca3af" fill="none" />
                                    <circle cx={ex} cy={ey} r={2} fill="#9ca3af" stroke="none" />
                                    <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} textAnchor={textAnchor} fill="#374151" dy={3} style={{ fontSize: '10px', fontWeight: 600 }}>
                                        {`${name}: ${(percent * 100).toFixed(1)}%`}
                                    </text>
                                </g>
                            )
                        }}
                        labelLine={false}
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value: number | undefined) => value ? `$${value.toFixed(2)}` : '$0.00'}
                        contentStyle={{ backgroundColor: '#333', borderColor: '#333', color: '#fff' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
