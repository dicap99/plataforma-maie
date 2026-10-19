import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero, porcentaje } from '../../../utils/formato'
import { Alternador, RejillaGraficas, SinDatos } from './comunes.jsx'
import { ETAPAS, razon } from './estadisticas'
import DiagramaTriangular from './DiagramaTriangular.jsx'
import GraficoAprobadosSemestre from './GraficoAprobadosSemestre.jsx'

const MODOS = [{ valor: 'cantidad', etiqueta: 'Estudiantes' }, { valor: 'pct', etiqueta: '% de matriculados' }]

// Promociones y estudiantes (RF-ADM-01): permanencia de cada promoción a lo largo de su recorrido.
export default function PanelPromociones({ cohortes, onFiltrar }) {
  const [modo, setModo] = useState('cantidad')
  const terminadas = cohortes.filter((c) => typeof c.egresados === 'number')
  const [idEmbudo, setIdEmbudo] = useState(null)
  const embudo = cohortes.find((c) => c.id_cohorte === idEmbudo) ?? terminadas.at(-1) ?? cohortes.at(-1)

  if (!cohortes.length) return <SinDatos texto="No hay promociones registradas en este rango." />

  const valor = (c, etapa) => {
    const v = c[etapa]
    if (typeof v !== 'number') return null
    return modo === 'pct' ? razon(v, c.matriculados) : v
  }
  const formato = modo === 'pct' ? porcentaje : numero
  const curva = ETAPAS.map((e) => ({ etapa: e.nombre, ...Object.fromEntries(cohortes.map((c) => [c.nombre, valor(c, e.clave)])) }))
  const series = cohortes.map((c, i) => ({ clave: c.nombre, nombre: `Promoción ${c.nombre}`, color: SERIES[i % SERIES.length] }))
  const datosEmbudo = embudo ? ETAPAS.filter((e) => typeof embudo[e.clave] === 'number').map((e) => ({ etapa: e.nombre, estudiantes: embudo[e.clave] })) : []

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Gráficas destacadas por promoción: Diagrama Triangular de Eficiencia y Aprobación por Semestre */}
      <RejillaGraficas>
        <ChartCard
          titulo="Balance Ternario de la Promoción"
          subtitulo="Relación porcentual entre Egresados, Graduados, Retiros Reales y Estudiantes en Curso."
          altura="h-auto"
        >
          <DiagramaTriangular cohortes={cohortes} />
        </ChartCard>

        <ChartCard
          titulo="Aprobación por Semestre y Promoción"
          subtitulo="Estadísticas de cuántos estudiantes aprobaron cada semestre académico a lo largo del programa."
          altura="h-auto"
        >
          <GraficoAprobadosSemestre cohortes={cohortes} />
        </ChartCard>
      </RejillaGraficas>

      <ChartCard
        titulo="Curva de permanencia"
        subtitulo="Estudiantes de cada promoción en cada etapa de su recorrido; las etapas sin dato aún no se han cursado."
        acciones={<Alternador etiqueta="Unidad" opciones={MODOS} valor={modo} onChange={setModo} />}
        tabla={{ columnas: [{ clave: 'etapa', titulo: 'Etapa' }, ...series.map((s) => ({ clave: s.clave, titulo: s.nombre, formato }))], filas: curva }}
        altura="h-80"
      >
        <GraficoLineas datos={curva} ejeX="etapa" series={series} formato={formato} />
      </ChartCard>

      <RejillaGraficas>
        <ChartCard
          titulo="Embudo de una promoción"
          subtitulo={embudo ? `Promoción ${embudo.nombre} · ${embudo.periodo_inicio} a ${embudo.periodo_fin}` : ''}
          acciones={(
            <select aria-label="Promoción del embudo" value={embudo?.id_cohorte ?? ''} onChange={(e) => setIdEmbudo(Number(e.target.value))}
              className="rounded-lg px-2 py-1 text-label-sm">
              {cohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre}</option>)}
            </select>
          )}
          tabla={{ columnas: [{ clave: 'etapa', titulo: 'Etapa' }, { clave: 'estudiantes', titulo: 'Estudiantes', formato: numero }], filas: datosEmbudo }}
        >
          <GraficoBarras datos={datosEmbudo} ejeX="etapa" horizontal anchoEtiquetas={100} series={[{ clave: 'estudiantes', nombre: 'Estudiantes', color: SERIES[0] }]} formato={numero} />
        </ChartCard>

        <ChartCard
          titulo="Egresados y graduados por promoción"
          subtitulo="Clic en una promoción para ver su registro"
          tabla={{
            columnas: [{ clave: 'nombre', titulo: 'Promoción' }, { clave: 'matriculados', titulo: 'Matriculados', formato: numero },
              { clave: 'egresados', titulo: 'Egresados', formato: numero }, { clave: 'graduados', titulo: 'Graduados', formato: numero }],
            filas: cohortes,
          }}
        >
          <GraficoBarras
            datos={cohortes.map((c) => ({ ...c, promocion: c.nombre }))}
            ejeX="promocion"
            series={[{ clave: 'matriculados', nombre: 'Matriculados', color: SERIES[0] }, { clave: 'egresados', nombre: 'Egresados', color: SERIES[2] },
              { clave: 'graduados', nombre: 'Graduados', color: SERIES[6] }]}
            formato={numero}
            onSeleccionar={(c) => onFiltrar({ etiqueta: `Promoción ${c.nombre}`, fn: (f) => f.id_cohorte === c.id_cohorte })}
          />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}
