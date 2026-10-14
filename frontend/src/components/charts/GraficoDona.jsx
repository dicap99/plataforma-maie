import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SERIES, SUPERFICIE, TEXTO_SECUNDARIO } from './paleta'

// Composición de un total en pocas categorías (≤ 6). datos: [{ nombre, valor, color? }].
// El total se muestra en el centro; el detalle por categoría queda en la leyenda y el tooltip.
export default function GraficoDona({ datos, formato = (v) => v, etiquetaTotal = 'Total', onSeleccionar }) {
  const total = datos.reduce((s, d) => s + (d.valor ?? 0), 0)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={datos}
          dataKey="valor"
          nameKey="nombre"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={1}
          stroke={SUPERFICIE}
          strokeWidth={2}
          cursor={onSeleccionar ? 'pointer' : undefined}
          onClick={onSeleccionar ? (d) => onSeleccionar(d.payload ?? d) : undefined}
          isAnimationActive={false}
        >
          {datos.map((d, i) => <Cell key={d.nombre} fill={d.color ?? SERIES[i % SERIES.length]} />)}
        </Pie>
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 26, fontWeight: 700, fill: '#040039' }}>
          {formato(total)}
        </text>
        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 12, fill: TEXTO_SECUNDARIO }}>
          {etiquetaTotal}
        </text>
        <Tooltip formatter={(v, nombre) => [`${formato(v)} (${total ? Math.round((v / total) * 100) : 0} %)`, nombre]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: TEXTO_SECUNDARIO }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
