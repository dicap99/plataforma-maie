import { useState } from 'react'
import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoDona from '../../../components/charts/GraficoDona.jsx'
import GraficoLineas from '../../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { fecha, numero, pesos, pesosCompactos, porcentaje } from '../../../utils/formato'
import { RejillaGraficas, SinDatos } from '../academico/comunes.jsx'
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
const PCT_DISTRIBUCION = {
  transferencia_central: 'pct_transferencia_central',
  transferencia_viis: 'pct_transferencia_viis',
  fondo_investigaciones: 'pct_fondo_investigaciones',
  unidad_academica: 'pct_unidad_academica',
}
const porPromocion = (hoja) => (f) => ({ hoja, etiqueta: `Promoción ${f.promocion}`, fn: (x) => x.id_cohorte === f.id_cohorte })
const porPeriodoEn = (hoja) => (f) => ({ hoja, etiqueta: `Periodo ${f.periodo}`, fn: (x) => x.periodo === f.periodo })

// Último corte de cada promoción del rango, en el orden de las promociones.
const ultimosCortes = (resumen, cohortes) => {
  const orden = new Map(cohortes.map((c, i) => [c.id_cohorte, i]))
  return (resumen?.filas ?? []).filter((f) => orden.has(f.id_cohorte))
    .sort((a, b) => orden.get(a.id_cohorte) - orden.get(b.id_cohorte))
    .map((f) => ({ ...f, promocion: f.cohorte }))
}

// Distribución del saldo entre los cuatro destinos para una promoción elegida (o la suma de todas).
// Las promociones sin saldo positivo (p. ej. en sobregiro) no tienen distribución.
function DistribucionSaldo({ filas, onFiltrar }) {
  const conSaldo = filas.filter((f) => DISTRIBUCION.some((d) => (f[d.clave] ?? 0) > 0))
  const [id, setId] = useState('')
  const elegidas = id ? conSaldo.filter((f) => String(f.id_cohorte) === id) : conSaldo
  const datos = DISTRIBUCION.map((d, i) => ({ nombre: d.nombre, valor: suma(elegidas.map((f) => f[d.clave])), color: SERIES[i + 2] }))
  const nombre = conSaldo.find((f) => String(f.id_cohorte) === id)?.promocion
  return (
    <ChartCard titulo="Distribución del saldo por promoción"
      subtitulo={`${nombre ? `Promoción ${nombre}` : 'Promociones con saldo'}: ${pesos(suma(datos.map((d) => d.valor)))} · registrada en el corte o calculada con los porcentajes de Parámetros`}
      acciones={(
        <select aria-label="Promoción" value={id} onChange={(e) => setId(e.target.value)} className="rounded-lg px-2 py-1 text-label-sm">
          <option value="">Todas las promociones</option>
          {conSaldo.map((f) => <option key={f.id_cohorte} value={f.id_cohorte}>Promoción {f.promocion}</option>)}
        </select>
      )}
      tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, ...DISTRIBUCION.map((d) => ({ clave: d.clave, titulo: d.nombre, formato: pesos }))])}
      pie={nombre && (
        <button type="button" className="btn-enlace" onClick={() => onFiltrar(porPromocion('presupuesto')(elegidas[0]))}>
          Ver los cortes de la promoción {nombre} en «Datos»
        </button>
      )}>
      {conSaldo.length ? <GraficoDona datos={datos} formato={pesos} pastel />
        : <SinDatos texto="Ninguna promoción tiene saldo para distribuir." />}
    </ChartCard>
  )
}

// 1. Ejecución presupuestal y saldos (RF-ADM-03): último corte de cada promoción.
export function PanelEjecucion({ resumen, parametros = [], cohortes, onFiltrar }) {
  const filas = ultimosCortes(resumen, cohortes)
  if (!filas.length) return <SinDatos texto="No hay cortes de presupuesto para estas promociones." />

  const sobregiro = filas.filter((f) => (f.pct_ejecucion ?? 0) > 1)
  const certificadas = filas.filter((f) => f.diferencia_certificado !== null)
  const descuadres = certificadas.filter((f) => Math.abs(f.diferencia_certificado) >= 1)
  const filtrar = (f) => onFiltrar(porPromocion('presupuesto')(f))
  const valorParametro = (clave) => parametros.find((p) => p.clave === clave)?.valor ?? null
  const reparto = { ...Object.fromEntries(DISTRIBUCION.map((d) => [d.clave, valorParametro(PCT_DISTRIBUCION[d.clave])])) }
  const sumaReparto = suma(DISTRIBUCION.map((d) => reparto[d.clave]))

  return (
    <div className="flex flex-col gap-space-lg">
      <RejillaGraficas>
        <ChartCard titulo="Ingresos y gastos por promoción" subtitulo={`Último corte (${fecha(resumen.fecha_corte)}) · clic para ver los cortes`}
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'fecha_corte', titulo: 'Corte', formato: fecha }, { clave: 'ingresos', titulo: 'Ingresos', formato: pesos }, { clave: 'gastos_comprometidos', titulo: 'Gastos', formato: pesos }])}>
          <GraficoBarras datos={filas} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
            series={[{ clave: 'ingresos', nombre: 'Ingresos', color: SERIES[0] }, { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos', color: SERIES[1] }]} />
        </ChartCard>
        <ChartCard titulo="Ejecución por promoción" subtitulo={`Gastos comprometidos sobre ingresos; más de 100 % es sobregiro${sobregiro.length ? ` (${sobregiro.map((f) => f.promocion).join(', ')})` : ''}`}
          tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'pct_ejecucion', titulo: 'Ejecución', formato: porcentaje }])}>
          <GraficoBarras datos={filas} ejeX="promocion" horizontal anchoEtiquetas={110} formato={porcentaje} onSeleccionar={filtrar}
            series={[{ clave: 'pct_ejecucion', nombre: 'Ejecución', color: SERIES[6] }]} />
        </ChartCard>
      </RejillaGraficas>

      <RejillaGraficas>
        <DistribucionSaldo filas={filas} onFiltrar={onFiltrar} />
        <ChartCard titulo="Distribución porcentual del saldo"
          subtitulo={sumaReparto === 100 ? 'Porcentaje del saldo que se transfiere a cada destino (suma 100 %)' : `Los porcentajes de Parámetros suman ${numero(sumaReparto)} %, no 100 %`}
          tabla={tablaDe(DISTRIBUCION.map((d) => ({ nombre: d.nombre, valor: reparto[d.clave] })), [{ clave: 'nombre', titulo: 'Destino' }, { clave: 'valor', titulo: '%', formato: numero }])}>
          <GraficoDona datos={DISTRIBUCION.map((d, i) => ({ nombre: d.nombre, valor: reparto[d.clave] ?? 0, color: SERIES[i + 2] }))}
            formato={(v) => `${numero(v)} %`} pastel />
        </ChartCard>
      </RejillaGraficas>

      <ChartCard titulo="Saldo comprometido frente al certificado"
        subtitulo={certificadas.length
          ? (descuadres.length ? `Diferencia con la Oficina de Presupuesto en ${descuadres.map((f) => f.promocion).join(', ')}` : 'Los saldos coinciden con el certificado')
          : 'Sin saldos certificados registrados'}
        tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'saldo_comprometido', titulo: 'Comprometido', formato: pesos }, { clave: 'saldo_certificado', titulo: 'Certificado', formato: pesos }, { clave: 'diferencia_certificado', titulo: 'Diferencia', formato: pesos }])}>
        <GraficoBarras datos={filas} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
          series={[{ clave: 'saldo_comprometido', nombre: 'Saldo comprometido', color: SERIES[2] }, { clave: 'saldo_certificado', nombre: 'Saldo certificado', color: SERIES[3] }]} />
      </ChartCard>
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

  const conRecaudo = datos.filter((f) => f.ingresos !== null)
  const conPregrado = datos.filter((f) => f.ingreso_pregrado !== null)
  const periodos = [...new Set(filasPregrado.map((f) => f.periodo))].sort().map((p) => {
    const del = filasPregrado.filter((f) => f.periodo === p)
    return { periodo: p, estudiantes: suma(del.map((f) => f.estudiantes)), inscripciones: suma(del.map((f) => f.inscripciones)), ingreso: suma(del.map((f) => f.ingreso)) }
  })
  const filtrar = (f) => onFiltrar(porPromocion('punto-equilibrio')(f))

  return (
    <div className="flex flex-col gap-space-lg">
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
      </RejillaGraficas>

      <RejillaGraficas>
        <ChartCard titulo="Ingresos aportados por pregrado por periodo" subtitulo="Aporte financiero directo del pregrado a la operación del posgrado"
          tabla={tablaDe(periodos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'ingreso', titulo: 'Ingreso', formato: pesos }])}>
          {periodos.length ? (
            <GraficoLineas datos={periodos} ejeX="periodo" formato={pesos} formatoEje={ejePesos}
              series={[{ clave: 'ingreso', nombre: 'Ingreso del pregrado', color: SERIES[4] }]} />
          ) : <SinDatos texto="No hay ingresos de pregrado registrados." />}
        </ChartCard>
        <ChartCard titulo="Matrículas de pregrado por periodo" subtitulo="Estudiantes e inscripciones; la tabla incluye el ingreso"
          tabla={tablaDe(periodos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'estudiantes', titulo: 'Estudiantes', formato: numero }, { clave: 'inscripciones', titulo: 'Inscripciones', formato: numero }, { clave: 'ingreso', titulo: 'Ingreso', formato: pesos }])}>
          {periodos.length ? (
            <GraficoBarras datos={periodos} ejeX="periodo" formato={numero} onSeleccionar={(f) => onFiltrar(porPeriodoEn('pregrado')(f))}
              series={[{ clave: 'estudiantes', nombre: 'Estudiantes', color: SERIES[0] }, { clave: 'inscripciones', nombre: 'Inscripciones', color: SERIES[6] }]} />
          ) : <SinDatos texto="No hay estudiantes de pregrado registrados." />}
        </ChartCard>
      </RejillaGraficas>

      <ChartCard titulo="Ingresos proyectados y aporte del pregrado" subtitulo="Inscripciones de pregrado en cursos de la maestría; la tabla muestra el % de la viabilidad"
        tabla={tablaDe(datos, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'ingresos_proyectados', titulo: 'Proyectados', formato: pesos }, { clave: 'ingreso_pregrado', titulo: 'Aporte del pregrado', formato: pesos }, { clave: 'pct_aporte', titulo: '% de la viabilidad', formato: porcentaje }])}>
        {conPregrado.length ? (
          <GraficoBarras datos={datos} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={(f) => onFiltrar(porPromocion('pregrado')(f))}
            series={[{ clave: 'ingresos_proyectados', nombre: 'Ingresos proyectados', color: SERIES[2] }, { clave: 'ingreso_pregrado', nombre: 'Aporte del pregrado', color: SERIES[4] }]} />
        ) : <SinDatos texto="No hay ingresos de pregrado para estas promociones." />}
      </ChartCard>
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
    }
  })
  const pctIngresos = razon(suma(datos.map((f) => f.valor_ops)), totalProyectado)

  return (
    <div className="flex flex-col gap-space-lg">
      <RejillaGraficas>
        <ChartCard titulo="Gasto operativo por periodo" subtitulo="Transferencias a la Vicerrectoría Académica y contratos OPS · clic para ver las transferencias"
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'valor_transferencias', titulo: 'Transferencias', formato: pesos }, { clave: 'valor_ops', titulo: 'Contratos OPS', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="periodo" apilado formato={pesos} formatoEje={ejePesos} onSeleccionar={(f) => onFiltrar(porPeriodoEn('transferencias')(f))}
            series={[{ clave: 'valor_transferencias', nombre: 'Transferencias ViceAcad', color: SERIES[0] }, { clave: 'valor_ops', nombre: 'Contratos OPS', color: SERIES[1] }]} />
        </ChartCard>
        <ChartCard titulo="Personal vinculado por periodo" subtitulo="Docentes pagados por transferencia a la Vicerrectoría Académica y contratos OPS"
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'n_docentes', titulo: 'Docentes ViceAcad', formato: numero }, { clave: 'n_ops', titulo: 'Contratos OPS', formato: numero }])}>
          <GraficoBarras datos={datos} ejeX="periodo" formato={numero} onSeleccionar={(f) => onFiltrar(porPeriodoEn('contrataciones')(f))}
            series={[{ clave: 'n_docentes', nombre: 'Docentes ViceAcad', color: SERIES[0] }, { clave: 'n_ops', nombre: 'Contratos OPS', color: SERIES[1] }]} />
        </ChartCard>
      </RejillaGraficas>

      <RejillaGraficas>
        <ChartCard titulo="Transferencias a la Vicerrectoría Académica" subtitulo="Valor transferido por periodo; la tabla incluye los docentes"
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'n_docentes', titulo: 'Docentes', formato: numero }, { clave: 'valor_transferencias', titulo: 'Valor', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="periodo" formato={pesos} formatoEje={ejePesos} onSeleccionar={(f) => onFiltrar(porPeriodoEn('transferencias')(f))}
            series={[{ clave: 'valor_transferencias', nombre: 'Valor transferido', color: SERIES[0] }]} />
        </ChartCard>
        <ChartCard titulo="Contrataciones OPS" subtitulo={`Valor de los contratos por periodo; el total equivale al ${porcentaje(pctIngresos)} de los ingresos proyectados de todas las promociones`}
          tabla={tablaDe(datos, [{ clave: 'periodo', titulo: 'Periodo' }, { clave: 'n_ops', titulo: 'Contratos OPS', formato: numero }, { clave: 'valor_ops', titulo: 'Valor', formato: pesos }])}>
          <GraficoBarras datos={datos} ejeX="periodo" formato={pesos} formatoEje={ejePesos} onSeleccionar={(f) => onFiltrar(porPeriodoEn('contrataciones')(f))}
            series={[{ clave: 'valor_ops', nombre: 'Valor OPS', color: SERIES[1] }]} />
        </ChartCard>
      </RejillaGraficas>

    </div>
  )
}
