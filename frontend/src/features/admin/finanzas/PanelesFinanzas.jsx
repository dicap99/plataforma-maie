import ChartCard from '../../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../../components/charts/paleta'
import { fecha, numero, pesos, pesosCompactos, porcentaje } from '../../../utils/formato'
import { RejillaGraficas, SinDatos } from '../academico/comunes.jsx'
import { porCohorte, razon, suma } from '../academico/estadisticas'

// Paneles de «Presupuesto y finanzas». `onFiltrar({ hoja, etiqueta, fn })` abre «Datos» en la hoja
// indicada, filtrada a la promoción o al periodo en que se hizo clic.

const ejePesos = (v) => pesosCompactos(v)
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

// 1. Ejecución presupuestal y saldos (RF-ADM-03): último corte de cada promoción y su comparación con
// el estudio de viabilidad (línea base: ingresos = gastos proyectados en la hoja «Punto de equilibrio»).
// La distribución del saldo (administración, VIIS, fondo, unidad) no se grafica: la liquidación está
// suspendida (asesoría del 20-oct-2026); los valores se conservan en los cortes por si se reactiva.
export function PanelEjecucion({ resumen, equilibrio, cohortes, onFiltrar }) {
  const filas = ultimosCortes(resumen, cohortes)
  const proyectado = new Map(equilibrio.map((e) => [e.id_cohorte, e.ingresos_proyectados]))
  const viabilidad = filas.map((f) => {
    const base = proyectado.get(f.id_cohorte) ?? null
    return { ...f, ingresos_proyectados: base, pct_recaudo: razon(f.ingresos, base), pct_gasto: razon(f.gastos_comprometidos, base) }
  })
  const ordenCohorte = new Map(cohortes.map((c, i) => [c.id_cohorte, i]))
  const recaudo = (resumen?.recaudo_matriculas ?? [])
    .filter((r) => ordenCohorte.has(r.id_cohorte) && r.total > 0)
    .sort((a, b) => ordenCohorte.get(a.id_cohorte) - ordenCohorte.get(b.id_cohorte))
    .map((r) => ({ ...r, promocion: r.cohorte }))

  if (!filas.length && !recaudo.length) return <SinDatos texto="No hay cortes de presupuesto ni matrículas financieras para estas promociones." />

  const filtrar = (f) => onFiltrar(porPromocion('presupuesto')(f))
  const conBase = viabilidad.filter((f) => f.ingresos_proyectados !== null)

  return (
    <div className="flex flex-col gap-space-lg">
      {filas.length > 0 && (
        <>
          <ChartCard titulo="Ingresos, gastos y saldo por promoción"
            subtitulo={`Último corte (${fecha(resumen.fecha_corte)}); el saldo es ingresos menos gastos comprometidos y puede ser negativo · clic para ver los cortes`}
            tabla={tablaDe(filas, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'fecha_corte', titulo: 'Corte', formato: fecha }, { clave: 'ingresos', titulo: 'Ingresos', formato: pesos }, { clave: 'gastos_comprometidos', titulo: 'Gastos', formato: pesos }, { clave: 'saldo_comprometido', titulo: 'Saldo', formato: pesos }])}>
            <GraficoBarras datos={filas} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
              series={[{ clave: 'ingresos', nombre: 'Ingresos', color: SERIES[0] }, { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos', color: SERIES[1] }, { clave: 'saldo_comprometido', nombre: 'Saldo', color: SERIES[2] }]} />
          </ChartCard>

          <ChartCard titulo="Ejecución frente al estudio de viabilidad"
            subtitulo="Línea base del estudio de viabilidad (ingresos proyectados = gastos proyectados en el punto de equilibrio) frente a lo recaudado y comprometido en el último corte · clic para ver los cortes"
            tabla={tablaDe(viabilidad, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'ingresos_proyectados', titulo: 'Viabilidad', formato: pesos }, { clave: 'ingresos', titulo: 'Recaudado', formato: pesos }, { clave: 'pct_recaudo', titulo: '% recaudo', formato: porcentaje }, { clave: 'gastos_comprometidos', titulo: 'Comprometido', formato: pesos }, { clave: 'pct_gasto', titulo: '% gasto', formato: porcentaje }])}>
            {conBase.length ? (
              <GraficoBarras datos={viabilidad} ejeX="promocion" formato={pesos} formatoEje={ejePesos} onSeleccionar={filtrar}
                series={[{ clave: 'ingresos_proyectados', nombre: 'Viabilidad (proyectado)', color: SERIES[3] }, { clave: 'ingresos', nombre: 'Ingresos recaudados', color: SERIES[0] }, { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos', color: SERIES[1] }]} />
            ) : <SinDatos texto="No hay estudio de viabilidad (punto de equilibrio) registrado para estas promociones." />}
          </ChartCard>
        </>
      )}

      {recaudo.length > 0 && (
        <ChartCard titulo="Ingresos registrados por matrícula financiera (posgrado y pregrado)"
          subtitulo="Suma de pagos registrados en Gestión académica › Datos del programa › Matrícula financiera"
          tabla={tablaDe(recaudo, [
            { clave: 'promocion', titulo: 'Promoción' },
            { clave: 'posgrado', titulo: 'Posgrado', formato: pesos },
            { clave: 'pregrado', titulo: 'Pregrado', formato: pesos },
            { clave: 'total', titulo: 'Total recaudado', formato: pesos },
          ])}>
          <GraficoBarras datos={recaudo} ejeX="promocion" apilado formato={pesos} formatoEje={ejePesos}
            series={[{ clave: 'posgrado', nombre: 'Posgrado', color: SERIES[0] }, { clave: 'pregrado', nombre: 'Pregrado', color: SERIES[4] }]} />
        </ChartCard>
      )}
    </div>
  )
}

// 2. Sostenibilidad y punto de equilibrio: matriculados frente al equilibrio y aporte del pregrado.
// El aporte de cada promoción suma los ingresos de pregrado registrados para ella (sus cuatro
// semestres) y se compara con los ingresos proyectados en su estudio de viabilidad.
export function PanelSostenibilidad({ equilibrio, pregrado, cohortes, onFiltrar }) {
  const filasPregrado = porCohorte(pregrado, cohortes)
  const datos = porCohorte(equilibrio, cohortes).map((f) => {
    const ingresoPregrado = suma(filasPregrado.filter((p) => p.id_cohorte === f.id_cohorte).map((p) => p.ingreso))
    return {
      ...f,
      matriculados: cohortes.find((c) => c.id_cohorte === f.id_cohorte)?.matriculados ?? null,
      ingreso_pregrado: ingresoPregrado,
      pct_aporte: razon(ingresoPregrado, f.ingresos_proyectados),
    }
  })
  if (!datos.length && !filasPregrado.length) return <SinDatos />

  const conPregrado = datos.filter((f) => f.ingreso_pregrado > 0)
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
        <ChartCard titulo="Aporte del pregrado frente a la viabilidad" subtitulo="Ingresos de pregrado durante los semestres de cada promoción; la tabla incluye el % de los ingresos proyectados"
          tabla={tablaDe(datos, [{ clave: 'promocion', titulo: 'Promoción' }, { clave: 'ingresos_proyectados', titulo: 'Viabilidad', formato: pesos }, { clave: 'ingreso_pregrado', titulo: 'Aporte pregrado', formato: pesos }, { clave: 'pct_aporte', titulo: '% de la viabilidad', formato: porcentaje }])}>
          {conPregrado.length ? (
            <GraficoBarras datos={datos} ejeX="promocion" formato={pesos} formatoEje={ejePesos}
              onSeleccionar={(f) => onFiltrar(porPromocion('pregrado')(f))}
              series={[{ clave: 'ingresos_proyectados', nombre: 'Viabilidad (proyectado)', color: SERIES[3] }, { clave: 'ingreso_pregrado', nombre: 'Aporte del pregrado', color: SERIES[4] }]} />
          ) : <SinDatos texto="No hay ingresos de pregrado registrados para estas promociones." />}
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
