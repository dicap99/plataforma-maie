import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import LeyendaInteractiva, { useSeriesOcultas } from './LeyendaInteractiva.jsx'
import { SERIES, SUPERFICIE, TEXTO_SECUNDARIO } from './paleta'

// Composición de un total en pocas categorías (≤ 6). datos: [{ nombre, valor, color? }].
// El total (de las categorías visibles) se muestra en el centro; la leyenda permite ocultar categorías.
export default function GraficoDona({ datos, formato = (v) => v, etiquetaTotal = 'Total', onSeleccionar }) {
  const { ocultas, alternar } = useSeriesOcultas(datos.length)
  const conColor = datos.map((d, i) => ({ ...d, color: d.color ?? SERIES[i % SERIES.length] }))
  const visibles = conColor.filter((d) => !ocultas.has(d.nombre))
  const total = visibles.reduce((s, d) => s + (d.valor ?? 0), 0)
  return (
    <div className="flex h-full flex-col">
    <div className="min-h-0 flex-1">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={visibles}
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
          {visibles.map((d) => <Cell key={d.nombre} fill={d.color} />)}
        </Pie>
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 26, fontWeight: 700, fill: '#040039' }}>
          {formato(total)}
        </text>
        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 12, fill: TEXTO_SECUNDARIO }}>
          {etiquetaTotal}
        </text>
        <Tooltip formatter={(v, nombre) => [`${formato(v)} (${total ? Math.round((v / total) * 100) : 0} %)`, nombre]} />
      </PieChart>
    </ResponsiveContainer>
    </div>
    {datos.length > 1 && (
      <LeyendaInteractiva forma="circulo" items={conColor.map((d) => ({ clave: d.nombre, nombre: d.nombre, color: d.color }))} ocultas={ocultas} onAlternar={alternar} />
    )}
    </div>
  )
}
