import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoDona from '../../../components/charts/GraficoDona.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero, porcentaje } from '../../../utils/formato'
import { Alternador, RejillaGraficas, SinDatos } from './comunes.jsx'
import { porCohorte, relativo, suma } from './estadisticas'

const dosDecimales = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

const COLUMNAS_PRODUCCION = [
  { clave: 'articulos', nombre: 'Artículos', color: SERIES[0] },
  { clave: 'ponencias', nombre: 'Ponencias', color: SERIES[1] },
  { clave: 'software', nombre: 'Software', color: SERIES[2] },
  { clave: 'prototipos', nombre: 'Prototipos', color: SERIES[3] },
  { clave: 'tesis', nombre: 'Tesis', color: SERIES[4] },
]

const COLUMNAS_PASANTIAS = [
  { clave: 'nacionales', nombre: 'Pasantías nacionales', color: SERIES[2] },
  { clave: 'internacionales', nombre: 'Pasantías internacionales', color: SERIES[5] },
]

// Investigación, Producción y Movilidad (RF-ADM-04):
// Unifica el impacto científico de la maestría (artículos, ponencias, software, prototipos, tesis)
// con las pasantías de investigación nacionales e internacionales.
export default function PanelInvestigacionMovilidad({
  filasProduccion = [],
  filasPasantias = [],
  cohortes = [],
  onFiltrar,
}) {
  const [modoProd, setModoProd] = useState('cantidad')
  const [modoPas, setModoPas] = useState('cantidad')

  const datosProd = porCohorte(filasProduccion, cohortes)
  const datosPas = porCohorte(filasPasantias, cohortes)

  if (!datosProd.length && !datosPas.length) {
    return <SinDatos texto="No hay datos de producción ni pasantías registrados en este rango." />
  }

  // Totales de Producción
  const clavesProd = COLUMNAS_PRODUCCION.map((c) => c.clave)
  const conTotalProd = datosProd.map((f) => ({ ...f, total: suma(clavesProd.map((c) => f[c])) }))
  const totalesProd = Object.fromEntries(clavesProd.map((c) => [c, suma(conTotalProd.map((f) => f[c]))]))

  // Totales de Pasantías
  const clavesPas = COLUMNAS_PASANTIAS.map((c) => c.clave)
  const conTotalPas = datosPas.map((f) => ({ ...f, total: suma(clavesPas.map((c) => f[c])) }))
  const totalesPas = Object.fromEntries(clavesPas.map((c) => [c, suma(conTotalPas.map((f) => f[c]))]))

  const poblacion = suma(conTotalProd.map((f) => f.poblacion))

  // Series para gráficos
  const serieProd = modoProd === 'cantidad' ? conTotalProd : relativo(conTotalProd, clavesProd)
  const formatoProd = modoProd === 'cantidad' ? numero : (v) => (v === null || v === undefined ? '—' : dosDecimales.format(v))

  const seriePas = modoPas === 'cantidad' ? conTotalPas : relativo(conTotalPas, clavesPas)
  const formatoPas = modoPas === 'cantidad' ? numero : porcentaje

  const composicionProd = COLUMNAS_PRODUCCION.map((c) => ({
    nombre: c.nombre,
    valor: totalesProd[c.clave] ?? 0,
    color: c.color,
  }))

  const composicionPas = [
    { nombre: 'Nacionales', valor: totalesPas.nacionales ?? 0, color: SERIES[2] },
    { nombre: 'Internacionales', valor: totalesPas.internacionales ?? 0, color: SERIES[5] },
  ]

  const modosProd = [
    { valor: 'cantidad', etiqueta: 'Cantidad' },
    { valor: 'relativo', etiqueta: 'Por estudiante' },
  ]
  const modosPas = [
    { valor: 'cantidad', etiqueta: 'Cantidad' },
    { valor: 'relativo', etiqueta: '% de población' },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <RejillaGraficas>
        <ChartCard
          titulo="Producción científica por promoción"
          subtitulo={`${modoProd === 'cantidad' ? 'Cantidad de productos' : 'Productos por estudiante'} · clic en una barra para filtrar`}
          acciones={<Alternador etiqueta="Unidad" opciones={modosProd} valor={modoProd} onChange={setModoProd} />}
          tabla={{
            columnas: [
              { clave: 'promocion', titulo: 'Promoción' },
              ...COLUMNAS_PRODUCCION.map((c) => ({ clave: c.clave, titulo: c.nombre, formato: formatoProd })),
            ],
            filas: serieProd,
          }}
        >
          <GraficoBarras
            datos={serieProd}
            ejeX="promocion"
            apilado
            series={COLUMNAS_PRODUCCION}
            formato={formatoProd}
            onSeleccionar={(p) => onFiltrar?.({ etiqueta: `Promoción ${p.promocion}`, fn: (f) => f.id_cohorte === p.id_cohorte })}
          />
        </ChartCard>

        <ChartCard
          titulo="Composición de la producción científica"
          subtitulo="Distribución de la tipología de productos del programa"
          tabla={{
            columnas: [
              { clave: 'nombre', titulo: 'Tipo de producto' },
              { clave: 'valor', titulo: 'Cantidad', formato: numero },
            ],
            filas: composicionProd,
          }}
        >
          <GraficoDona datos={composicionProd} formato={numero} etiquetaTotal="productos" />
        </ChartCard>
      </RejillaGraficas>

      <RejillaGraficas>
        <ChartCard
          titulo="Pasantías de investigación por promoción"
          subtitulo={`${modoPas === 'cantidad' ? 'Cantidad de pasantías' : '% de la población'} · nacionales e internacionales`}
          acciones={<Alternador etiqueta="Unidad" opciones={modosPas} valor={modoPas} onChange={setModoPas} />}
          tabla={{
            columnas: [
              { clave: 'promocion', titulo: 'Promoción' },
              ...COLUMNAS_PASANTIAS.map((c) => ({ clave: c.clave, titulo: c.nombre, formato: formatoPas })),
            ],
            filas: seriePas,
          }}
        >
          <GraficoBarras
            datos={seriePas}
            ejeX="promocion"
            series={COLUMNAS_PASANTIAS}
            formato={formatoPas}
            onSeleccionar={(p) => onFiltrar?.({ etiqueta: `Promoción ${p.promocion}`, fn: (f) => f.id_cohorte === p.id_cohorte })}
          />
        </ChartCard>

        <ChartCard
          titulo="Movilidad nacional vs. internacional"
          subtitulo="Destino de las estancias de investigación estudiantiles"
          tabla={{
            columnas: [
              { clave: 'nombre', titulo: 'Ámbito' },
              { clave: 'valor', titulo: 'Pasantías', formato: numero },
            ],
            filas: composicionPas,
          }}
        >
          <GraficoDona datos={composicionPas} formato={numero} etiquetaTotal="pasantías" />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}
