import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { fecha, numero, pesos, pesosCompactos, porcentaje } from '../../../utils/formato'
import TarjetaKpi, { BarraProgreso, Insignia } from '../panel/TarjetaKpi.jsx'
import { FilaIndicadores, RejillaGraficas, SinDatos } from '../academico/comunes.jsx'
import { porCohorte, razon, suma } from '../academico/estadisticas'

const ejePesos = (v) => pesosCompactos(v)
const DISTRIBUCION = [
  { clave: 'transferencia_central', nombre: 'Administración central' },
  { clave: 'transferencia_viis', nombre: 'VIIS' },
  { clave: 'fondo_investigaciones', nombre: 'Fondo de Investigaciones' },
  { clave: 'unidad_academica', nombre: 'Unidad Académica' },
]
const tablaDe = (filas, columnas) => ({ columnas, filas })

// Resumen de ejecución presupuestal (RF-ADM-03): último corte de cada promoción.
export function PanelResumen({ resumen, cohortes, onFiltrar }) {
  const ids = new Set(cohortes.map((c) => c.id_cohorte))
  const orden = new Map(cohortes.map((c, i) => [c.id_cohorte, i]))
  const filas = (resumen?.filas ?? []).filter((f) => ids.has(f.id_cohorte)).sort((a, b) => orden.get(a.id_cohorte) - orden.get(b.id_cohorte))
    .map((f) => ({ ...f, promocion: f.cohorte }))
  if (!filas.length) return <SinDatos texto="No hay cortes de presupuesto para estas promociones." />

  const ingresos = suma(filas.map((f) => f.ingresos))
  const gastos = suma(filas.map((f) => f.gastos_comprometidos))
  const ejecucion = razon(gastos, ingresos)
  const sobregiro = filas.filter((f) => (f.pct_ejecucion ?? 0) > 1)
  const filtrar = (f) => onFiltrar({ recurso: 'presupuesto', etiqueta: `Promoción ${f.promocion}`, fn: (x) => x.id_cohorte === f.id_cohorte })

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Ingresos" valor={pesosCompactos(ingresos)} icono="savings" destacado><Insignia>{pesos(ingresos)}</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Gastos comprometidos" valor={pesosCompactos(gastos)} icono="receipt_long"><Insignia tono="neutro">{pesos(gastos)}</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Saldo" valor={pesosCompactos(ingresos - gastos)} icono="account_balance_wallet"><Insignia tono="acento">Ingresos − gastos</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Ejecución" valor={porcentaje(ejecucion)} icono="speed">
          <BarraProgreso fraccion={ejecucion} />
          {sobregiro.length > 0 && <p className="mt-2 text-body-sm text-error">Sobregiro en {sobregiro.map((f) => f.promocion).join(', ')}</p>}
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard titulo="Ingresos y gastos por promoción" subtitulo={`Último corte (${fecha(resumen.fecha_corte)}) · clic para ver los cortes`}
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'ingresos', titulo: 'Ingresos', formato: pesos }, { clave: 'gastos_comprometidos', titulo: 'Gastos', formato: pesos }])}>
          <GraficoBarras datos={filas} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
            series={[{ clave: 'ingresos', nombre: 'Ingresos', color: SERIES[0] }, { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos', color: SERIES[1] }]} />
        </ChartCard>
        <ChartCard titulo="Ejecución por promoción" subtitulo="Gastos comprometidos sobre ingresos; más de 100 % es sobregiro"
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'pct_ejecucion', titulo: 'Ejecución', formato: porcentaje }])}>
          <GraficoBarras datos={filas} ejeX="promocion" horizontal anchoEtiquetas={110} formato={porcentaje} onSeleccionar={filtrar}
            series={[{ clave: 'pct_ejecucion', nombre: 'Ejecución', color: SERIES[6] }]} />
        </ChartCard>
      </RejillaGraficas>

      <ChartCard titulo="Distribución del saldo por promoción" subtitulo="Registrada en el corte o calculada con los porcentajes de Parámetros"
        tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, ...DISTRIBUCION.map((d) => ({ clave: d.clave, titulo: d.nombre, formato: pesos }))])}>
        <GraficoBarras datos={filas} ejeX="promocion" apilado formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
          series={DISTRIBUCION.map((d, i) => ({ ...d, color: SERIES[i + 2] }))} />
      </ChartCard>
    </div>
  )
}

// Punto de equilibrio (RF-ADM-03): estudiantes necesarios frente a matriculados.
export function PanelPuntoEquilibrio({ filas, cohortes, onFiltrar }) {
  const datos = porCohorte(filas, cohortes).map((f) => ({ ...f, matriculados: cohortes.find((c) => c.id_cohorte === f.id_cohorte)?.matriculados ?? null }))
  if (!datos.length) return <SinDatos />
  const sobre = datos.filter((f) => (f.matriculados ?? 0) >= f.estudiantes_equilibrio)
  const filtrar = (f) => onFiltrar({ etiqueta: `Promoción ${f.promocion}`, fn: (x) => x.id_cohorte === f.id_cohorte })
  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Ingresos proyectados" valor={pesosCompactos(suma(datos.map((f) => f.ingresos_proyectados)))} icono="trending_up" destacado>
          <Insignia>Suma del rango</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Promociones en equilibrio" valor={`${sobre.length} de ${datos.length}`} icono="balance">
          <BarraProgreso fraccion={razon(sobre.length, datos.length)} />
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Estudiantes de equilibrio" valor={numero(suma(datos.map((f) => f.estudiantes_equilibrio)) / datos.length)} icono="groups">
          <Insignia tono="neutro">Promedio por promoción</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Matrícula" valor={`${numero(suma(datos.map((f) => f.valor_matricula_smmlv)) / datos.length)} SMMLV`} icono="payments">
          <Insignia tono="neutro">Promedio por semestre</Insignia>
        </TarjetaKpi>
      </FilaIndicadores>
      <RejillaGraficas>
        <ChartCard titulo="Matriculados frente al punto de equilibrio" subtitulo="Clic en una promoción para ver su registro"
          tabla={tablaDe(datos, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'matriculados', titulo: 'Matriculados', formato: numero }, { clave: 'estudiantes_equilibrio', titulo: 'Equilibrio', formato: numero }])}>
          <GraficoBarras datos={datos} ejeX="promocion" formato={numero} onSeleccionar={filtrar}
            series={[{ clave: 'matriculados', nombre: 'Matriculados', color: SERIES[0] }, { clave: 'estudiantes_equilibrio', nombre: 'Estudiantes de equilibrio', color: SERIES[3] }]} />
        </ChartCard>
        <ChartCard titulo="Ingresos proyectados por promoción" subtitulo="Valor total de la matrícula de la promoción"
          tabla={tablaDe(datos, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'ingresos_proyectados', titulo: 'Ingresos proyectados', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
            series={[{ clave: 'ingresos_proyectados', nombre: 'Ingresos proyectados', color: SERIES[2] }]} />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}

// Presupuesto por promoción: evolución de los cortes de una promoción.
export function PanelPresupuesto({ filas, cohortes, onFiltrar }) {
  const datos = porCohorte(filas, cohortes)
  const promociones = cohortes.filter((c) => datos.some((f) => f.id_cohorte === c.id_cohorte))
  const [id, setId] = useState(null)
  if (!datos.length) return <SinDatos texto="No hay cortes de presupuesto para estas promociones." />
  const elegida = promociones.find((c) => c.id_cohorte === id) ?? promociones.at(-1)
  const cortes = datos.filter((f) => f.id_cohorte === elegida.id_cohorte).sort((a, b) => (a.fecha_corte < b.fecha_corte ? -1 : 1))
    .map((f) => ({ ...f, corte: fecha(f.fecha_corte), saldo: f.ingresos - f.gastos_comprometidos }))
  const ultimos = promociones.map((c) => datos.filter((f) => f.id_cohorte === c.id_cohorte).sort((a, b) => (a.fecha_corte < b.fecha_corte ? 1 : -1))[0])
  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Cortes registrados" valor={numero(datos.length)} icono="event_note" destacado><Insignia>{promociones.length} promociones</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Corte más reciente" valor={fecha(datos.map((f) => f.fecha_corte).sort().at(-1))} icono="today"><Insignia tono="neutro">Fecha de corte</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Saldo certificado" valor={pesosCompactos(suma(ultimos.map((f) => f.saldo_certificado)))} icono="verified"><Insignia tono="neutro">Último corte de cada promoción</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Saldo comprometido" valor={pesosCompactos(suma(ultimos.map((f) => f.ingresos - f.gastos_comprometidos)))} icono="account_balance_wallet"><Insignia tono="neutro">Ingresos − gastos</Insignia></TarjetaKpi>
      </FilaIndicadores>
      <ChartCard titulo="Evolución de los cortes" subtitulo={`Promoción ${elegida.nombre}`}
        acciones={(
          <select aria-label="Promoción" value={elegida.id_cohorte} onChange={(e) => setId(Number(e.target.value))} className="rounded-lg px-2 py-1 text-label-sm">
            {promociones.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre}</option>)}
          </select>
        )}
        tabla={tablaDe(cortes, [{ clave: 'corte', titulo: 'Corte' }, { clave: 'ingresos', titulo: 'Ingresos', formato: pesos }, { clave: 'gastos_comprometidos', titulo: 'Gastos', formato: pesos }, { clave: 'saldo', titulo: 'Saldo', formato: pesos }])}>
        <GraficoLineas datos={cortes} ejeX="corte" formato={pesos} formatoEje={ejePesos}
          series={[{ clave: 'ingresos', nombre: 'Ingresos', color: SERIES[0] }, { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos', color: SERIES[1] }, { clave: 'saldo', nombre: 'Saldo', color: SERIES[2] }]} />
      </ChartCard>
      <button type="button" className="btn-enlace self-start" onClick={() => onFiltrar({ etiqueta: `Promoción ${elegida.nombre}`, fn: (x) => x.id_cohorte === elegida.id_cohorte })}>
        Ver los cortes de la promoción {elegida.nombre} en «Datos»
      </button>
    </div>
  )
}

// Estudiantes de pregrado en cursos de la maestría.
export function PanelPregrado({ filas, cohortes, onFiltrar }) {
  const datos = porCohorte(filas, cohortes)
  if (!datos.length) return <SinDatos />
  const periodos = [...new Set(datos.map((f) => f.periodo))].sort().map((p) => {
    const del = datos.filter((f) => f.periodo === p)
    return { periodo: p, estudiantes: suma(del.map((f) => f.estudiantes)), inscripciones: suma(del.map((f) => f.inscripciones)), ingreso: suma(del.map((f) => f.ingreso)) }
  })
  const filtrar = (p) => onFiltrar({ etiqueta: `Periodo ${p.periodo}`, fn: (x) => x.periodo === p.periodo })
  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Estudiantes de pregrado" valor={numero(suma(datos.map((f) => f.estudiantes)))} icono="school" destacado><Insignia>{periodos.length} periodos</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Inscripciones" valor={numero(suma(datos.map((f) => f.inscripciones)))} icono="how_to_reg"><Insignia tono="neutro">Cursos inscritos</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Ingreso" valor={pesosCompactos(suma(datos.map((f) => f.ingreso)))} icono="payments"><Insignia tono="neutro">{pesos(suma(datos.map((f) => f.ingreso)))}</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Ingreso por periodo" valor={pesosCompactos(suma(periodos.map((p) => p.ingreso)) / periodos.length)} icono="calendar_month"><Insignia tono="neutro">Promedio</Insignia></TarjetaKpi>
      </FilaIndicadores>
      <RejillaGraficas>
        <ChartCard titulo="Estudiantes e inscripciones por periodo" subtitulo="Clic en un periodo para ver sus registros"
          tabla={tablaDe(periodos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'estudiantes', titulo: 'Estudiantes', formato: numero }, { clave: 'inscripciones', titulo: 'Inscripciones', formato: numero }])}>
          <GraficoBarras datos={periodos} ejeX="periodo" formato={numero} onSeleccionar={filtrar}
            series={[{ clave: 'estudiantes', nombre: 'Estudiantes', color: SERIES[0] }, { clave: 'inscripciones', nombre: 'Inscripciones', color: SERIES[6] }]} />
        </ChartCard>
        <ChartCard titulo="Ingreso por periodo" subtitulo="Aporte del pregrado a los ingresos del programa"
          tabla={tablaDe(periodos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'ingreso', titulo: 'Ingreso', formato: pesos }])}>
          <GraficoLineas datos={periodos} ejeX="periodo" formato={pesos} formatoEje={ejePesos} series={[{ clave: 'ingreso', nombre: 'Ingreso', color: SERIES[2] }]} />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}

// Transferencias a la Vicerrectoría Académica y contrataciones OPS: cantidad y valor por periodo.
export function PanelPorPeriodo({ filas, onFiltrar, config }) {
  if (!filas.length) return <SinDatos texto="No hay registros." />
  const datos = [...filas].sort((a, b) => (a.periodo < b.periodo ? -1 : 1)).map((f) => ({ ...f, promedio: razon(f.valor, f[config.cantidad]) }))
  const total = suma(datos.map((f) => f.valor))
  const cantidad = suma(datos.map((f) => f[config.cantidad]))
  const filtrar = (p) => onFiltrar({ etiqueta: `Periodo ${p.periodo}`, fn: (x) => x.periodo === p.periodo })
  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta={`Valor total`} valor={pesosCompactos(total)} icono={config.icono} destacado><Insignia>{pesos(total)}</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta={config.nombreCantidad} valor={numero(cantidad)} icono="tag"><Insignia tono="neutro">Suma de los periodos</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta={`Valor por ${config.unidad}`} valor={pesosCompactos(razon(total, cantidad))} icono="calculate"><Insignia tono="neutro">Promedio</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Periodos" valor={numero(datos.length)} icono="calendar_month"><Insignia tono="neutro">{datos[0].periodo} a {datos.at(-1).periodo}</Insignia></TarjetaKpi>
      </FilaIndicadores>
      <RejillaGraficas>
        <ChartCard titulo={`Valor de ${config.titulo.toLowerCase()} por periodo`} subtitulo="Clic en un periodo para ver su registro"
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'valor', titulo: 'Valor', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="periodo" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
            series={[{ clave: 'valor', nombre: 'Valor', color: SERIES[0] }]} />
        </ChartCard>
        <ChartCard titulo={`${config.nombreCantidad} por periodo`} subtitulo={`La tabla incluye el valor medio por ${config.unidad}`}
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: config.cantidad, titulo: config.nombreCantidad, formato: numero }, { clave: 'promedio', titulo: 'Promedio', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="periodo" formato={numero} onSeleccionar={filtrar}
            series={[{ clave: config.cantidad, nombre: config.nombreCantidad, color: SERIES[6] }]} />
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}

export const TRANSFERENCIAS = { titulo: 'Transferencias', cantidad: 'n_docentes', nombreCantidad: 'Docentes', unidad: 'docente', icono: 'swap_horiz' }
export const CONTRATACIONES = { titulo: 'Contrataciones OPS', cantidad: 'n_ops', nombreCantidad: 'Contratos OPS', unidad: 'contrato', icono: 'contract' }
