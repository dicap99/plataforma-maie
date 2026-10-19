import { useState } from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { GRILLA, SERIES, TEXTO_SECUNDARIO } from '../../../components/charts/paleta'
import { porcentaje } from '../../../utils/formato'
import { razon, suma } from './estadisticas'

// Titulación (gráfico «Titulación MaIE» de la hoja «Promociones y Estudiantes»): radar de tres ejes con
// % Egresados = egresados ÷ matriculados, % Graduados = graduados ÷ egresados y % Retiros = 1 − % Egresados.
// Solo cuentan las promociones culminadas (con egresados registrados): una promoción en curso
// aún no tiene retiros definitivos.
export const metricasTitulacion = (cohortes) => {
  const culminadas = cohortes.filter((c) => typeof c.egresados === 'number')
  const matriculados = suma(culminadas.map((c) => c.matriculados))
  const egresados = suma(culminadas.map((c) => c.egresados))
  const graduados = suma(culminadas.map((c) => c.graduados))
  const pctEgresados = razon(egresados, matriculados)
  return {
    culminadas: culminadas.length,
    matriculados,
    egresados,
    graduados,
    datos: [
      { eje: '% Egresados', valor: pctEgresados, detalle: `${egresados} de ${matriculados} matriculados` },
      { eje: '% Graduados', valor: razon(graduados, egresados), detalle: `${graduados} de ${egresados} egresados` },
      { eje: '% Retiros', valor: pctEgresados === null ? null : 1 - pctEgresados, detalle: `${matriculados - egresados} de ${matriculados} matriculados` },
    ],
  }
}

export default function DiagramaTriangular({ cohortes = [] }) {
  const [seleccion, setSeleccion] = useState('todas')
  const elegidas = seleccion === 'todas' ? cohortes : cohortes.filter((c) => String(c.id_cohorte) === seleccion)
  const m = metricasTitulacion(elegidas)
  // Escala en pasos de 20 % (como el libro), hasta el valor más alto.
  const tope = Math.max(0.2, Math.ceil(Math.max(...m.datos.map((d) => d.valor ?? 0)) * 5) / 5)
  const ticks = Array.from({ length: Math.round(tope * 5) + 1 }, (_, i) => i / 5)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <span className="text-xs text-slate-500 font-medium">
          {m.culminadas ? `${m.culminadas} promoción(es) culminada(s) · ${m.matriculados} matriculados` : 'Sin promociones culminadas'}
        </span>
        <div className="flex items-center space-x-2">
          <label htmlFor="select-titulacion" className="text-xs text-slate-500 font-medium">Promoción:</label>
          <select id="select-titulacion" value={seleccion} onChange={(e) => setSeleccion(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg border-slate-300 bg-white text-slate-700 font-medium shadow-2xs">
            <option value="todas">Todas las promociones</option>
            {cohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre}</option>)}
          </select>
        </div>
      </div>

      {m.culminadas ? (
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={m.datos} outerRadius="85%" margin={{ top: 16, right: 48, bottom: 8, left: 48 }}>
              <PolarGrid gridType="polygon" stroke={GRILLA} />
              <PolarAngleAxis dataKey="eje" tick={{ fill: TEXTO_SECUNDARIO, fontSize: 13, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, tope]} ticks={ticks} tickFormatter={porcentaje}
                tick={{ fill: TEXTO_SECUNDARIO, fontSize: 11 }} axisLine={false} />
              <Tooltip formatter={(v, _n, item) => [`${porcentaje(v)} (${item.payload.detalle})`, item.payload.eje]} />
              <Radar dataKey="valor" name="Titulación" stroke={SERIES[0]} strokeWidth={2.5} fill={SERIES[0]} fillOpacity={0.08}
                dot={{ r: 4, fill: SERIES[0] }} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="grid h-96 place-items-center text-body-sm text-on-surface-variant">
          La promoción aún no tiene egresados registrados.
        </p>
      )}
    </div>
  )
}
