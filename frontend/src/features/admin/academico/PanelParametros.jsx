import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { numero, pesos } from '../../../utils/formato'
import TarjetaKpi, { Insignia } from '../panel/TarjetaKpi.jsx'
import { FilaIndicadores, RejillaGraficas, SinDatos } from './comunes.jsx'
import { smmlvVigente } from './estadisticas'

const ROMANOS = ['I', 'II', 'III', 'IV']
const DISTRIBUCION = [
  { clave: 'pct_transferencia_central', nombre: 'Administración central' },
  { clave: 'pct_transferencia_viis', nombre: 'VIIS' },
  { clave: 'pct_fondo_investigaciones', nombre: 'Fondo de Investigaciones' },
  { clave: 'pct_unidad_academica', nombre: 'Unidad Académica' },
]

// Parámetros del programa (RF-ADM-05): valores que usan los cálculos de presupuesto y del plan.
export default function PanelParametros({ filas }) {
  if (!filas.length) return <SinDatos texto="No hay parámetros registrados." />

  const valor = (clave) => filas.find((p) => p.clave === clave)?.valor ?? null
  const smmlv = smmlvVigente(Object.fromEntries(filas.map((p) => [p.clave, p.valor])))
  const creditos = [1, 2, 3, 4].map((s) => ({ semestre: `Semestre ${ROMANOS[s - 1]}`, creditos: valor(`creditos_semestre_${s}`) }))
  const totalCreditos = creditos.reduce((s, c) => s + (c.creditos ?? 0), 0)
  const reparto = { fila: 'Saldo', ...Object.fromEntries(DISTRIBUCION.map((d) => [d.clave, valor(d.clave)])) }
  const sumaReparto = DISTRIBUCION.reduce((s, d) => s + (reparto[d.clave] ?? 0), 0)
  const meta = valor('meta_ra_satisfactorio_pct')

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta={smmlv ? `SMMLV ${smmlv.anio}` : 'SMMLV'} valor={smmlv ? pesos(smmlv.valor) : '—'} icono="payments" destacado>
          <Insignia>Vigente · base del valor de matrícula</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Créditos del plan" valor={numero(totalCreditos)} icono="school">
          <Insignia tono="neutro">Suma de los 4 semestres</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Reparto del saldo" valor={`${numero(sumaReparto)} %`} icono="pie_chart">
          <Insignia tono={sumaReparto === 100 ? 'acento' : 'neutro'}>{sumaReparto === 100 ? 'Distribución completa' : 'No suma 100 %'}</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Meta de RA" valor={meta === null ? '—' : `${numero(meta)} %`} icono="military_tech">
          <Insignia tono="neutro">En nivel Alto o Medio</Insignia>
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard
          titulo="Distribución del saldo presupuestal"
          subtitulo="Porcentaje del saldo de cada promoción que se transfiere a cada destino"
          tabla={{ columnas: [{ clave: 'nombre', titulo: 'Destino' }, { clave: 'valor', titulo: '%', formato: numero }], filas: DISTRIBUCION.map((d) => ({ nombre: d.nombre, valor: reparto[d.clave] })) }}
          altura="h-40"
        >
          <GraficoBarras datos={[reparto]} ejeX="fila" horizontal apilado anchoEtiquetas={50}
            series={DISTRIBUCION.map((d, i) => ({ clave: d.clave, nombre: d.nombre, color: SERIES[i] }))} formato={(v) => `${numero(v)} %`} />
        </ChartCard>

        <ChartCard
          titulo="Créditos por semestre"
          subtitulo={`${numero(totalCreditos)} créditos en el plan de estudios`}
          tabla={{ columnas: [{ clave: 'semestre', titulo: 'Semestre' }, { clave: 'creditos', titulo: 'Créditos', formato: numero }], filas: creditos }}
          altura="h-40"
        >
          <GraficoBarras datos={creditos} ejeX="semestre" series={[{ clave: 'creditos', nombre: 'Créditos', color: SERIES[6] }]} formato={numero} />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}
