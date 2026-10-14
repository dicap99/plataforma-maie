import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero, porcentaje } from '../../../utils/formato'
import TarjetaKpi, { Insignia } from '../panel/TarjetaKpi.jsx'
import { FilaIndicadores, RejillaGraficas, SinDatos } from './comunes.jsx'
import { porCohorte, razon, suma } from './estadisticas'

const ROMANOS = ['I', 'II', 'III', 'IV']

// Cursos y docentes por semestre (RF-ADM-01): planta docente UDENAR frente a invitados externos.
export default function PanelCursosDocentes({ filas, cohortes, onFiltrar }) {
  const [idCohorte, setIdCohorte] = useState('')
  const datos = porCohorte(filas, cohortes)
  if (!datos.length) return <SinDatos />

  const cursos = suma(datos.map((f) => f.n_cursos))
  const udenar = suma(datos.map((f) => f.docentes_udenar))
  const externos = suma(datos.map((f) => f.docentes_externos))
  const elegidas = idCohorte ? datos.filter((f) => String(f.id_cohorte) === idCohorte) : datos
  const porSemestre = [1, 2, 3, 4].map((s) => {
    const del = elegidas.filter((f) => f.semestre === s)
    return { semestre: `Semestre ${ROMANOS[s - 1]}`, numero: s, udenar: suma(del.map((f) => f.docentes_udenar)), externos: suma(del.map((f) => f.docentes_externos)) }
  })
  const promociones = cohortes.filter((c) => datos.some((f) => f.id_cohorte === c.id_cohorte))
  const evolucion = [1, 2, 3, 4].map((s) => ({
    semestre: `Semestre ${ROMANOS[s - 1]}`,
    ...Object.fromEntries(promociones.map((c) => [c.nombre, datos.find((f) => f.id_cohorte === c.id_cohorte && f.semestre === s)?.n_cursos ?? null])),
  }))
  const seriesPromociones = promociones.map((c, i) => ({ clave: c.nombre, nombre: `Promoción ${c.nombre}`, color: SERIES[i % SERIES.length] }))
  const nombreElegida = promociones.find((c) => String(c.id_cohorte) === idCohorte)?.nombre

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Cursos ofertados" valor={numero(cursos)} icono="menu_book" destacado>
          <Insignia>{numero(promociones.length)} promociones</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Docentes UDENAR" valor={numero(udenar)} icono="badge">
          <Insignia tono="acento">{porcentaje(razon(udenar, udenar + externos))} de la planta</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Docentes externos" valor={numero(externos)} icono="flight_land">
          <Insignia>{porcentaje(razon(externos, udenar + externos))} de la planta</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Docentes por curso" valor={new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(razon(udenar + externos, cursos) ?? 0)} icono="diversity_3">
          <Insignia tono="neutro">Promedio del rango</Insignia>
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard
          titulo="Docentes UDENAR y externos por semestre"
          subtitulo={`${nombreElegida ? `Promoción ${nombreElegida}` : 'Suma de las promociones'} · clic en un semestre para ver sus registros`}
          acciones={(
            <select aria-label="Promoción" value={idCohorte} onChange={(e) => setIdCohorte(e.target.value)} className="rounded-lg px-2 py-1 text-label-sm">
              <option value="">Todas las promociones</option>
              {promociones.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre}</option>)}
            </select>
          )}
          tabla={{ columnas: [{ clave: 'semestre', titulo: 'Semestre' }, { clave: 'udenar', titulo: 'UDENAR', formato: numero }, { clave: 'externos', titulo: 'Externos', formato: numero }], filas: porSemestre }}
        >
          <GraficoBarras
            datos={porSemestre}
            ejeX="semestre"
            apilado
            series={[{ clave: 'udenar', nombre: 'UDENAR', color: SERIES[0] }, { clave: 'externos', nombre: 'Externos', color: SERIES[1] }]}
            formato={numero}
            onSeleccionar={(s) => onFiltrar({
              etiqueta: `${s.semestre}${nombreElegida ? ` · Promoción ${nombreElegida}` : ''}`,
              fn: (f) => f.semestre === s.numero && (!idCohorte || String(f.id_cohorte) === idCohorte),
            })}
          />
        </ChartCard>

        <ChartCard
          titulo="Cursos por semestre en cada promoción"
          subtitulo="Evolución de la oferta de cursos"
          tabla={{ columnas: [{ clave: 'semestre', titulo: 'Semestre' }, ...seriesPromociones.map((s) => ({ clave: s.clave, titulo: s.nombre, formato: numero }))], filas: evolucion }}
        >
          <GraficoLineas datos={evolucion} ejeX="semestre" series={seriesPromociones} formato={numero} />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}
