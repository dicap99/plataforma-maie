import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRILLA, SERIES, SUPERFICIE, TEXTO_SECUNDARIO } from './paleta'

// Series temporales en un solo eje (misma unidad). series: [{ clave, nombre, color? }]
export default function GraficoLineas({ datos, ejeX, series, formato = (v) => v, formatoEje }) {
  // Tooltip en el orden de definición (Recharts ordena alfabéticamente por defecto). Se memoiza:
  // una función nueva en cada render hace que Recharts recalcule el diseño y desalinee los ejes.
  const claves = series.map((s) => s.clave).join('|')
  const orden = useMemo(() => {
    const posicion = claves.split('|')
    return (item) => posicion.indexOf(item.dataKey)
  }, [claves])
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={datos} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRILLA} />
        <XAxis dataKey={ejeX} minTickGap={12} tickLine={false} axisLine={{ stroke: GRILLA }} tick={{ fill: TEXTO_SECUNDARIO, fontSize: 12 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={formatoEje ? 72 : 40}
          tick={{ fill: TEXTO_SECUNDARIO, fontSize: 12 }}
          tickFormatter={formatoEje ?? formato}
        />
        <Tooltip itemSorter={orden} formatter={(v, nombre) => [formato(v), nombre]} />
        {series.length > 1 && <Legend itemSorter={null} iconType="plainline" wrapperStyle={{ fontSize: 12, color: TEXTO_SECUNDARIO }} />}
        {series.map((s, i) => (
          <Line
            key={s.clave}
            dataKey={s.clave}
            name={s.nombre}
            stroke={s.color ?? SERIES[i]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 4, fill: s.color ?? SERIES[i], stroke: SUPERFICIE, strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: SUPERFICIE, strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
