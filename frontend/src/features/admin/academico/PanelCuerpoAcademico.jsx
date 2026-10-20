import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoDona from '../../../components/charts/GraficoDona.jsx'
import GraficoLineas from '../../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero } from '../../../utils/formato'
import { RejillaGraficas, SinDatos } from './comunes.jsx'
import { camposDeFormacion, docentesPorCampo, porCohorte, suma } from './estadisticas'

const ROMANOS = ['I', 'II', 'III', 'IV']

// Cuerpo Académico y Oferta Curricular (RF-ADM-01, RF-ADM-06):
// Integra la planta docente (filiación UDENAR/Externos, campos de formación) con la oferta de cursos por semestre.
// `parametros`: filas de Parámetros del programa (solo Coordinación); de ellas salen los créditos por semestre.
export default function PanelCuerpoAcademico({ filasDocentes = [], filasCursos = [], cohortes = [], parametros = [], onFiltrar }) {
  const [idCohorte, setIdCohorte] = useState('')

  if (!filasDocentes.length && !filasCursos.length) {
    return <SinDatos texto="No hay datos de docentes u oferta registrados en este rango." />
  }

  // Métricas de docentes
  const udenar = filasDocentes.filter((d) => d.afiliacion === 'UDENAR').length
  const externos = filasDocentes.filter((d) => d.afiliacion === 'EXTERNO').length
  const campos = docentesPorCampo(filasDocentes)
  const afiliacion = [
    { nombre: 'UDENAR', valor: udenar, color: SERIES[0] },
    { nombre: 'Externos', valor: externos, color: SERIES[1] },
  ]

  // Métricas de cursos por cohorte y semestre
  const datosCursos = porCohorte(filasCursos, cohortes)
  const promociones = cohortes.filter((c) => datosCursos.some((f) => f.id_cohorte === c.id_cohorte))

  const elegidas = idCohorte ? datosCursos.filter((f) => String(f.id_cohorte) === idCohorte) : datosCursos
  const porSemestre = [1, 2, 3, 4].map((s) => {
    const del = elegidas.filter((f) => f.semestre === s)
    return {
      semestre: `Semestre ${ROMANOS[s - 1]}`,
      numero: s,
      udenar: suma(del.map((f) => f.docentes_udenar)),
      externos: suma(del.map((f) => f.docentes_externos)),
    }
  })

  const evolucion = [1, 2, 3, 4].map((s) => ({
    semestre: `Semestre ${ROMANOS[s - 1]}`,
    ...Object.fromEntries(
      promociones.map((c) => [c.nombre, datosCursos.find((f) => f.id_cohorte === c.id_cohorte && f.semestre === s)?.n_cursos ?? null])
    ),
  }))
  const seriesPromociones = promociones.map((c, i) => ({
    clave: c.nombre,
    nombre: `Promoción ${c.nombre}`,
    color: SERIES[i % SERIES.length],
  }))
  const nombreElegida = promociones.find((c) => String(c.id_cohorte) === idCohorte)?.nombre

  const creditos = [1, 2, 3, 4].map((s) => ({
    semestre: `Semestre ${ROMANOS[s - 1]}`,
    creditos: parametros.find((p) => p.clave === `creditos_semestre_${s}`)?.valor ?? null,
  }))
  const hayCreditos = creditos.some((c) => c.creditos !== null)


  return (
    <div className="flex flex-col gap-space-lg">
      <RejillaGraficas>
        <ChartCard
          titulo="Docentes UDENAR y externos por semestre"
          subtitulo={`${nombreElegida ? `Promoción ${nombreElegida}` : 'Suma de las promociones'} · clic en un semestre para filtrar`}
          acciones={(
            <select
              aria-label="Promoción"
              value={idCohorte}
              onChange={(e) => setIdCohorte(e.target.value)}
              className="rounded-lg px-2 py-1 text-label-sm border border-slate-300 bg-white"
            >
              <option value="">Todas las promociones</option>
              {promociones.map((c) => (
                <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre}</option>
              ))}
            </select>
          )}
          tabla={{
            columnas: [
              { clave: 'semestre', titulo: 'Semestre' },
              { clave: 'udenar', titulo: 'UDENAR', formato: numero },
              { clave: 'externos', titulo: 'Externos', formato: numero },
            ],
            filas: porSemestre,
          }}
        >
          <GraficoBarras
            datos={porSemestre}
            ejeX="semestre"
            apilado
            series={[
              { clave: 'udenar', nombre: 'UDENAR', color: SERIES[0] },
              { clave: 'externos', nombre: 'Externos', color: SERIES[1] },
            ]}
            formato={numero}
            onSeleccionar={(s) =>
              onFiltrar?.({
                etiqueta: `${s.semestre}${nombreElegida ? ` · Promoción ${nombreElegida}` : ''}`,
                fn: (f) => f.semestre === s.numero && (!idCohorte || String(f.id_cohorte) === idCohorte),
              })
            }
          />
        </ChartCard>

        <ChartCard
          titulo="Afiliación de la planta docente"
          subtitulo="Distribución de docentes institucionales frente a invitados externos"
          tabla={{
            columnas: [
              { clave: 'nombre', titulo: 'Afiliación' },
              { clave: 'valor', titulo: 'Docentes', formato: numero },
            ],
            filas: afiliacion,
          }}
        >
          <GraficoDona
            datos={afiliacion}
            formato={numero}
            etiquetaTotal="docentes"
            onSeleccionar={(s) => {
              const valor = s.nombre === 'UDENAR' ? 'UDENAR' : 'EXTERNO'
              onFiltrar?.({ etiqueta: `Afiliación ${s.nombre}`, fn: (d) => d.afiliacion === valor })
            }}
          />
        </ChartCard>
      </RejillaGraficas>

      <RejillaGraficas>
        <ChartCard
          titulo="Docentes por campo de formación"
          subtitulo="Especialidades y líneas que apoya el cuerpo docente"
          tabla={{
            columnas: [
              { clave: 'campo', titulo: 'Campo de formación' },
              { clave: 'cantidad', titulo: 'Docentes', formato: numero },
            ],
            filas: campos,
          }}
          altura={campos.length > 8 ? 'h-96' : 'h-72'}
        >
          <GraficoBarras
            datos={campos}
            ejeX="campo"
            horizontal
            anchoEtiquetas={120}
            series={[{ clave: 'cantidad', nombre: 'Docentes', color: SERIES[2] }]}
            formato={numero}
            onSeleccionar={(c) =>
              onFiltrar?.({
                etiqueta: `Campo: ${c.campo}`,
                fn: (d) => camposDeFormacion(d.campo_formacion).includes(c.campo),
              })
            }
          />
        </ChartCard>

        <ChartCard
          titulo="Cursos por semestre en cada promoción"
          subtitulo="Evolución de la oferta curricular en cada periodo académico"
          tabla={{
            columnas: [
              { clave: 'semestre', titulo: 'Semestre' },
              ...seriesPromociones.map((s) => ({ clave: s.clave, titulo: s.nombre, formato: numero })),
            ],
            filas: evolucion,
          }}
        >
          <GraficoLineas datos={evolucion} ejeX="semestre" series={seriesPromociones} formato={numero} />
        </ChartCard>
      </RejillaGraficas>

      {hayCreditos && (
        <ChartCard
          titulo="Créditos promedio por semestre"
          subtitulo={`${numero(suma(creditos.map((c) => c.creditos)))} créditos según Parámetros del programa (fila «Número de créditos» de la hoja «Cursos y Docentes»)`}
          tabla={{
            columnas: [
              { clave: 'semestre', titulo: 'Semestre' },
              { clave: 'creditos', titulo: 'Créditos', formato: numero },
            ],
            filas: creditos,
          }}
          altura="h-56"
        >
          <GraficoBarras datos={creditos} ejeX="semestre" series={[{ clave: 'creditos', nombre: 'Créditos', color: SERIES[6] }]} formato={numero} />
        </ChartCard>
      )}
    </div>
  )
}
