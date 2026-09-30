import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import * as cursosApi from '../../api/cursosApi'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../components/charts/GraficoBarras.jsx'
import TarjetaKpi, { BarraProgreso, Insignia } from '../admin/panel/TarjetaKpi.jsx'
import { numero, porcentaje } from '../../utils/formato'
import { COLOR_NIVEL } from './rubrica'

const AGRUPACIONES = [
  { valor: 'ra', etiqueta: 'Resultado de aprendizaje' },
  { valor: 'cohorte', etiqueta: 'Promoción' },
  { valor: 'modulo', etiqueta: 'Módulo curricular' },
  { valor: 'catalogo', etiqueta: 'Curso del plan' },
  { valor: 'curso', etiqueta: 'Curso ofertado' },
  { valor: 'estudiante', etiqueta: 'Estudiante' },
]
const MOMENTOS = [
  { valor: 'todos', etiqueta: 'Todo el recorrido' },
  { valor: 'inicio-III', etiqueta: 'Inicio del semestre III' },
  { valor: 'fin-IV', etiqueta: 'Fin del semestre IV' },
]
const MAX_BARRAS = 40

const VALIDACION = {
  Cumple: { icono: 'check_circle', clase: 'bg-surface-container-high text-on-primary-fixed-variant' },
  'En riesgo': { icono: 'warning', clase: 'bg-error-container text-on-error-container' },
  'Sin datos': { icono: 'remove', clase: 'bg-surface-container text-on-surface-variant' },
}

function Validacion({ estado }) {
  const v = VALIDACION[estado] ?? VALIDACION['Sin datos']
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-label-sm font-bold ${v.clase}`}>
      <Icono nombre={v.icono} className="text-[14px]" /> {estado}
    </span>
  )
}

function Selector({ etiqueta, valor, onChange, opciones, todos = 'Todos' }) {
  return (
    <label className="flex min-w-40 flex-1 flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">
      {etiqueta}
      <select
        className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md normal-case text-on-surface"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      >
        {todos && <option value="">{todos}</option>}
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    </label>
  )
}

// Consolidado académico de resultados de aprendizaje (RF-RA-03, RF-RA-04; mockup Coordinador).
export default function ConsolidadoRAPage() {
  const [filtros, setFiltros] = useState({ agrupar: 'ra', momento: 'todos', cohorte: '', modulo: '', catalogo: '', periodo: '' })
  const [busqueda, setBusqueda] = useState('')
  const [exportando, setExportando] = useState(false)
  const params = useMemo(() => Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '')), [filtros])

  const reporte = useApi(() => raApi.reporteRA(params), [JSON.stringify(params)])
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const catalogo = useApi(cursosApi.catalogo)
  const ofertas = useApi(() => cursosApi.listarOfertas())

  const cambiar = (clave) => (valor) => setFiltros((f) => ({ ...f, [clave]: valor }))

  if (reporte.cargando && !reporte.data) return <Cargando texto="Calculando resultados de aprendizaje…" />
  if (reporte.error) return <ErrorApi error={reporte.error} onReintentar={reporte.recargar} />

  const { meta, porRA, filas } = reporte.data
  const niveles = meta.niveles
  const modulos = [...new Map((catalogo.data ?? []).map((k) => [k.id_modulo, k.modulo])).entries()]
  const periodos = [...new Set((ofertas.data ?? []).map((o) => o.periodo))].sort().reverse()
  const agrupacion = AGRUPACIONES.find((a) => a.valor === meta.agrupar)
  const q = busqueda.trim().toLowerCase()
  const matriz = porRA.filter((r) => !q || r.grupo.toLowerCase().includes(q) || r.descripcion.toLowerCase().includes(q))

  const series = niveles.map((n) => ({ clave: n.nivel, nombre: n.etiqueta, color: COLOR_NIVEL[n.nivel] }))
  const datosGrafico = filas.map((f) => ({ grupo: f.etiqueta, ...Object.fromEntries(niveles.map((n) => [n.nivel, f[n.nivel]])) }))
  const tablaGrafico = {
    columnas: [{ clave: 'grupo', titulo: agrupacion.etiqueta }, ...series.map((s) => ({ clave: s.clave, titulo: s.nombre, formato: numero }))],
    filas: datosGrafico,
  }

  const exportar = async () => {
    setExportando(true)
    try {
      await raApi.exportarRA(params)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
            <Icono nombre="fact_check" className="text-[16px]" />
            Aseguramiento de la calidad curricular
          </div>
          <h1 className="mt-1 font-display text-headline-lg text-primary">Consolidado académico de RA</h1>
          <p className="max-w-3xl text-body-md text-on-surface-variant">
            Distribución de los estudiantes por nivel de logro en las rúbricas de RA1 a RA7. El nivel de cada estudiante en
            un RA es el promedio de sus rúbricas completas dentro de los filtros.
          </p>
        </div>
        <div className="flex gap-space-sm">
          <Link to="rubricas" className="btn btn-secundario no-underline">
            <Icono nombre="rule" className="text-[18px]" /> Matriz de rúbricas
          </Link>
          <button type="button" className="btn btn-primario" onClick={exportar} disabled={exportando}>
            <Icono nombre="file_download" className="text-[18px]" /> {exportando ? 'Exportando…' : 'Exportar a Excel'}
          </button>
        </div>
      </header>

      <section className="flex flex-wrap gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm" aria-label="Filtros del reporte">
        <Selector etiqueta="Agrupar por" valor={filtros.agrupar} onChange={cambiar('agrupar')} todos={null}
          opciones={AGRUPACIONES} />
        <Selector etiqueta="Momento de análisis" valor={filtros.momento} onChange={cambiar('momento')} todos={null}
          opciones={MOMENTOS} />
        <Selector etiqueta="Promoción" valor={filtros.cohorte} onChange={cambiar('cohorte')} todos="Todas"
          opciones={(cohortes.data ?? []).map((c) => ({ valor: String(c.id_cohorte), etiqueta: c.nombre }))} />
        <Selector etiqueta="Periodo" valor={filtros.periodo} onChange={cambiar('periodo')}
          opciones={periodos.map((p) => ({ valor: p, etiqueta: p }))} />
        <Selector etiqueta="Módulo" valor={filtros.modulo} onChange={cambiar('modulo')}
          opciones={modulos.map(([id, nombre]) => ({ valor: String(id), etiqueta: nombre }))} />
        <Selector etiqueta="Curso del plan" valor={filtros.catalogo} onChange={cambiar('catalogo')}
          opciones={(catalogo.data ?? []).map((k) => ({ valor: String(k.id_catalogo), etiqueta: `${k.codigo} · ${k.nombre}` }))} />
      </section>

      <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi etiqueta="Cumplimiento RA" valor={meta.cumplimiento === null ? '—' : porcentaje(meta.cumplimiento)} icono="military_tech" destacado>
          <BarraProgreso fraccion={meta.cumplimiento} />
          <p className="mt-2 text-body-sm text-on-surface-variant">% en nivel Alto o Medio · meta {meta.meta_satisfactorio_pct} %</p>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Estudiantes evaluados" valor={numero(meta.estudiantes_evaluados)} icono="groups">
          <Insignia>{numero(meta.unidades)} resultados estudiante–RA</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="RA en riesgo" valor={numero(meta.ras_en_riesgo)} icono="warning">
          <Insignia tono={meta.ras_en_riesgo ? 'acento' : 'neutro'}>
            {meta.ras_en_riesgo ? 'Por debajo de la meta' : 'Todos cumplen o sin datos'}
          </Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Rúbricas incompletas" valor={numero(meta.rubricas_incompletas)} icono="pending_actions">
          <p className="text-body-sm text-on-surface-variant">No cuentan hasta que el docente registre todos los criterios.</p>
        </TarjetaKpi>
      </section>

      <ChartCard
        titulo={`Distribución por nivel · ${agrupacion.etiqueta.toLowerCase()}`}
        subtitulo="Número de estudiantes en cada nivel de la rúbrica"
        tabla={tablaGrafico}
        altura="h-80"
      >
        {datosGrafico.length === 0 ? (
          <p className="texto-suave">No hay rúbricas completas con estos filtros.</p>
        ) : datosGrafico.length > MAX_BARRAS ? (
          <p className="texto-suave">Hay {datosGrafico.length} grupos: use «Ver tabla» o acote los filtros para ver la gráfica.</p>
        ) : (
          <GraficoBarras datos={datosGrafico} ejeX="grupo" series={series} apilado formato={numero} />
        )}
      </ChartCard>

      <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex flex-col justify-between gap-space-sm pb-space-md sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-headline-md text-primary">Matriz de medición de resultados de aprendizaje</h2>
            <p className="text-body-sm text-on-surface-variant">
              Un RA cumple cuando al menos el {meta.meta_satisfactorio_pct} % de los evaluados queda en nivel Alto o Medio
              (parámetro editable en Información académica › Parámetros).
            </p>
          </div>
          <div className="relative">
            <Icono nombre="search" className="absolute left-3 top-2.5 text-[18px] text-on-surface-variant" />
            <input
              className="rounded-xl bg-surface-container-low py-1.5 pl-9 pr-3 text-body-sm text-on-surface focus:bg-surface-container focus:outline-none"
              placeholder="Filtrar por código o texto…"
              aria-label="Filtrar resultados de aprendizaje"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="bg-surface-container-low text-label-sm uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Resultado de aprendizaje</th>
                <th className="px-4 py-3 text-center">Evaluados</th>
                <th className="px-4 py-3">Nivel Alto</th>
                <th className="px-4 py-3">Medio</th>
                <th className="px-4 py-3">Básico</th>
                <th className="px-4 py-3">Insuficiente</th>
                <th className="px-4 py-3 text-center">Promedio</th>
                <th className="px-4 py-3 text-center">Validación</th>
              </tr>
            </thead>
            <tbody>
              {matriz.map((r) => (
                <tr key={r.grupo} className="transition-colors hover:bg-surface-container-low/50">
                  <td className="px-4 py-3 font-bold text-primary">{r.grupo}</td>
                  <td className="max-w-md px-4 py-3" title={r.descripcion}>
                    <span className="line-clamp-2">{r.descripcion}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold">{numero(r.evaluados)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-12 font-bold text-primary">{r.evaluados ? porcentaje(r.pct.Alto) : '—'}</span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-container-highest">
                        <div className="h-full rounded-full bg-secondary" style={{ width: `${(r.pct.Alto ?? 0) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  {['Medio', 'Basico', 'Insuficiente'].map((n) => (
                    <td key={n} className="px-4 py-3 text-on-surface-variant">{r.evaluados ? porcentaje(r.pct[n]) : '—'}</td>
                  ))}
                  <td className="px-4 py-3 text-center">{r.promedio === null ? '—' : r.promedio.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center"><Validacion estado={r.validacion} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {meta.agrupar !== 'ra' && (
        <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <h2 className="pb-space-md font-display text-headline-md text-primary">Detalle por {agrupacion.etiqueta.toLowerCase()}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="bg-surface-container-low text-label-sm uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3">{agrupacion.etiqueta}</th>
                  <th className="px-4 py-3 text-center">Evaluados</th>
                  {niveles.map((n) => <th key={n.nivel} className="px-4 py-3">{n.etiqueta}</th>)}
                  <th className="px-4 py-3 text-center">Promedio</th>
                  <th className="px-4 py-3 text-center">Validación</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.grupo} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 font-medium text-primary">{f.etiqueta}</td>
                    <td className="px-4 py-3 text-center font-bold">{numero(f.evaluados)}</td>
                    {niveles.map((n) => (
                      <td key={n.nivel} className="px-4 py-3 text-on-surface-variant">{numero(f[n.nivel])} ({porcentaje(f.pct[n.nivel])})</td>
                    ))}
                    <td className="px-4 py-3 text-center">{f.promedio.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center"><Validacion estado={f.validacion} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
