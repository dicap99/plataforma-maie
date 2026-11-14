import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import * as cursosApi from '../../api/cursosApi'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import GraficoBarras from '../../components/charts/GraficoBarras.jsx'
import GraficoLineas from '../../components/charts/GraficoLineas.jsx'
import { SERIES } from '../../components/charts/paleta'
import TarjetaKpi, { BarraProgreso, Insignia } from '../admin/panel/TarjetaKpi.jsx'
import { numero, porcentaje } from '../../utils/formato'
import NivelInsignia from './NivelInsignia.jsx'
import { COLOR_NIVEL } from './rubrica'

// Análisis del programa sobre los resultados de aprendizaje (asesoría 20-oct: «estadísticas,
// histograma»; RA MaIE: distribución de los estudiantes por nivel). Todo se calcula en el backend
// (/ra/reportes/analisis); la página solo presenta las cifras, sin valores fijos ni conclusiones
// automáticas (la interpretación la hace Coordinación).
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'summarize' },
  { id: 'evolucion', etiqueta: 'Promociones y semestres', icono: 'timeline' },
  { id: 'cursos', etiqueta: 'Cursos y criterios', icono: 'menu_book' },
]
const FILTROS_VACIOS = { cohorte: '', periodo: '', modulo: '', ra: '' }
const fraccion = (v) => porcentaje(v)
const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== ''))

function Selector({ etiqueta, valor, onChange, opciones, todos = 'Todos' }) {
  return (
    <label className="flex min-w-44 flex-1 flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">
      {etiqueta}
      <select className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md normal-case text-on-surface"
        value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{todos}</option>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    </label>
  )
}

// Histograma de notas estudiante–RA: cada intervalo de 0,5 cae entero en un nivel de la rúbrica,
// así que cada barra lleva el color de su nivel (la leyenda lo nombra; no depende solo del color).
function Histograma({ bins, niveles }) {
  const series = [...niveles].reverse().map((n) => ({ clave: n.nivel, nombre: `${n.etiqueta} (${n.rango})`, color: COLOR_NIVEL[n.nivel] }))
  const datos = bins.map((b) => ({ intervalo: b.etiqueta, ...Object.fromEntries(niveles.map((n) => [n.nivel, n.nivel === b.nivel ? b.estudiantes : null])) }))
  const tabla = {
    columnas: [{ clave: 'etiqueta', titulo: 'Nota del RA' }, { clave: 'nivel_etiqueta', titulo: 'Nivel' }, { clave: 'estudiantes', titulo: 'Resultados estudiante–RA', formato: numero }],
    filas: bins.map((b) => ({ ...b, nivel_etiqueta: niveles.find((n) => n.nivel === b.nivel)?.etiqueta })),
  }
  const total = bins.reduce((s, b) => s + b.estudiantes, 0)
  return (
    <ChartCard titulo="Histograma de notas por resultado de aprendizaje"
      subtitulo="Número de resultados estudiante–RA en cada intervalo de 0,5 de la nota consolidada" tabla={tabla} altura="h-80">
      {total === 0 ? <p className="texto-suave">No hay rúbricas completas con estos filtros.</p>
        : <GraficoBarras datos={datos} ejeX="intervalo" series={series} apilado formato={numero} />}
    </ChartCard>
  )
}

function SatisfactorioPorRA({ porRA, meta }) {
  const datos = porRA.filter((r) => r.evaluados).map((r) => ({ ra: r.grupo, pct: r.pct_satisfactorio, evaluados: r.evaluados }))
  const tabla = {
    columnas: [
      { clave: 'grupo', titulo: 'RA' }, { clave: 'evaluados', titulo: 'Evaluados', formato: numero },
      { clave: 'satisfactorio', titulo: 'Alto + Medio', formato: numero }, { clave: 'pct_satisfactorio', titulo: '% satisfactorio', formato: fraccion },
      { clave: 'promedio', titulo: 'Promedio', formato: (v) => (v === null ? '—' : v.toFixed(2)) }, { clave: 'validacion', titulo: 'Validación' },
    ],
    filas: porRA,
  }
  return (
    <ChartCard titulo="% satisfactorio por RA frente a la meta"
      subtitulo={`Estudiantes en nivel Alto o Medio; la línea marca la meta del ${meta} %`} tabla={tabla} altura="h-80">
      {datos.length === 0 ? <p className="texto-suave">No hay rúbricas completas con estos filtros.</p>
        : <GraficoBarras datos={datos} ejeX="ra" series={[{ clave: 'pct', nombre: '% satisfactorio', color: SERIES[0] }]}
          formato={fraccion} dominio={[0, 1]} referencia={{ valor: meta / 100, etiqueta: `Meta ${meta} %` }} />}
    </ChartCard>
  )
}

// Serie de % satisfactorio (programa y cada RA) a lo largo de promociones o semestres.
function Evolucion({ titulo, subtitulo, serie, ras, meta, eje }) {
  const conDatos = ras.filter((r) => serie.some((s) => s.ra[r]))
  const series = [
    { clave: 'programa', nombre: 'Programa', color: SERIES[0] },
    ...conDatos.map((r) => ({ clave: r, nombre: r, color: SERIES[ras.indexOf(r) + 1] })),
  ]
  const datos = serie.map((s) => ({
    grupo: s.etiqueta.replace(/^Promoción /, ''), programa: s.pct_satisfactorio,
    ...Object.fromEntries(conDatos.map((r) => [r, s.ra[r]?.pct_satisfactorio ?? null])),
  }))
  const tabla = {
    columnas: [{ clave: 'grupo', titulo: eje }, { clave: 'evaluados', titulo: 'Evaluados', formato: numero },
      ...series.map((s) => ({ clave: s.clave, titulo: `% ${s.nombre}`, formato: fraccion }))],
    filas: datos.map((d, i) => ({ ...d, evaluados: serie[i].evaluados })),
  }
  return (
    <ChartCard titulo={titulo} subtitulo={subtitulo} tabla={tabla} altura="h-80">
      {datos.length === 0 ? <p className="texto-suave">No hay rúbricas completas con estos filtros.</p>
        : datos.length === 1 ? <p className="texto-suave">Solo hay datos de {datos[0].grupo}: se necesitan al menos dos para ver la evolución (use «Ver tabla»).</p>
          : <GraficoLineas datos={datos} ejeX="grupo" series={series} formato={fraccion} dominio={[0, 1]} conectarVacios
            referencia={{ valor: meta / 100, etiqueta: `Meta ${meta} %` }} />}
    </ChartCard>
  )
}

function NivelesPorGrupo({ titulo, serie, niveles, eje }) {
  const series = niveles.map((n) => ({ clave: n.nivel, nombre: n.etiqueta, color: COLOR_NIVEL[n.nivel] }))
  const datos = serie.map((s) => ({ grupo: s.etiqueta.replace(/^Promoción /, ''), ...Object.fromEntries(niveles.map((n) => [n.nivel, s[n.nivel]])) }))
  const tabla = { columnas: [{ clave: 'grupo', titulo: eje }, ...series.map((s) => ({ clave: s.clave, titulo: s.nombre, formato: numero }))], filas: datos }
  return (
    <ChartCard titulo={titulo} subtitulo="Número de resultados estudiante–RA en cada nivel de la rúbrica" tabla={tabla} altura="h-80">
      {datos.length === 0 ? <p className="texto-suave">No hay rúbricas completas con estos filtros.</p>
        : <GraficoBarras datos={datos} ejeX="grupo" series={series} apilado formato={numero} />}
    </ChartCard>
  )
}

// Todos los criterios evaluados, del promedio más bajo al más alto (solo rúbricas completas).
function TablaCriterios({ criterios, niveles }) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <h2 className="m-0 font-display text-headline-sm text-primary">Desempeño por criterio de rúbrica</h2>
      <p className="m-0 mb-space-sm text-body-sm text-on-surface-variant">
        {criterios.length} criterio(s) evaluados, ordenados del promedio más bajo al más alto. Solo cuentan las rúbricas completas.
      </p>
      <div className="tabla-scroll">
        <table className="text-body-sm">
          <thead>
            <tr><th>RA</th><th>Criterio</th><th className="num">Peso</th><th className="num">Notas</th><th className="num">Promedio</th>
              <th>Nivel del promedio</th><th className="num">% insuficiente</th></tr>
          </thead>
          <tbody>
            {criterios.map((c) => (
              <tr key={c.id_criterio}>
                <td className="font-bold text-primary">{c.ra}</td>
                <td>C{c.orden}. {c.nombre}</td>
                <td className="num">{c.peso_porcentaje} %</td>
                <td className="num">{numero(c.notas)}</td>
                <td className="num font-bold">{c.promedio.toFixed(2)}</td>
                <td><NivelInsignia nivel={c.nivel} /></td>
                <td className="num">{fraccion(c.pct_insuficiente)}</td>
              </tr>
            ))}
            {criterios.length === 0 && <tr><td colSpan={7} className="texto-suave">No hay rúbricas completas con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function AnalisisRAPage() {
  const [params, setParams] = useSearchParams()
  const activo = PESTANAS.some((p) => p.id === params.get('pestana')) ? params.get('pestana') : PESTANAS[0].id
  const [f, setF] = useState(FILTROS_VACIOS)
  const [exportando, setExportando] = useState(false)
  const [errorExportar, setErrorExportar] = useState(null)

  const consulta = useMemo(() => sinVacios(f), [f])
  const clave = JSON.stringify(consulta)
  const analisis = useApi(() => raApi.analisisRA(consulta), [clave])
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const catalogo = useApi(cursosApi.catalogo)
  const ofertas = useApi(() => cursosApi.listarOfertas())

  // useApi conserva los datos anteriores mientras recalcula con filtros nuevos.
  const d = analisis.data
  if (!d && analisis.cargando) return <Cargando texto="Calculando el análisis del programa…" />
  if (!d && analisis.error) return <ErrorApi error={analisis.error} onReintentar={analisis.recargar} />
  if (!d) return null

  const { meta, global } = d
  const metaPct = meta.meta_satisfactorio_pct
  const niveles = meta.niveles
  const ras = d.porRA.map((r) => r.grupo)
  const opcionesCohorte = [...(cohortes.data ?? [])].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? -1 : 1))
    .map((c) => ({ valor: String(c.id_cohorte), etiqueta: c.nombre }))
  const opcionesPeriodo = [...new Set((ofertas.data ?? []).map((o) => o.periodo))].sort().reverse().map((p) => ({ valor: p, etiqueta: p }))
  const opcionesModulo = [...new Map((catalogo.data ?? []).map((k) => [k.id_modulo, k.modulo])).entries()]
    .map(([id, nombre]) => ({ valor: String(id), etiqueta: nombre }))
  const opcionesRA = d.porRA.map((r) => ({ valor: String(r.id_ra), etiqueta: r.grupo }))
  const cambiar = (campo) => (valor) => setF((x) => ({ ...x, [campo]: valor }))
  const elegirPestana = (id) => setParams((p) => { const n = new URLSearchParams(p); n.set('pestana', id); return n }, { replace: true })
  const enRiesgo = d.porRA.filter((r) => r.validacion === 'En riesgo')

  const exportar = async () => {
    setExportando(true)
    setErrorExportar(null)
    try {
      await raApi.exportarRA({ agrupar: 'ra', ...consulta })
    } catch (err) {
      setErrorExportar(err)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
            <Icono nombre="insights" className="text-[16px]" /> Resultados de aprendizaje
          </div>
          <h1 className="mt-1 font-display text-headline-lg text-primary">Análisis del programa</h1>
          <p className="max-w-3xl text-body-md text-on-surface-variant">
            Distribución de los estudiantes en los niveles de la rúbrica, cumplimiento de la meta del {metaPct} % y su evolución
            entre promociones y semestres. La unidad es el resultado de un estudiante en un RA (promedio de sus rúbricas completas).
          </p>
        </div>
        <div className="flex gap-space-sm">
          <Link to="/coordinacion/ra" className="btn btn-secundario no-underline">
            <Icono nombre="analytics" className="text-[18px]" /> Consolidado
          </Link>
          <button type="button" className="btn btn-primario" onClick={exportar} disabled={exportando}>
            <Icono nombre="file_download" className="text-[18px]" /> {exportando ? 'Exportando…' : 'Exportar a Excel'}
          </button>
        </div>
      </header>
      <ErrorApi error={errorExportar ?? analisis.error} onReintentar={analisis.error ? analisis.recargar : undefined} />

      <section className="flex flex-wrap items-end gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm" aria-label="Filtros">
        <Selector etiqueta="Promoción" valor={f.cohorte} onChange={cambiar('cohorte')} opciones={opcionesCohorte} todos="Todas" />
        <Selector etiqueta="Semestre académico" valor={f.periodo} onChange={cambiar('periodo')} opciones={opcionesPeriodo} />
        <Selector etiqueta="Componente de formación" valor={f.modulo} onChange={cambiar('modulo')} opciones={opcionesModulo} />
        <Selector etiqueta="Resultado de aprendizaje" valor={f.ra} onChange={cambiar('ra')} opciones={opcionesRA} />
        {Object.values(f).some(Boolean) && (
          <button type="button" className="btn btn-secundario" onClick={() => setF(FILTROS_VACIOS)}>Quitar filtros</button>
        )}
        {analisis.cargando && <span className="text-body-sm text-on-surface-variant" role="status">Recalculando…</span>}
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones del análisis">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={activo === p.id} onClick={() => elegirPestana(p.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-label-md font-semibold ${
              activo === p.id ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
            <Icono nombre={p.icono} className="text-[18px]" /> {p.etiqueta}
          </button>
        ))}
      </div>

      {activo === 'resumen' && (
        <>
          <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores">
            <TarjetaKpi etiqueta="Satisfactorio del programa" valor={global.evaluados ? porcentaje(global.pct_satisfactorio) : '—'} icono="military_tech" destacado>
              <BarraProgreso fraccion={global.pct_satisfactorio ?? 0} />
              <p className="mt-2 text-body-sm text-on-surface-variant">Nivel Alto o Medio · meta {metaPct} %</p>
            </TarjetaKpi>
            <TarjetaKpi etiqueta="Resultados evaluados" valor={numero(global.evaluados)} icono="groups">
              <Insignia>Promedio {global.promedio === null ? '—' : global.promedio.toFixed(2)}</Insignia>
            </TarjetaKpi>
            <TarjetaKpi etiqueta="RA en riesgo" valor={numero(enRiesgo.length)} icono="warning">
              <Insignia tono={enRiesgo.length ? 'acento' : 'neutro'}>{enRiesgo.length ? enRiesgo.map((r) => r.grupo).join(', ') : 'Ninguno'}</Insignia>
            </TarjetaKpi>
            <TarjetaKpi etiqueta="Rúbricas incompletas" valor={numero(meta.rubricas_incompletas)} icono="pending_actions">
              <p className="text-body-sm text-on-surface-variant">No cuentan hasta que el docente registre todos los criterios.</p>
            </TarjetaKpi>
          </section>
          <div className="grid grid-cols-1 gap-gutter xl:grid-cols-2">
            <Histograma bins={d.histograma} niveles={niveles} />
            <SatisfactorioPorRA porRA={d.porRA} meta={metaPct} />
          </div>
        </>
      )}

      {activo === 'evolucion' && (
        <>
          <Evolucion titulo="% satisfactorio por promoción" eje="Promoción" serie={d.porCohorte} ras={ras} meta={metaPct}
            subtitulo="Nivel Alto o Medio del programa y de cada RA; la leyenda muestra u oculta cada serie" />
          <Evolucion titulo="% satisfactorio por semestre académico" eje="Semestre académico" serie={d.porPeriodo} ras={ras} meta={metaPct}
            subtitulo="Cursos evaluados en cada semestre académico (cada curso se califica al final de su semestre)" />
          <div className="grid grid-cols-1 gap-gutter xl:grid-cols-2">
            <NivelesPorGrupo titulo="Niveles por promoción" serie={d.porCohorte} niveles={niveles} eje="Promoción" />
            <NivelesPorGrupo titulo="Niveles por semestre académico" serie={d.porPeriodo} niveles={niveles} eje="Semestre académico" />
          </div>
        </>
      )}

      {activo === 'cursos' && (
        <>
          <ChartCard titulo="% satisfactorio por curso del plan" subtitulo={`Nivel Alto o Medio en los RA que evalúa cada curso; la línea marca la meta del ${metaPct} %`}
            altura="h-96" tabla={{
              columnas: [{ clave: 'etiqueta', titulo: 'Curso' }, { clave: 'evaluados', titulo: 'Evaluados', formato: numero },
                { clave: 'pct_satisfactorio', titulo: '% satisfactorio', formato: fraccion },
                { clave: 'promedio', titulo: 'Promedio', formato: (v) => v.toFixed(2) }, { clave: 'validacion', titulo: 'Validación' }],
              filas: d.porCurso,
            }}>
            {d.porCurso.length === 0 ? <p className="texto-suave">No hay rúbricas completas con estos filtros.</p>
              : <GraficoBarras horizontal anchoEtiquetas={220} datos={d.porCurso.map((c) => ({ curso: c.etiqueta, pct: c.pct_satisfactorio }))}
                ejeX="curso" series={[{ clave: 'pct', nombre: '% satisfactorio', color: SERIES[0] }]} formato={fraccion} dominio={[0, 1]}
                referencia={{ valor: metaPct / 100, etiqueta: `Meta ${metaPct} %` }} />}
          </ChartCard>
          <TablaCriterios criterios={d.criterios} niveles={niveles} />
        </>
      )}

      <details className="rounded-xl bg-surface-container-low p-space-md text-body-sm text-on-surface-variant">
        <summary className="cursor-pointer font-semibold text-primary">Cómo se calcula</summary>
        <ul className="mt-2 list-disc pl-5">
          <li>Satisfactorio = nivel Alto o Medio de la rúbrica institucional; un RA cumple si alcanza la meta del {metaPct} % (parámetro del programa).</li>
          <li>Un estudiante cuenta una vez por RA (promedio de sus rúbricas completas); por promoción, semestre o curso, una vez en cada grupo.</li>
          <li>Rúbricas con notas parciales no cuentan hasta completarse ({numero(meta.rubricas_incompletas)} con estos filtros).</li>
        </ul>
      </details>
    </div>
  )
}
