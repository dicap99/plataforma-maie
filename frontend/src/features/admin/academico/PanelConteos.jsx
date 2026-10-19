import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoDona from '../../../components/charts/GraficoDona.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero, porcentaje } from '../../../utils/formato'
import { Alternador, RejillaGraficas, SinDatos } from './comunes.jsx'
import { porCohorte, razon, relativo, suma } from './estadisticas'

const dosDecimales = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

// Hojas con conteos por promoción (beneficios, producción científica, pasantías): composición por
// tipo y comparación entre promociones, en cantidad o relativo a la población de cada promoción.
// `config` = { columnas: [{ clave, nombre }], relativo: { etiqueta, porcentaje }, kpis(datos), apilado, dona }
export default function PanelConteos({ filas, cohortes, onFiltrar, config }) {
  const [modo, setModo] = useState('cantidad')
  const datos = porCohorte(filas, cohortes)
  if (!datos.length) return <SinDatos />

  const columnas = config.columnas.map((c, i) => ({ ...c, color: c.color ?? SERIES[i] }))
  const claves = columnas.map((c) => c.clave)
  const conTotal = datos.map((f) => ({ ...f, total: suma(claves.map((c) => f[c])) }))
  const formatoRel = config.relativo.porcentaje ? porcentaje : (v) => (v === null || v === undefined ? '—' : dosDecimales.format(v))
  const formato = modo === 'cantidad' ? numero : formatoRel
  const serie = modo === 'cantidad' ? conTotal : relativo(conTotal, claves)
  const totales = Object.fromEntries(claves.map((c) => [c, suma(conTotal.map((f) => f[c]))]))
  const total = suma(Object.values(totales))
  const poblacion = suma(conTotal.map((f) => f.poblacion))
  const composicion = columnas.map((c) => ({ nombre: c.nombre, valor: totales[c.clave], color: c.color }))
  const modos = [{ valor: 'cantidad', etiqueta: 'Cantidad' }, { valor: 'relativo', etiqueta: config.relativo.etiqueta }]

  const tablaPromociones = {
    columnas: [{ clave: 'promocion', titulo: 'Promoción' }, ...columnas.map((c) => ({ clave: c.clave, titulo: c.nombre, formato }))],
    filas: serie,
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <RejillaGraficas>
        <ChartCard
          titulo={`${config.titulo} por promoción`}
          subtitulo={`${modo === 'cantidad' ? 'Cantidad' : config.relativo.etiqueta} · clic en una promoción para ver su registro`}
          acciones={<Alternador etiqueta="Unidad" opciones={modos} valor={modo} onChange={setModo} />}
          tabla={tablaPromociones}
        >
          <GraficoBarras
            datos={serie}
            ejeX="promocion"
            apilado={config.apilado}
            series={columnas}
            formato={formato}
            onSeleccionar={(f) => onFiltrar({ etiqueta: `Promoción ${f.promocion}`, fn: (x) => x.id_cohorte === f.id_cohorte })}
          />
        </ChartCard>

        <ChartCard
          titulo={`Composición de ${config.titulo.toLowerCase()}`}
          subtitulo={`Total del rango: ${numero(total)}`}
          tabla={{ columnas: [{ clave: 'nombre', titulo: 'Tipo' }, { clave: 'valor', titulo: 'Cantidad', formato: numero }], filas: composicion }}
        >
          {total ? <GraficoDona datos={composicion} formato={numero} etiquetaTotal={config.etiquetaTotal} />
            : <SinDatos texto="Aún no hay registros en este rango." />}
        </ChartCard>
      </RejillaGraficas>
      {config.nota && <p className="m-0 text-body-sm text-on-surface-variant">{config.nota}</p>}
    </div>
  )
}

// Configuración de cada hoja.
export const BENEFICIOS = {
  titulo: 'Beneficios',
  etiquetaTotal: 'beneficios',
  apilado: true,
  relativo: { etiqueta: '% de la población', porcentaje: true },
  columnas: [
    { clave: 'becas_100', nombre: 'Becas 100 %' },
    { clave: 'becas_hora_catedra', nombre: 'Becas hora cátedra' },
    { clave: 'becas_sintraunicol', nombre: 'Becas SINTRAUNICOL' },
    { clave: 'asistentes_investigacion', nombre: 'Asistentes de investigación' },
    { clave: 'ayudantes_docencia', nombre: 'Ayudantes de docencia' },
  ],
  kpis: ({ totales, total, poblacion }) => [
    { etiqueta: 'Beneficios otorgados', valor: numero(total), icono: 'volunteer_activism', destacado: true, nota: 'Suma del rango' },
    { etiqueta: 'Relación con la población', valor: porcentaje(razon(total, poblacion)), icono: 'groups', fraccion: razon(total, poblacion) },
    { etiqueta: 'Becas del 100 %', valor: numero(totales.becas_100), icono: 'workspace_premium', nota: 'Exención total de matrícula' },
    { etiqueta: 'Asistentes y ayudantes', valor: numero(totales.asistentes_investigacion + totales.ayudantes_docencia), icono: 'science', nota: 'Investigación y docencia' },
  ],
  nota: 'La población de referencia de cada promoción es su último corte con dato (egresados, aprobados o matriculados).',
}

export const PRODUCCION = {
  titulo: 'Producción científica',
  etiquetaTotal: 'productos',
  apilado: true,
  relativo: { etiqueta: 'Por estudiante', porcentaje: false },
  columnas: [
    { clave: 'articulos', nombre: 'Artículos' },
    { clave: 'ponencias', nombre: 'Ponencias' },
    { clave: 'software', nombre: 'Software' },
    { clave: 'prototipos', nombre: 'Prototipos' },
    { clave: 'tesis', nombre: 'Tesis' },
  ],
  kpis: ({ totales, total, poblacion }) => [
    { etiqueta: 'Productos registrados', valor: numero(total), icono: 'auto_stories', destacado: true, nota: 'Suma del rango' },
    { etiqueta: 'Artículos', valor: numero(totales.articulos), icono: 'article', nota: `${numero(totales.ponencias)} ponencias` },
    { etiqueta: 'Tesis', valor: numero(totales.tesis), icono: 'school', nota: 'Trabajos de grado' },
    { etiqueta: 'Productos por estudiante', valor: dosDecimales.format(razon(total, poblacion) ?? 0), icono: 'person', nota: 'Sobre la población del rango' },
  ],
  nota: 'El detalle de cada producto está en la vista «Datos», botón «Detalles» de cada promoción.',
}

export const PASANTIAS = {
  titulo: 'Pasantías',
  etiquetaTotal: 'pasantías',
  apilado: false,
  relativo: { etiqueta: '% de la población', porcentaje: true },
  columnas: [
    { clave: 'nacionales', nombre: 'Nacionales' },
    { clave: 'internacionales', nombre: 'Internacionales' },
  ],
  kpis: ({ totales, total, poblacion }) => [
    { etiqueta: 'Pasantías', valor: numero(total), icono: 'travel_explore', destacado: true, nota: 'Suma del rango' },
    { etiqueta: 'Nacionales', valor: numero(totales.nacionales), icono: 'location_on', fraccion: razon(totales.nacionales, total) },
    { etiqueta: 'Internacionales', valor: numero(totales.internacionales), icono: 'public', fraccion: razon(totales.internacionales, total) },
    { etiqueta: 'Relación con la población', valor: porcentaje(razon(total, poblacion)), icono: 'groups', fraccion: razon(total, poblacion) },
  ],
}
