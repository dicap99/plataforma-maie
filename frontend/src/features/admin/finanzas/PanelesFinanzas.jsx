import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { fecha, numero, pesos, pesosCompactos, porcentaje } from '../../../utils/formato'
import TarjetaKpi, { BarraProgreso, Insignia } from '../panel/TarjetaKpi.jsx'
import { FilaIndicadores, RejillaGraficas, SinDatos } from '../academico/comunes.jsx'
import { porCohorte, razon, suma } from '../academico/estadisticas'

// Paneles de «Presupuesto y finanzas». `onFiltrar({ hoja, etiqueta, fn })` abre «Datos» en la hoja
// indicada, filtrada a la promoción o al periodo en que se hizo clic.

const ejePesos = (v) => pesosCompactos(v)
const DISTRIBUCION = [
  { clave: 'transferencia_central', nombre: 'Administración central' },
  { clave: 'transferencia_viis', nombre: 'VIIS' },
  { clave: 'fondo_investigaciones', nombre: 'Fondo de Investigaciones' },
  { clave: 'unidad_academica', nombre: 'Unidad Académica' },
]
const tablaDe = (filas, columnas) => ({ columnas, filas })
const porPromocion = (hoja) => (f) => ({ hoja, etiqueta: `Promoción ${f.promocion}`, fn: (x) => x.id_cohorte === f.id_cohorte })
const porPeriodoEn = (hoja) => (f) => ({ hoja, etiqueta: `Periodo ${f.periodo}`, fn: (x) => x.periodo === f.periodo })

// Último corte de cada promoción del rango, en el orden de las promociones.
const ultimosCortes = (resumen, cohortes) => {
  const orden = new Map(cohortes.map((c, i) => [c.id_cohorte, i]))
  return (resumen?.filas ?? []).filter((f) => orden.has(f.id_cohorte))
    .sort((a, b) => orden.get(a.id_cohorte) - orden.get(b.id_cohorte))
    .map((f) => ({ ...f, promocion: f.cohorte }))
}

// Evolución de los cortes de una promoción elegida.
function EvolucionCortes({ filas, cohortes, onFiltrar }) {
  const datos = porCohorte(filas, cohortes)
  const promociones = cohortes.filter((c) => datos.some((f) => f.id_cohorte === c.id_cohorte))
  const [id, setId] = useState(null)
  if (!promociones.length) return null
  const elegida = promociones.find((c) => c.id_cohorte === id) ?? promociones.at(-1)
  const cortes = datos.filter((f) => f.id_cohorte === elegida.id_cohorte).sort((a, b) => (a.fecha_corte < b.fecha_corte ? -1 : 1))
    .map((f) => ({ ...f, corte: fecha(f.fecha_corte), saldo: f.ingresos - f.gastos_comprometidos }))
  return (
    <ChartCard titulo="Evolución de los cortes" subtitulo={`Promoción ${elegida.nombre} · ${cortes.length} corte(s)`}
      acciones={(
        <select aria-label="Promoción" value={elegida.id_cohorte} onChange={(e) => setId(Number(e.target.value))} className="rounded-lg px-2 py-1 text-label-sm">
          {promociones.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre}</option>)}
        </select>
      )}
      tabla={tablaDe(cortes, [{ clave: 'corte', titulo: 'Corte' }, { clave: 'ingresos', titulo: 'Ingresos', formato: pesos }, { clave: 'gastos_comprometidos', titulo: 'Gastos', formato: pesos }, { clave: 'saldo', titulo: 'Saldo', formato: pesos }, { clave: 'saldo_certificado', titulo: 'Saldo certificado', formato: pesos }])}
      pie={(
        <button type="button" className="btn-enlace" onClick={() => onFiltrar(porPromocion('presupuesto')({ ...elegida, promocion: elegida.nombre }))}>
          Ver los cortes de la promoción {elegida.nombre} en «Datos»
        </button>
      )}>
      <GraficoLineas datos={cortes} ejeX="corte" formato={pesos} formatoEje={ejePesos}
        series={[{ clave: 'ingresos', nombre: 'Ingresos', color: SERIES[0] }, { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos', color: SERIES[1] }, { clave: 'saldo', nombre: 'Saldo', color: SERIES[2] }]} />
    </ChartCard>
  )
}

// 1. Ejecución presupuestal y saldos (RF-ADM-03): último corte de cada promoción.
export function PanelEjecucion({ resumen, filasPresupuesto, cohortes, onFiltrar }) {
  const filas = ultimosCortes(resumen, cohortes)
  if (!filas.length) return <SinDatos texto="No hay cortes de presupuesto para estas promociones." />

  const ingresos = suma(filas.map((f) => f.ingresos))
  const gastos = suma(filas.map((f) => f.gastos_comprometidos))
  const ejecucion = razon(gastos, ingresos)
  const sobregiro = filas.filter((f) => (f.pct_ejecucion ?? 0) > 1)
  const certificadas = filas.filter((f) => f.diferencia_certificado !== null)
  const descuadres = certificadas.filter((f) => Math.abs(f.diferencia_certificado) >= 1)
  const filtrar = (f) => onFiltrar(porPromocion('presupuesto')(f))

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Ingresos recaudados" valor={pesosCompactos(ingresos)} icono="savings" destacado><Insignia>{pesos(ingresos)}</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Gastos comprometidos" valor={pesosCompactos(gastos)} icono="receipt_long"><Insignia tono="neutro">{pesos(gastos)}</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Saldo neto" valor={pesosCompactos(ingresos - gastos)} icono="account_balance_wallet"><Insignia tono="acento">Ingresos − gastos</Insignia></TarjetaKpi>
        <TarjetaKpi etiqueta="Ejecución global" valor={porcentaje(ejecucion)} icono="speed">
          <BarraProgreso fraccion={ejecucion} />
          {sobregiro.length > 0 && <p className="mt-2 text-body-sm text-error">Sobregiro en {sobregiro.map((f) => f.promocion).join(', ')}</p>}
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard titulo="Ingresos y gastos por promoción" subtitulo={`Último corte (${fecha(resumen.fecha_corte)}) · clic para ver los cortes`}
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'fecha_corte', titulo: 'Corte', formato: fecha }, { clave: 'ingresos', titulo: 'Ingresos', formato: pesos }, { clave: 'gastos_comprometidos', titulo: 'Gastos', formato: pesos }])}>
          <GraficoBarras datos={filas} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
            series={[{ clave: 'ingresos', nombre: 'Ingresos', color: SERIES[0] }, { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos', color: SERIES[1] }]} />
        </ChartCard>
        <ChartCard titulo="Ejecución por promoción" subtitulo="Gastos comprometidos sobre ingresos; más de 100 % es sobregiro"
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'pct_ejecucion', titulo: 'Ejecución', formato: porcentaje }])}>
          <GraficoBarras datos={filas} ejeX="promocion" horizontal anchoEtiquetas={110} formato={porcentaje} onSeleccionar={filtrar}
            series={[{ clave: 'pct_ejecucion', nombre: 'Ejecución', color: SERIES[6] }]} />
        </ChartCard>
        <ChartCard titulo="Distribución del saldo por promoción" subtitulo="Registrada en el corte o calculada con los porcentajes de Parámetros del programa"
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, ...DISTRIBUCION.map((d) => ({ clave: d.clave, titulo: d.nombre, formato: pesos }))])}>
          <GraficoBarras datos={filas} ejeX="promocion" apilado formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
            series={DISTRIBUCION.map((d, i) => ({ ...d, color: SERIES[i + 2] }))} />
        </ChartCard>
        <ChartCard titulo="Saldo comprometido frente al certificado"
          subtitulo={certificadas.length
            ? (descuadres.length ? `Diferencia con la Oficina de Presupuesto en ${descuadres.map((f) => f.promocion).join(', ')}` : 'Los saldos coinciden con el certificado')
            : 'Sin saldos certificados registrados'}
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'saldo_comprometido', titulo: 'Comprometido', formato: pesos }, { clave: 'saldo_certificado', titulo: 'Certificado', formato: pesos }, { clave: 'diferencia_certificado', titulo: 'Diferencia', formato: pesos }])}>
          <GraficoBarras datos={filas} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
            series={[{ clave: 'saldo_comprometido', nombre: 'Saldo comprometido', color: SERIES[2] }, { clave: 'saldo_certificado', nombre: 'Saldo certificado', color: SERIES[3] }]} />
        </ChartCard>
      </RejillaGraficas>

      <EvolucionCortes filas={filasPresupuesto} cohortes={cohortes} onFiltrar={onFiltrar} />
    </div>
  )
}

// 2. Sostenibilidad y punto de equilibrio: viabilidad de cada promoción y aporte del pregrado.
export function PanelSostenibilidad({ equilibrio, pregrado, resumen, cohortes, onFiltrar }) {
  const recaudado = new Map(ultimosCortes(resumen, cohortes).map((f) => [f.id_cohorte, f.ingresos]))
  const filasPregrado = porCohorte(pregrado, cohortes)
  const aporte = new Map()
  for (const f of filasPregrado) aporte.set(f.id_cohorte, (aporte.get(f.id_cohorte) ?? 0) + (f.ingreso ?? 0))
  const datos = porCohorte(equilibrio, cohortes).map((f) => {
    const ingresosPregrado = aporte.get(f.id_cohorte) ?? null
    const ingresos = recaudado.get(f.id_cohorte) ?? null
    return {
      ...f,
      matriculados: cohortes.find((c) => c.id_cohorte === f.id_cohorte)?.matriculados ?? null,
      ingresos,
      pct_recaudo: razon(ingresos, f.ingresos_proyectados),
      ingreso_pregrado: ingresosPregrado,
      pct_aporte: razon(ingresosPregrado, f.ingresos_proyectados),
    }
  })
  if (!datos.length && !filasPregrado.length) return <SinDatos />

  const sobre = datos.filter((f) => (f.matriculados ?? 0) >= f.estudiantes_equilibrio)
  const conRecaudo = datos.filter((f) => f.ingresos !== null)
  const conPregrado = datos.filter((f) => f.ingreso_pregrado !== null)
  const periodos = [...new Set(filasPregrado.map((f) => f.periodo))].sort().map((p) => {
    const del = filasPregrado.filter((f) => f.periodo === p)
    return { periodo: p, estudiantes: suma(del.map((f) => f.estudiantes)), inscripciones: suma(del.map((f) => f.inscripciones)), ingreso: suma(del.map((f) => f.ingreso)) }
  })
  const filtrar = (f) => onFiltrar(porPromocion('punto-equilibrio')(f))

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Ingresos proyectados" valor={pesosCompactos(suma(datos.map((f) => f.ingresos_proyectados)))} icono="trending_up" destacado>
          <Insignia>Suma del rango</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Promociones en equilibrio" valor={`${sobre.length} de ${datos.length}`} icono="balance">
          <BarraProgreso fraccion={razon(sobre.length, datos.length)} />
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Estudiantes de equilibrio" valor={datos.length ? numero(suma(datos.map((f) => f.estudiantes_equilibrio)) / datos.length) : '—'} icono="groups">
          <Insignia tono="neutro">Promedio por promoción</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Matrícula" valor={datos.length ? `${numero(suma(datos.map((f) => f.valor_matricula_smmlv)) / datos.length)} SMMLV` : '—'} icono="payments">
          <Insignia tono="neutro">Promedio por semestre</Insignia>
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard titulo="Matriculados frente al punto de equilibrio" subtitulo="Promociones sobre el mínimo de estudiantes que hace viable la cohorte"
          tabla={tablaDe(datos, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'matriculados', titulo: 'Matriculados', formato: numero }, { clave: 'estudiantes_equilibrio', titulo: 'Equilibrio', formato: numero }])}>
          {datos.length ? (
            <GraficoBarras datos={datos} ejeX="promocion" formato={numero} onSeleccionar={filtrar}
              series={[{ clave: 'matriculados', nombre: 'Matriculados', color: SERIES[0] }, { clave: 'estudiantes_equilibrio', nombre: 'Estudiantes de equilibrio', color: SERIES[3] }]} />
          ) : <SinDatos texto="No hay punto de equilibrio registrado para estas promociones." />}
        </ChartCard>
        <ChartCard titulo="Recaudo frente a la proyección" subtitulo="Ingresos del último corte de presupuesto sobre los ingresos proyectados de la promoción"
          tabla={tablaDe(datos, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'ingresos_proyectados', titulo: 'Proyectados', formato: pesos }, { clave: 'ingresos', titulo: 'Recaudados', formato: pesos }, { clave: 'pct_recaudo', titulo: 'Recaudo', formato: porcentaje }])}>
          {conRecaudo.length ? (
            <GraficoBarras datos={datos} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
              series={[{ clave: 'ingresos_proyectados', nombre: 'Ingresos proyectados', color: SERIES[2] }, { clave: 'ingresos', nombre: 'Ingresos recaudados', color: SERIES[0] }]} />
          ) : <SinDatos texto="No hay cortes de presupuesto para comparar con la proyección." />}
        </ChartCard>
        <ChartCard titulo="Ingresos proyectados y aporte del pregrado" subtitulo="Inscripciones de pregrado en cursos de la maestría; la tabla muestra el % de la viabilidad"
          tabla={tablaDe(datos, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'ingresos_proyectados', titulo: 'Proyectados', formato: pesos }, { clave: 'ingreso_pregrado', titulo: 'Aporte del pregrado', formato: pesos }, { clave: 'pct_aporte', titulo: '% de la viabilidad', formato: porcentaje }])}>
          {conPregrado.length ? (
            <GraficoBarras datos={datos} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={(f) => onFiltrar(porPromocion('pregrado')(f))}
              series={[{ clave: 'ingresos_proyectados', nombre: 'Ingresos proyectados', color: SERIES[2] }, { clave: 'ingreso_pregrado', nombre: 'Aporte del pregrado', color: SERIES[4] }]} />
          ) : <SinDatos texto="No hay ingresos de pregrado para estas promociones." />}
        </ChartCard>
        <ChartCard titulo="Matrículas de pregrado por periodo" subtitulo="Estudiantes e inscripciones; la tabla incluye el ingreso"
          tabla={tablaDe(periodos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'estudiantes', titulo: 'Estudiantes', formato: numero }, { clave: 'inscripciones', titulo: 'Inscripciones', formato: numero }, { clave: 'ingreso', titulo: 'Ingreso', formato: pesos }])}>
          {periodos.length ? (
            <GraficoBarras datos={periodos} ejeX="periodo" formato={numero} onSeleccionar={(f) => onFiltrar(porPeriodoEn('pregrado')(f))}
              series={[{ clave: 'estudiantes', nombre: 'Estudiantes', color: SERIES[0] }, { clave: 'inscripciones', nombre: 'Inscripciones', color: SERIES[6] }]} />
          ) : <SinDatos texto="No hay estudiantes de pregrado registrados." />}
        </ChartCard>
      </RejillaGraficas>
    </div>
  )
}

// 3. Gastos de personal y contrataciones: transferencias a la Vicerrectoría Académica y contratos OPS
// por periodo. `totalProyectado` = ingresos proyectados de todas las promociones (como en el libro).
export function PanelOperacion({ transferencias, contrataciones, totalProyectado, onFiltrar }) {
  const periodos = [...new Set([...transferencias, ...contrataciones].map((f) => f.periodo))].sort()
  if (!periodos.length) return <SinDatos texto="No hay transferencias ni contrataciones en estos periodos." />
  const datos = periodos.map((periodo) => {
    const t = transferencias.find((f) => f.periodo === periodo)
    const c = contrataciones.find((f) => f.periodo === periodo)
    return {
      periodo,
      valor_transferencias: t?.valor ?? null,
      n_docentes: t?.n_docentes ?? null,
      valor_ops: c?.valor ?? null,
      n_ops: c?.n_ops ?? null,
      medio_docente: razon(t?.valor, t?.n_docentes),
      medio_ops: razon(c?.valor, c?.n_ops),
    }
  })
  const totalTransferido = suma(datos.map((f) => f.valor_transferencias))
  const totalOps = suma(datos.map((f) => f.valor_ops))
  const docentes = suma(datos.map((f) => f.n_docentes))
  const ops = suma(datos.map((f) => f.n_ops))
  const pctIngresos = razon(totalOps, totalProyectado)

  return (
    <div className="flex flex-col gap-space-lg">
      <FilaIndicadores>
        <TarjetaKpi etiqueta="Inversión en personal" valor={pesosCompactos(totalTransferido + totalOps)} icono="payments" destacado>
          <Insignia>Transferencias + OPS</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Docentes vía Vicerrectoría Académica" valor={numero(docentes)} icono="swap_horiz">
          <Insignia tono="neutro">{pesosCompactos(razon(totalTransferido, docentes))} por docente</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Contratos OPS" valor={numero(ops)} icono="contract">
          <Insignia tono="neutro">{pesosCompactos(razon(totalOps, ops))} por contrato</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="OPS sobre ingresos proyectados" valor={porcentaje(pctIngresos)} icono="pie_chart">
          <BarraProgreso fraccion={pctIngresos} />
          <p className="mt-2 text-body-sm text-on-surface-variant">Total OPS ÷ ingresos proyectados de todas las promociones</p>
        </TarjetaKpi>
      </FilaIndicadores>

      <RejillaGraficas>
        <ChartCard titulo="Transferencias a la Vicerrectoría Académica" subtitulo="Valor transferido por periodo; la tabla incluye los docentes"
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'n_docentes', titulo: 'Docentes', formato: numero }, { clave: 'valor_transferencias', titulo: 'Valor', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="periodo" formato={pesos} formatoEje={ejePesos} onSeleccionar={(f) => onFiltrar(porPeriodoEn('transferencias')(f))}
            series={[{ clave: 'valor_transferencias', nombre: 'Valor transferido', color: SERIES[0] }]} />
        </ChartCard>
        <ChartCard titulo="Contrataciones OPS" subtitulo="Valor de los contratos por periodo; la tabla incluye el número de OPS"
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'n_ops', titulo: 'Contratos OPS', formato: numero }, { clave: 'valor_ops', titulo: 'Valor', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="periodo" formato={pesos} formatoEje={ejePesos} onSeleccionar={(f) => onFiltrar(porPeriodoEn('contrataciones')(f))}
            series={[{ clave: 'valor_ops', nombre: 'Valor OPS', color: SERIES[1] }]} />
        </ChartCard>
      </RejillaGraficas>

      <ChartCard titulo="Costo medio por docente y por contrato OPS" subtitulo="Valor del periodo dividido entre docentes o contratos"
        tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'medio_docente', titulo: 'Por docente', formato: pesos }, { clave: 'medio_ops', titulo: 'Por contrato OPS', formato: pesos }])}>
        <GraficoLineas datos={datos} ejeX="periodo" formato={pesos} formatoEje={ejePesos}
          series={[{ clave: 'medio_docente', nombre: 'Por docente', color: SERIES[0] }, { clave: 'medio_ops', nombre: 'Por contrato OPS', color: SERIES[1] }]} />
      </ChartCard>
    </div>
  )
}
