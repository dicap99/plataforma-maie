import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Alternador } from './comunes.jsx'
import LeyendaInteractiva, { useSeriesOcultas } from '../../../components/charts/LeyendaInteractiva.jsx'
import { GRILLA, TEXTO_SECUNDARIO } from '../../../components/charts/paleta'
import { numero, porcentaje } from '../../../utils/formato'

const MODOS = [
  { valor: 'cantidad', etiqueta: 'Estudiantes' },
  { valor: 'pct', etiqueta: '% de matriculados' },
]

const COLORES_SEMESTRES = [
  { clave: 'semestre1', nombre: 'Aprobaron Semestre I', color: '#6366f1' },
  { clave: 'semestre2', nombre: 'Aprobaron Semestre II', color: '#8b5cf6' },
  { clave: 'semestre3', nombre: 'Aprobaron Semestre III', color: '#0ea5e9' },
  { clave: 'semestre4', nombre: 'Aprobaron Semestre IV (Egresados)', color: '#10b981' },
]

export default function GraficoAprobadosSemestre({ cohortes = [] }) {
  const [modo, setModo] = useState('cantidad')
  const [promocionFiltro, setPromocionFiltro] = useState('todas')

  const { ocultas, alternar } = useSeriesOcultas(COLORES_SEMESTRES.length)

  // Datos para la comparativa general de todas las promociones
  const datosComparativa = useMemo(() => {
    return cohortes.map((c) => {
      const total = c.matriculados || 1
      const s1 = c.aprobados_sem1 ?? 0
      const s2 = c.aprobados_sem2 ?? 0
      const s3 = c.aprobados_sem3 ?? 0
      const s4 = c.egresados ?? 0

      const nombre =
        c.nombre.startsWith('Sintética') || c.nombre.startsWith('Cohorte')
          ? c.nombre
          : `Promoción ${c.nombre}`

      return {
        id_cohorte: c.id_cohorte,
        promocion: nombre,
        periodo: `${c.periodo_inicio} - ${c.periodo_fin || 'En curso'}`,
        matriculados: c.matriculados,
        semestre1: modo === 'pct' ? (c.aprobados_sem1 != null ? s1 / total : null) : c.aprobados_sem1,
        semestre2: modo === 'pct' ? (c.aprobados_sem2 != null ? s2 / total : null) : c.aprobados_sem2,
        semestre3: modo === 'pct' ? (c.aprobados_sem3 != null ? s3 / total : null) : c.aprobados_sem3,
        semestre4: modo === 'pct' ? (c.egresados != null ? s4 / total : null) : c.egresados,
        _raw: { s1, s2, s3, s4, total },
      }
    })
  }, [cohortes, modo])

  // Datos para la vista de detalle de una promoción específica
  const detalleIndividual = useMemo(() => {
    if (promocionFiltro === 'todas') return null
    const c = cohortes.find((x) => String(x.id_cohorte) === String(promocionFiltro))
    if (!c) return null

    const total = c.matriculados || 1
    return [
      {
        semestre: 'Semestre I',
        aprobados: c.aprobados_sem1,
        pct: c.aprobados_sem1 != null ? c.aprobados_sem1 / total : null,
        matriculados: total,
        color: '#6366f1',
      },
      {
        semestre: 'Semestre II',
        aprobados: c.aprobados_sem2,
        pct: c.aprobados_sem2 != null ? c.aprobados_sem2 / total : null,
        matriculados: total,
        color: '#8b5cf6',
      },
      {
        semestre: 'Semestre III',
        aprobados: c.aprobados_sem3,
        pct: c.aprobados_sem3 != null ? c.aprobados_sem3 / total : null,
        matriculados: total,
        color: '#0ea5e9',
      },
      {
        semestre: 'Semestre IV (Egresados)',
        aprobados: c.egresados,
        pct: c.egresados != null ? c.egresados / total : null,
        matriculados: total,
        color: '#10b981',
      },
    ]
  }, [cohortes, promocionFiltro])

  const formatoValor = modo === 'pct' ? porcentaje : numero
  const ticks = { fill: TEXTO_SECUNDARIO, fontSize: 12 }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controles de Vista: Unidad y Selector de Cohorte */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <label htmlFor="select-barras-aprobados" className="text-xs text-slate-500 font-medium">
            Promoción:
          </label>
          <select
            id="select-barras-aprobados"
            value={promocionFiltro}
            onChange={(e) => setPromocionFiltro(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg border-slate-300 bg-white text-slate-700 font-medium shadow-2xs focus:ring-violet-500 focus:border-violet-500"
          >
            <option value="todas">Todas las promociones (Comparativa)</option>
            {cohortes.map((c) => (
              <option key={c.id_cohorte} value={c.id_cohorte}>
                {c.nombre.startsWith('Sintética') || c.nombre.startsWith('Cohorte')
                  ? c.nombre
                  : `Promoción ${c.nombre}`}{' '}
                ({c.periodo_inicio})
              </option>
            ))}
          </select>
        </div>

        <Alternador etiqueta="Unidad" opciones={MODOS} valor={modo} onChange={setModo} />
      </div>

      {/* Gráfico de Barras */}
      <div className="min-h-[280px] h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {promocionFiltro === 'todas' ? (
            /* Vista General: Promociones en X con 4 barras por semestre */
            <BarChart
              data={datosComparativa}
              margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
              barGap={3}
            >
              <CartesianGrid vertical={false} stroke={GRILLA} strokeDasharray="3 3" />
              <XAxis dataKey="promocion" tickLine={false} axisLine={{ stroke: GRILLA }} tick={ticks} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={ticks}
                tickFormatter={formatoValor}
                domain={modo === 'pct' ? [0, 1] : ['auto', 'auto']}
              />
              <Tooltip
                formatter={(v, nombre) => [v != null ? formatoValor(v) : 'No cursado', nombre]}
                cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
              />
              {COLORES_SEMESTRES.map((s) => (
                <Bar
                  key={s.clave}
                  dataKey={s.clave}
                  name={s.nombre}
                  fill={s.color}
                  hide={ocultas.has(s.clave)}
                  maxBarSize={22}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : (
            /* Vista Detalle: Semestres en X para la promoción elegida */
            <BarChart
              data={detalleIndividual}
              margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid vertical={false} stroke={GRILLA} strokeDasharray="3 3" />
              <XAxis dataKey="semestre" tickLine={false} axisLine={{ stroke: GRILLA }} tick={ticks} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={ticks}
                tickFormatter={formatoValor}
                domain={modo === 'pct' ? [0, 1] : ['auto', 'auto']}
              />
              <Tooltip
                formatter={(v) => [v != null ? formatoValor(v) : 'Sin datos', modo === 'pct' ? '% Aprobados' : 'Estudiantes Aprobados']}
                cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
              />
              <Bar
                dataKey={modo === 'pct' ? 'pct' : 'aprobados'}
                name={modo === 'pct' ? '% Aprobados' : 'Estudiantes'}
                maxBarSize={48}
                radius={[6, 6, 0, 0]}
              >
                {detalleIndividual?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {promocionFiltro === 'todas' && (
        <LeyendaInteractiva
          items={COLORES_SEMESTRES}
          ocultas={ocultas}
          onAlternar={alternar}
        />
      )}
    </div>
  )
}
