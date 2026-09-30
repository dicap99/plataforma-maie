import { Link, useNavigate } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../components/charts/paleta'
import { fecha, numero, pesos, pesosCompactos, porcentaje } from '../../utils/formato'
import { periodoAcademico } from '../../utils/periodo'
import BannerPrograma, { BotonBanner } from './panel/BannerPrograma.jsx'
import FranjaAviso from './panel/FranjaAviso.jsx'
import LineasInvestigacion from './panel/LineasInvestigacion.jsx'
import TarjetaKpi, { BarraProgreso, Insignia } from './panel/TarjetaKpi.jsx'
import TarjetaLateral, { Renglon } from './panel/TarjetaLateral.jsx'

const DIA = 86_400_000
// A partir de medio año sin actualizar, las cifras presupuestales dejan de servir
// para la autoevaluación; a partir de un trimestre conviene avisar.
const DIAS_CRITICO = 180
const DIAS_ATENCION = 90

// Panel de gestión del coordinador (RF-ADM-05). Toda la información proviene de
// /admin/reportes/estadisticas: aquí no hay cifras fijas en el código.
export default function EstadisticasDashboard() {
  const { data, error, cargando, recargar } = useApi(adminApi.estadisticas)
  const navegar = useNavigate()

  if (cargando && !data) return <Cargando texto="Calculando estadísticas…" />
  if (error) return <ErrorApi error={error} onReintentar={recargar} />

  const {
    promociones, presupuesto, produccion, beneficios, pasantias,
    cursosDocentes, contrataciones, transferencias, pregrado, docentes,
    puntoEquilibrio, parametros,
  } = data

  if (promociones.filas.length === 0) {
    return (
      <div className="card">
        <h1>Panel general</h1>
        <p>Aún no hay datos. Importe el libro «Estadísticas MaIE» desde <Link to="datos">Información académica</Link>.</p>
      </div>
    )
  }

  // --- Cifras de cabecera -------------------------------------------------
  const ultima = promociones.filas.at(-1)
  const anterior = promociones.filas.at(-2)
  const deltaMatriculados = anterior?.matriculados
    ? (ultima.matriculados - anterior.matriculados) / anterior.matriculados
    : null

  // Los parámetros son pares clave/valor y el SMMLV se versiona por año.
  const claveSmmlv = Object.keys(parametros).find((k) => k.startsWith('smmlv_'))
  const smmlv = claveSmmlv ? parametros[claveSmmlv] : null
  const creditosPlan = Object.entries(parametros)
    .filter(([k]) => k.startsWith('creditos_semestre_'))
    .reduce((s, [, v]) => s + Number(v), 0)

  const equilibrio = puntoEquilibrio.filas.at(-1)
  const matriculaSmmlv = equilibrio?.valor_matricula_smmlv ?? null

  const diasCorte = presupuesto.fecha_corte
    ? Math.floor((Date.now() - new Date(presupuesto.fecha_corte).getTime()) / DIA)
    : null
  const nivelCorte =
    diasCorte === null || diasCorte > DIAS_CRITICO ? 'critico' : diasCorte > DIAS_ATENCION ? 'atencion' : 'info'

  // Serie temporal unificada de contrataciones y transferencias (misma unidad: pesos).
  const periodos = [...new Set([...contrataciones.filas, ...transferencias.filas].map((f) => f.periodo))].sort()
  const porPeriodo = periodos.map((periodo) => ({
    periodo,
    ops: contrataciones.filas.find((f) => f.periodo === periodo)?.valor ?? null,
    transferencias: transferencias.filas.find((f) => f.periodo === periodo)?.valor ?? null,
  }))
  const nombreCohorte = (f) => ({ ...f, promocion: f.cohorte ?? f.nombre })
  const filasPromociones = promociones.filas.map(nombreCohorte)

  return (
    <div className="flex flex-col gap-space-lg">
      <BannerPrograma
        descripcion={`Panel de gestión del coordinador · Seguimiento de promociones, ejecución presupuestal, planta docente y producción científica · Periodo ${periodoAcademico()}.`}
        metadatos={[
          {
            icono: 'school',
            etiqueta: 'Promociones',
            valor: `${numero(promociones.filas.length)} · vigente ${ultima.nombre}`,
          },
          {
            icono: 'groups',
            etiqueta: 'Población estudiantil',
            valor: `${numero(promociones.indicadores.poblacion_total)} estudiantes`,
          },
          {
            icono: 'menu_book',
            etiqueta: 'Créditos del plan',
            valor: creditosPlan ? numero(creditosPlan) : '—',
          },
          {
            icono: 'payments',
            etiqueta: `SMMLV base${claveSmmlv ? ` ${claveSmmlv.split('_')[1]}` : ''}`,
            valor: pesos(smmlv),
          },
        ]}
      >
        <BotonBanner icono="download_for_offline" onClick={() => adminApi.descargarPlantilla(true)}>
          Exportar a Excel
        </BotonBanner>
        <BotonBanner icono="upload_file" principal onClick={() => navegar('datos')}>
          Importar datos
        </BotonBanner>
      </BannerPrograma>

      <FranjaAviso
        nivel={nivelCorte}
        titulo={`Presupuesto con corte al ${fecha(presupuesto.fecha_corte)}`}
        acciones={
          <>
            <Link
              to="presupuesto"
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface no-underline transition-colors hover:bg-surface-container-high"
            >
              <Icono nombre="account_balance_wallet" className="text-[18px]" />
              Ver presupuesto
            </Link>
            <Link
              to="datos"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-label-md text-on-primary no-underline shadow-sm transition-colors hover:bg-primary-container active:scale-95"
            >
              <Icono nombre="sync" className="text-[18px]" />
              Actualizar datos
            </Link>
          </>
        }
      >
        {diasCorte === null ? (
          <>Ninguna promoción tiene fecha de corte registrada en la hoja «Presupuesto».</>
        ) : (
          <>
            Última actualización hace <span className="font-bold text-on-surface">{numero(diasCorte)} días</span>.
            Ejecución consolidada del <span className="font-bold text-secondary">{porcentaje(presupuesto.indicadores.pct_ejecucion)}</span>{' '}
            sobre {pesosCompactos(presupuesto.totales.ingresos)} de ingresos.
          </>
        )}
      </FranjaAviso>

      <section className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi etiqueta="Estudiantes matriculados" valor={numero(promociones.totales.matriculados)} icono="groups">
          <div className="flex items-center justify-between gap-2">
            {deltaMatriculados === null ? (
              <Insignia>{numero(promociones.indicadores.poblacion_total)} en curso</Insignia>
            ) : (
              <Insignia>
                <Icono nombre={deltaMatriculados >= 0 ? 'trending_up' : 'trending_down'} className="text-[14px]" />
                {deltaMatriculados >= 0 ? '+' : ''}{porcentaje(deltaMatriculados)}
              </Insignia>
            )}
            <span className="text-label-sm text-on-surface-variant">
              {anterior ? `vs. promoción ${anterior.nombre}` : 'histórico acumulado'}
            </span>
          </div>
        </TarjetaKpi>

        <TarjetaKpi
          etiqueta="Presupuesto ejecutado"
          valor={porcentaje(presupuesto.indicadores.pct_ejecucion)}
          icono="account_balance_wallet"
        >
          <BarraProgreso fraccion={presupuesto.indicadores.pct_ejecucion} />
          <div className="mt-2 flex justify-between text-label-sm text-on-surface-variant">
            <span>Comprometido: {pesosCompactos(presupuesto.totales.gastos_comprometidos)}</span>
            <span>Saldo: {pesosCompactos(presupuesto.totales.saldo_comprometido)}</span>
          </div>
        </TarjetaKpi>

        <TarjetaKpi etiqueta="Docentes vinculados" valor={numero(docentes.total)} icono="badge">
          <div className="flex items-center justify-between gap-2">
            <Insignia tono="acento">{numero(docentes.udenar)} UDENAR</Insignia>
            <span className="text-label-sm text-on-surface-variant">
              {numero(docentes.externos)} externos · {numero(docentes.porCampo?.length ?? 0)} campos
            </span>
          </div>
        </TarjetaKpi>

        <TarjetaKpi
          etiqueta="Graduados sobre egresados"
          valor={porcentaje(promociones.indicadores.pct_graduados)}
          icono="military_tech"
          destacado
        >
          <div className="flex items-center justify-between gap-2">
            <Insignia tono="fuerte">{numero(promociones.totales.graduados)} graduados</Insignia>
            <span className="text-label-sm text-on-surface-variant">
              de {numero(promociones.totales.egresados)} egresados
            </span>
          </div>
        </TarjetaKpi>
      </section>

      {/* Figura principal + costos y acciones de carga */}
      <section className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ChartCard
            titulo="Evolución de matrículas vs. graduados"
            subtitulo={`Comparativo por promoción desde ${promociones.filas[0].periodo_inicio}. Tasa de egreso acumulada: ${porcentaje(promociones.indicadores.pct_egresados)}.`}
            altura="h-80"
            tabla={{
              columnas: [
                { clave: 'promocion', titulo: 'Promoción' },
                { clave: 'inscritos', titulo: 'Inscritos', formato: numero },
                { clave: 'matriculados', titulo: 'Matriculados', formato: numero },
                { clave: 'egresados', titulo: 'Egresados', formato: numero },
                { clave: 'graduados', titulo: 'Graduados', formato: numero },
                { clave: 'pct_retiros', titulo: '% retiros', formato: porcentaje },
              ],
              filas: filasPromociones,
            }}
          >
            <GraficoBarras
              datos={filasPromociones}
              ejeX="promocion"
              series={[
                { clave: 'matriculados', nombre: 'Matriculados' },
                { clave: 'egresados', nombre: 'Egresados' },
                { clave: 'graduados', nombre: 'Graduados' },
              ]}
              formato={numero}
            />
          </ChartCard>
        </div>

        <div className="flex flex-col gap-space-md lg:col-span-4">
          <TarjetaLateral rotulo="Sostenibilidad" titulo="Punto de equilibrio" icono="balance">
            {equilibrio ? (
              <>
                <div className="mt-2 font-display text-headline-lg tracking-tight text-primary">
                  {numero(equilibrio.estudiantes_equilibrio)}{' '}
                  <span className="text-body-sm font-normal text-on-surface-variant">estudiantes</span>
                </div>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Mínimo para sostener la promoción {equilibrio.cohorte}, que hoy tiene{' '}
                  {numero(ultima.matriculados)} matriculados.
                </p>
                <div className="mt-3 rounded-xl bg-surface-container-low p-space-sm">
                  <Renglon etiqueta="Ingresos proyectados:" valor={pesosCompactos(equilibrio.ingresos_proyectados)} />
                </div>
              </>
            ) : (
              <p className="mt-2 text-body-sm text-on-surface-variant">Sin datos en la hoja «Punto de equilibrio».</p>
            )}
          </TarjetaLateral>

          <TarjetaLateral rotulo="Arancel académico" titulo="Inversión semestral" icono="payments" tono="container">
            <div className="mt-3 space-y-2 rounded-xl bg-surface-container-low p-space-sm">
              <Renglon etiqueta="Valor de matrícula:" valor={matriculaSmmlv ? `${numero(matriculaSmmlv)} SMMLV` : '—'} />
              <Renglon
                etiqueta={`Equivalente${claveSmmlv ? ` (SMMLV ${claveSmmlv.split('_')[1]})` : ''}:`}
                valor={smmlv && matriculaSmmlv ? pesos(smmlv * matriculaSmmlv) : '—'}
                destacado
              />
            </div>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Valores tomados de las hojas «Punto de equilibrio» y «Parámetros»; se actualizan al importar el libro.
            </p>
          </TarjetaLateral>

          <div className="flex flex-col justify-between rounded-xl bg-primary-container p-space-md text-on-primary shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                <Icono nombre="upload_file" className="text-secondary-fixed" />
              </span>
              <div>
                <h4 className="font-display text-headline-sm text-on-primary">Sincronización masiva</h4>
                <p className="text-body-sm text-primary-fixed-dim">Carga del libro «Estadísticas MaIE» vía Excel/CSV.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => navegar('datos')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-label-md text-on-secondary shadow-sm transition-colors hover:bg-secondary/90"
              >
                <Icono nombre="file_upload" className="text-[16px]" />
                Importar
              </button>
              <button
                type="button"
                onClick={() => adminApi.descargarPlantilla(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-label-md text-on-primary transition-colors hover:bg-white/20"
              >
                <Icono nombre="description" className="text-[16px]" />
                Plantilla
              </button>
            </div>
          </div>
        </div>
      </section>

      <LineasInvestigacion docentes={docentes} />

      <section>
        <div className="mb-space-md">
          <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
            <Icono nombre="monitoring" className="text-[16px]" />
            Aseguramiento de la calidad
          </div>
          <h2 className="mt-1 font-display text-headline-md text-primary">Indicadores de autoevaluación</h2>
          <p className="text-body-sm text-on-surface-variant">
            Series completas del Módulo de Procesos Administrativos. Cada figura ofrece su tabla equivalente.
          </p>
        </div>

        <div className="grid-graficas">
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
              filas: filasPromociones,
            }}
          >
            <GraficoBarras
              datos={filasPromociones}
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
            subtitulo={`Corte ${fecha(presupuesto.fecha_corte)}`}
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
            subtitulo={`${numero(produccion.totales.total)} productos registrados`}
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
      </section>
    </div>
  )
}
