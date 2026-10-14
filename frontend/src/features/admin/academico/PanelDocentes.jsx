import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoDona from '../../../components/charts/GraficoDona.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero, porcentaje } from '../../../utils/formato'
import TarjetaKpi, { BarraProgreso, Insignia } from '../panel/TarjetaKpi.jsx'
import { FilaIndicadores, RejillaGraficas, SinDatos } from './comunes.jsx'
import { camposDeFormacion, docentesPorCampo, razon } from './estadisticas'

// Docentes UDENAR y externos (RF-ADM-06): afiliación y campos de formación de la planta.
export default function PanelDocentes({ filas, onFiltrar }) {
  if (!filas.length) return <SinDatos texto="No hay docentes registrados." />

  const udenar = filas.filter((d) => d.afiliacion === 'UDENAR').length
  const externos = filas.filter((d) => d.afiliacion === 'EXTERNO').length
  const campos = docentesPorCampo(filas)
  const afiliacion = [
    { nombre: 'UDENAR', valor: udenar, color: SERIES[0] },
    { nombre: 'Externos', valor: externos, color: SERIES[1] },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Docentes registrados" valor={numero(filas.length)} icono="badge" destacado>
          <Insignia>Hoja «Docentes UDENAR-EXTERNOS»</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="UDENAR" valor={porcentaje(razon(udenar, filas.length))} icono="account_balance">
          <BarraProgreso fraccion={razon(udenar, filas.length)} />
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Externos" valor={porcentaje(razon(externos, filas.length))} icono="flight_land">
          <BarraProgreso fraccion={razon(externos, filas.length)} />
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Campos de formación" valor={numero(campos.length)} icono="hub">
          <Insignia tono="neutro">Más frecuente: {campos[0]?.campo ?? '—'}</Insignia>
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard
          titulo="Afiliación de la planta docente"
          subtitulo="Clic en un sector para ver esos docentes"
          tabla={{ columnas: [{ clave: 'nombre', titulo: 'Afiliación' }, { clave: 'valor', titulo: 'Docentes', formato: numero }], filas: afiliacion }}
        >
          <GraficoDona datos={afiliacion} formato={numero} etiquetaTotal="docentes"
            onSeleccionar={(s) => {
              const valor = s.nombre === 'UDENAR' ? 'UDENAR' : 'EXTERNO'
              onFiltrar({ etiqueta: `Afiliación ${s.nombre}`, fn: (d) => d.afiliacion === valor })
            }} />
        </ChartCard>

        <ChartCard
          titulo="Docentes por campo de formación"
          subtitulo="Un docente puede contar en varios campos · clic en una barra para filtrar"
          tabla={{ columnas: [{ clave: 'campo', titulo: 'Campo de formación' }, { clave: 'cantidad', titulo: 'Docentes', formato: numero }], filas: campos }}
          altura={campos.length > 8 ? 'h-96' : 'h-72'}
        >
          <GraficoBarras
            datos={campos}
            ejeX="campo"
            horizontal
            anchoEtiquetas={190}
            series={[{ clave: 'cantidad', nombre: 'Docentes', color: SERIES[6] }]}
            formato={numero}
            onSeleccionar={(c) => onFiltrar({ etiqueta: `Campo: ${c.campo}`, fn: (d) => camposDeFormacion(d.campo_formacion).includes(c.campo) })}
          />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}
