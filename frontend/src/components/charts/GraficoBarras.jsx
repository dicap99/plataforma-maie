import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRILLA, SERIES, SUPERFICIE, TEXTO_SECUNDARIO } from './paleta'

// Barras agrupadas o apiladas con un solo eje Y.
// series: [{ clave, nombre, color? }] — el color se fija por posición en la definición, no por rango.
export default function GraficoBarras({ datos, ejeX, series, apilado = false, formato = (v) => v, formatoEje }) {
  const ultima = series.length - 1
  // Tooltip en el orden de definición (Recharts ordena alfabéticamente por defecto). Se memoiza:
  // una función nueva en cada render hace que Recharts recalcule el diseño y desalinee los ejes.
  const claves = series.map((s) => s.clave).join('|')
  const orden = useMemo(() => {
    const posicion = claves.split('|')
    return (item) => posicion.indexOf(item.dataKey)
  }, [claves])
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={GRILLA} />
        <XAxis dataKey={ejeX} minTickGap={12} tickLine={false} axisLine={{ stroke: GRILLA }} tick={{ fill: TEXTO_SECUNDARIO, fontSize: 12 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={formatoEje ? 72 : 40}
          tick={{ fill: TEXTO_SECUNDARIO, fontSize: 12 }}
          tickFormatter={formatoEje ?? formato}
        />
        <Tooltip itemSorter={orden} formatter={(v, nombre) => [formato(v), nombre]} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
        {series.length > 1 && <Legend itemSorter={null} iconType="square" wrapperStyle={{ fontSize: 12, color: TEXTO_SECUNDARIO }} />}
        {series.map((s, i) => (
          <Bar
            key={s.clave}
            dataKey={s.clave}
            name={s.nombre}
            fill={s.color ?? SERIES[i]}
            stackId={apilado ? 'total' : undefined}
            maxBarSize={24}
            // Extremo de dato redondeado (4px), recto en la base; en apiladas solo el segmento superior.
            radius={!apilado || i === ultima ? [4, 4, 0, 0] : 0}
            stroke={apilado ? SUPERFICIE : undefined}
            strokeWidth={apilado ? 2 : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
