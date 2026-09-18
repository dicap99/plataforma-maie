import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from '../../components/charts/ChartCard.jsx'
import PendienteAviso from '../../components/common/PendienteAviso.jsx'

const SERIES = [
  { clave: 'Alto', color: '#1e7b34' },
  { clave: 'Medio', color: '#1f5f99' },
  { clave: 'Basico', nombre: 'Básico', color: '#f2a900' },
  { clave: 'Insuficiente', color: '#b3261e' },
]

// Distribución de niveles de logro por RA (RF-RA-03/04, GET /ra/reportes).
// datos: [{ ra: 'RA1', Alto: n, Medio: n, Basico: n, Insuficiente: n }]
export default function HistogramaRAChart({ datos = [] }) {
  return (
    <>
      <h1>Resultados de aprendizaje</h1>
      <PendienteAviso requisito="RF-RA-04 — conectar con /ra/reportes?nivel=…" />
      <ChartCard titulo="Distribución de niveles por RA" subtitulo="Número de estudiantes por nivel de logro">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ra" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            {SERIES.map((s) => (
              <Bar key={s.clave} dataKey={s.clave} name={s.nombre ?? s.clave} fill={s.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}
