import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRILLA, SERIES, SUPERFICIE, TEXTO_SECUNDARIO } from './paleta'

// Barras agrupadas o apiladas con un solo eje de valores.
// series: [{ clave, nombre, color? }] — el color se fija por posición en la definición, no por rango.
// horizontal: categorías en el eje vertical (útil con etiquetas largas).
// onSeleccionar(fila): clic en una barra (p. ej. para filtrar la tabla de datos).
export default function GraficoBarras({
  datos, ejeX, series, apilado = false, horizontal = false, formato = (v) => v, formatoEje, onSeleccionar, anchoEtiquetas = 160,
}) {
  const ultima = series.length - 1
  // Tooltip en el orden de definición (Recharts ordena alfabéticamente por defecto). Se memoiza:
  // una función nueva en cada render hace que Recharts recalcule el diseño y desalinee los ejes.
  const claves = series.map((s) => s.clave).join('|')
  const orden = useMemo(() => {
    const posicion = claves.split('|')
    return (item) => posicion.indexOf(item.dataKey)
  }, [claves])
  const ticks = { fill: TEXTO_SECUNDARIO, fontSize: 12 }
  const ejeCategorias = horizontal
    ? <YAxis type="category" dataKey={ejeX} width={anchoEtiquetas} tickLine={false} axisLine={{ stroke: GRILLA }} tick={ticks} interval={0} />
    : <XAxis dataKey={ejeX} minTickGap={12} tickLine={false} axisLine={{ stroke: GRILLA }} tick={ticks} />
  const ejeValores = horizontal
    ? <XAxis type="number" tickLine={false} axisLine={false} tick={ticks} tickFormatter={formatoEje ?? formato} allowDecimals={false} />
    : <YAxis tickLine={false} axisLine={false} width={formatoEje ? 72 : 40} tick={ticks} tickFormatter={formatoEje ?? formato} />
  // Extremo de dato redondeado (4px), recto en la base; en apiladas solo el segmento final.
  const radio = (i) => {
    if (apilado && i !== ultima) return 0
    return horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={datos} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={GRILLA} />
        {ejeCategorias}
        {ejeValores}
        <Tooltip itemSorter={orden} formatter={(v, nombre) => [formato(v), nombre]} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
        {series.length > 1 && <Legend itemSorter={null} iconType="square" wrapperStyle={{ fontSize: 12, color: TEXTO_SECUNDARIO }} />}
        {series.map((s, i) => (
          <Bar
            key={s.clave}
            dataKey={s.clave}
            name={s.nombre}
            fill={s.color ?? SERIES[i]}
            stackId={apilado ? 'total' : undefined}
            maxBarSize={horizontal ? 20 : 24}
            radius={radio(i)}
            stroke={apilado ? SUPERFICIE : undefined}
            strokeWidth={apilado ? 2 : 0}
            cursor={onSeleccionar ? 'pointer' : undefined}
            onClick={onSeleccionar ? (d) => onSeleccionar(d.payload ?? d) : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
