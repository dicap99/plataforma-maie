import { Link } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../components/charts/GraficoLineas.jsx'
import StatTile from '../../components/charts/StatTile.jsx'
import { SERIES } from '../../components/charts/paleta'
import { numero, pesos, pesosCompactos, porcentaje } from '../../utils/formato'

// Tablero de estadísticas administrativas para la autoevaluación (RF-ADM-05).
export default function EstadisticasDashboard() {
  const { data, error, cargando, recargar } = useApi(adminApi.estadisticas)

  if (cargando && !data) return <Cargando texto="Calculando estadísticas…" />
  if (error) return <ErrorApi error={error} onReintentar={recargar} />

  const { promociones, presupuesto, produccion, beneficios, pasantias, cursosDocentes, contrataciones, transferencias, pregrado, docentes } = data

  if (promociones.filas.length === 0) {
    return (
      <>
        <h1>Estadísticas del programa</h1>
        <div className="card">
          <p>Aún no hay datos. Importe el libro «Estadísticas MaIE» desde <Link to="datos">Datos del programa</Link>.</p>
        </div>
      </>
    )
  }

  // Serie temporal unificada de contrataciones y transferencias (misma unidad: pesos).
  const periodos = [...new Set([...contrataciones.filas, ...transferencias.filas].map((f) => f.periodo))].sort()
  const porPeriodo = periodos.map((periodo) => ({
    periodo,
    ops: contrataciones.filas.find((f) => f.periodo === periodo)?.valor ?? null,
    transferencias: transferencias.filas.find((f) => f.periodo === periodo)?.valor ?? null,
  }))
  const nombreCohorte = (f) => ({ ...f, promocion: f.cohorte ?? f.nombre })

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Estadísticas del programa</h1>
        <p className="texto-suave">
          {promociones.filas.length} promociones · presupuesto con corte {presupuesto.fecha_corte ?? '—'}
        </p>
      </header>

      <div className="grid-indicadores">
        <StatTile
          etiqueta="Egresados sobre matriculados"
          valor={porcentaje(promociones.indicadores.pct_egresados)}
          detalle={`${numero(promociones.totales.egresados)} de ${numero(promociones.filas.filter((f) => f.egresados !== null).reduce((s, f) => s + f.matriculados, 0))} en promociones que ya egresaron`}
        />
        <StatTile
          etiqueta="Graduados sobre egresados"
          valor={porcentaje(promociones.indicadores.pct_graduados)}
          detalle={`${numero(promociones.totales.graduados)} graduados`}
        />
        <StatTile
          etiqueta="Producción científica"
          valor={numero(produccion.totales.total)}
          detalle={`${numero(produccion.totales.articulos)} artículos · ${numero(produccion.totales.tesis)} tesis`}
        />
        <StatTile
          etiqueta="Ejecución presupuestal"
          valor={porcentaje(presupuesto.indicadores.pct_ejecucion)}
          detalle={`${pesosCompactos(presupuesto.totales.gastos_comprometidos)} de ${pesosCompactos(presupuesto.totales.ingresos)}`}
        />
        <StatTile
          etiqueta="Docentes invitados"
          valor={numero(docentes.total)}
          detalle={`${docentes.udenar} UDENAR · ${docentes.externos} externos`}
        />
      </div>

      <div className="grid-graficas">
        <ChartCard
          titulo="Estudiantes por promoción"
          subtitulo="Matriculados, egresados y graduados"
          tabla={{
            columnas: [
              { clave: 'promocion', titulo: 'Promoción' },
              { clave: 'inscritos', titulo: 'Inscritos', formato: numero },
              { clave: 'matriculados', titulo: 'Matriculados', formato: numero },
              { clave: 'egresados', titulo: 'Egresados', formato: numero },
              { clave: 'graduados', titulo: 'Graduados', formato: numero },
              { clave: 'pct_retiros', titulo: '% retiros', formato: porcentaje },
            ],
            filas: promociones.filas.map(nombreCohorte),
          }}
        >
          <GraficoBarras
            datos={promociones.filas.map(nombreCohorte)}
            ejeX="promocion"
            series={[
              { clave: 'matriculados', nombre: 'Matriculados' },
              { clave: 'egresados', nombre: 'Egresados' },
              { clave: 'graduados', nombre: 'Graduados' },
            ]}
            formato={numero}
          />
        </ChartCard>

        <ChartCard
          titulo="Tasas por promoción"
          subtitulo="Promociones en curso sin tasa de egreso"
          tabla={{
            columnas: [
              { clave: 'promocion', titulo: 'Promoción' },
              { clave: 'pct_egresados', titulo: '% egresados', formato: porcentaje },
              { clave: 'pct_graduados', titulo: '% graduados', formato: porcentaje },
              { clave: 'pct_retiros', titulo: '% retiros', formato: porcentaje },
            ],
            filas: promociones.filas.map(nombreCohorte),
          }}
        >
          <GraficoBarras
            datos={promociones.filas.map(nombreCohorte)}
            ejeX="promocion"
            series={[
              // Mismos colores que "Egresados" y "Graduados" en la gráfica anterior.
              { clave: 'pct_egresados', nombre: '% egresados', color: SERIES[1] },
              { clave: 'pct_graduados', nombre: '% graduados', color: SERIES[2] },
            ]}
            formato={porcentaje}
          />
        </ChartCard>

        <ChartCard
          titulo="Presupuesto por promoción"
          subtitulo={`Corte ${presupuesto.fecha_corte ?? '—'}`}
          tabla={{
            columnas: [
              { clave: 'cohorte', titulo: 'Promoción' },
              { clave: 'ingresos', titulo: 'Ingresos', formato: pesos },
              { clave: 'gastos_comprometidos', titulo: 'Gastos comprometidos', formato: pesos },
              { clave: 'saldo_comprometido', titulo: 'Saldo', formato: pesos },
              { clave: 'pct_ejecucion', titulo: '% ejecución', formato: porcentaje },
            ],
            filas: presupuesto.filas,
          }}
        >
          <GraficoBarras
            datos={presupuesto.filas}
            ejeX="cohorte"
            series={[
              { clave: 'ingresos', nombre: 'Ingresos' },
              { clave: 'gastos_comprometidos', nombre: 'Gastos comprometidos' },
            ]}
            formato={pesos}
            formatoEje={pesosCompactos}
          />
        </ChartCard>

        <ChartCard
          titulo="Producción científica por promoción"
          tabla={{
            columnas: [
              { clave: 'cohorte', titulo: 'Promoción' },
              { clave: 'articulos', titulo: 'Artículos' },
              { clave: 'ponencias', titulo: 'Ponencias' },
              { clave: 'software', titulo: 'Software' },
              { clave: 'prototipos', titulo: 'Prototipos' },
              { clave: 'tesis', titulo: 'Tesis' },
              { clave: 'pct_poblacion', titulo: '% sobre población', formato: porcentaje },
            ],
            filas: produccion.filas,
          }}
        >
          <GraficoBarras
            datos={produccion.filas}
            ejeX="cohorte"
            apilado
            series={[
              { clave: 'articulos', nombre: 'Artículos' },
              { clave: 'ponencias', nombre: 'Ponencias' },
              { clave: 'software', nombre: 'Software' },
              { clave: 'prototipos', nombre: 'Prototipos' },
              { clave: 'tesis', nombre: 'Tesis' },
            ]}
            formato={numero}
          />
        </ChartCard>

        <ChartCard
          titulo="Contrataciones OPS y transferencias por periodo"
          subtitulo="Valor en pesos"
          tabla={{
            columnas: [
              { clave: 'periodo', titulo: 'Periodo' },
              { clave: 'ops', titulo: 'Contrataciones OPS', formato: pesos },
              { clave: 'transferencias', titulo: 'Transferencias ViceAcad', formato: pesos },
            ],
            filas: porPeriodo,
          }}
        >
          <GraficoLineas
            datos={porPeriodo}
            ejeX="periodo"
            series={[
              { clave: 'ops', nombre: 'Contrataciones OPS' },
              { clave: 'transferencias', nombre: 'Transferencias ViceAcad' },
            ]}
            formato={pesos}
            formatoEje={pesosCompactos}
          />
        </ChartCard>

        <ChartCard
          titulo="Docentes invitados por semestre"
          subtitulo="Suma de todas las promociones"
          tabla={{
            columnas: [
              { clave: 'semestre', titulo: 'Semestre' },
              { clave: 'n_cursos', titulo: 'Cursos' },
              { clave: 'docentes_udenar', titulo: 'UDENAR' },
              { clave: 'docentes_externos', titulo: 'Externos' },
              { clave: 'relacion_udenar_externos', titulo: 'UDENAR/externos', formato: numero },
              { clave: 'relacion_docentes_cursos', titulo: 'Docentes/curso', formato: numero },
              { clave: 'creditos', titulo: 'Créditos', formato: numero },
            ],
            filas: cursosDocentes.porSemestre,
          }}
        >
          <GraficoBarras
            datos={cursosDocentes.porSemestre.map((s) => ({ ...s, etiqueta: `Semestre ${s.semestre}` }))}
            ejeX="etiqueta"
            apilado
            series={[
              { clave: 'docentes_udenar', nombre: 'UDENAR' },
              { clave: 'docentes_externos', nombre: 'Externos' },
            ]}
            formato={numero}
          />
        </ChartCard>

        <ChartCard
          titulo="Beneficios por promoción"
          subtitulo={`${porcentaje(beneficios.pct_poblacion.total)} de la población estudiantil`}
          tabla={{
            columnas: [
              { clave: 'cohorte', titulo: 'Promoción' },
              { clave: 'becas_100', titulo: 'Becas 100%' },
              { clave: 'becas_hora_catedra', titulo: 'Hora cátedra' },
              { clave: 'becas_sintraunicol', titulo: 'SINTRAUNICOL' },
              { clave: 'asistentes_investigacion', titulo: 'Asistentes' },
              { clave: 'ayudantes_docencia', titulo: 'Ayudantes' },
              { clave: 'total', titulo: 'Total' },
            ],
            filas: beneficios.filas,
          }}
        >
          <GraficoBarras
            datos={beneficios.filas}
            ejeX="cohorte"
            apilado
            series={[
              { clave: 'becas_100', nombre: 'Becas 100%' },
              { clave: 'becas_hora_catedra', nombre: 'Becas hora cátedra' },
              { clave: 'becas_sintraunicol', nombre: 'Becas SINTRAUNICOL' },
              { clave: 'asistentes_investigacion', nombre: 'Asistentes de investigación' },
              { clave: 'ayudantes_docencia', nombre: 'Ayudantes de docencia' },
            ]}
            formato={numero}
          />
        </ChartCard>

        <ChartCard
          titulo="Aporte del pregrado a la viabilidad"
          subtitulo="Ingresos de pregrado sobre ingresos proyectados de la promoción"
          tabla={{
            columnas: [
              { clave: 'cohorte', titulo: 'Promoción' },
              { clave: 'estudiantes', titulo: 'Estudiantes' },
              { clave: 'inscripciones', titulo: 'Inscripciones' },
              { clave: 'ingreso', titulo: 'Ingreso', formato: pesos },
              { clave: 'pct_aporte', titulo: '% aporte', formato: porcentaje },
            ],
            filas: pregrado.porCohorte,
          }}
        >
          <GraficoBarras
            datos={pregrado.porCohorte}
            ejeX="cohorte"
            series={[{ clave: 'pct_aporte', nombre: '% aporte' }]}
            formato={porcentaje}
          />
        </ChartCard>

        <ChartCard
          titulo="Pasantías por promoción"
          tabla={{
            columnas: [
              { clave: 'cohorte', titulo: 'Promoción' },
              { clave: 'nacionales', titulo: 'Nacionales' },
              { clave: 'internacionales', titulo: 'Internacionales' },
              { clave: 'pct_poblacion', titulo: '% sobre población', formato: porcentaje },
            ],
            filas: pasantias.filas,
          }}
        >
          <GraficoBarras
            datos={pasantias.filas}
            ejeX="cohorte"
            apilado
            series={[
              { clave: 'nacionales', nombre: 'Nacionales' },
              { clave: 'internacionales', nombre: 'Internacionales' },
            ]}
            formato={numero}
          />
        </ChartCard>
      </div>
    </>
  )
}
