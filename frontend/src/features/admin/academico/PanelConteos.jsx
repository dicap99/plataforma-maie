import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoDona from '../../../components/charts/GraficoDona.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero, porcentaje } from '../../../utils/formato'
import { Alternador, RejillaGraficas, SinDatos } from './comunes.jsx'
import { porCohorte, relativo, suma } from './estadisticas'

const dosDecimales = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

// Hojas con conteos por promoción (beneficios, producción científica, pasantías): composición por
// tipo y comparación entre promociones, en cantidad o relativo a la población de cada promoción.
// `config` = { titulo, etiquetaTotal, columnas: [{ clave, nombre }], relativo: { etiqueta, porcentaje }, apilado, nota }
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
  nota: 'La población de referencia de cada promoción es su último corte con dato (egresados, aprobados o matriculados).',
}
