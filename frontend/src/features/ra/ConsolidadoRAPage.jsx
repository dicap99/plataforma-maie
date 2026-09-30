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
import NivelInsignia from './NivelInsignia.jsx'
import { COLOR_NIVEL } from './rubrica'

// Opciones de «Agrupar por» y los filtros propios de cada una, en el orden en que se muestran.
const OPCIONES = [
  {
    valor: 'ra', etiqueta: 'Resultado de aprendizaje', icono: 'fact_check',
    descripcion: 'Distribución de niveles en RA1–RA7 y desglose de un RA por curso del plan.',
    filtros: ['ra', 'cohorte', 'periodo', 'catalogo'],
  },
  {
    valor: 'cohorte', etiqueta: 'Promoción', icono: 'groups',
    descripcion: 'Compara promociones o revisa los RA de una promoción y de sus cursos.',
    filtros: ['cohorte', 'modulo', 'ra', 'curso'],
  },
  {
    valor: 'estudiante', etiqueta: 'Estudiante', icono: 'person_search',
    descripcion: 'Nota y nivel de cada estudiante de una promoción en cada RA, o el perfil de uno.',
    filtros: ['cohorte', 'estudiante', 'ra'],
  },
]
const FILTROS_VACIOS = { ra: '', cohorte: '', catalogo: '', periodo: '', modulo: '', curso: '', estudiante: '' }
const MAX_BARRAS = 40
const MAX_SUGERENCIAS = 8

// ¿La oferta cumple el filtro `campo` con el valor elegido? (ctx traduce RA y componente).
const cumple = (o, campo, valor, ctx) => {
  if (!valor) return true
  switch (campo) {
    case 'ra': return o.ras.includes(ctx.codigoRA.get(valor))
    case 'cohorte': return String(o.id_cohorte) === valor
    case 'periodo': return o.periodo === valor
    case 'catalogo': return String(o.id_catalogo) === valor
    case 'modulo': return String(ctx.moduloDe.get(o.id_catalogo)) === valor
    case 'curso': return String(o.id_curso) === valor
    default: return true
  }
}

// Opciones válidas de un filtro según los filtros anteriores en el flujo de la opción elegida:
// se derivan de las ofertas que cumplen todo lo ya seleccionado, así nunca se ofrece una
// combinación sin cursos (p. ej. un curso de semestre III tras elegir 2025-A si no se dictó ahí).
const opcionesDe = (campo, f, orden, ctx) => {
  const previos = orden.slice(0, orden.indexOf(campo))
  const ofertas = ctx.ofertas.filter((o) => previos.every((p) => cumple(o, p, f[p], ctx)))
  const unicos = (fn) => [...new Set(ofertas.flatMap(fn))]
  switch (campo) {
    case 'ra': {
      const codigos = new Set(unicos((o) => o.ras))
      return ctx.ras.filter((r) => codigos.has(r.grupo)).map((r) => ({ valor: String(r.id_ra), etiqueta: r.grupo }))
    }
    case 'cohorte': {
      const ids = new Set(unicos((o) => [o.id_cohorte]))
      return ctx.cohortes.filter((c) => ids.has(c.id_cohorte)).map((c) => ({ valor: String(c.id_cohorte), etiqueta: c.nombre }))
    }
    case 'periodo':
      return unicos((o) => [o.periodo]).sort().reverse().map((p) => ({ valor: p, etiqueta: p }))
    case 'catalogo': {
      const ids = new Set(unicos((o) => [o.id_catalogo]))
      return ctx.catalogo.filter((k) => ids.has(k.id_catalogo)).map((k) => ({ valor: String(k.id_catalogo), etiqueta: `${k.codigo} · ${k.nombre}` }))
    }
    case 'modulo': {
      const ids = new Set(unicos((o) => [ctx.moduloDe.get(o.id_catalogo)]))
      return ctx.modulos.filter(([id]) => ids.has(id)).map(([id, nombre]) => ({ valor: String(id), etiqueta: nombre }))
    }
    case 'curso':
      return ofertas.map((o) => ({ valor: String(o.id_curso), etiqueta: `${o.codigo} · ${o.nombre} (${o.periodo})` }))
    default:
      return []
  }
}

// Deja en blanco, en orden, cada filtro cuyo valor ya no es válido tras un cambio anterior.
const depurar = (f, orden, ctx) => {
  const limpio = { ...f }
  for (const campo of orden) {
    if (campo === 'estudiante' || !limpio[campo]) continue
    if (!opcionesDe(campo, limpio, orden, ctx).some((o) => o.valor === limpio[campo])) limpio[campo] = ''
  }
  return limpio
}

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

function Selector({ etiqueta, valor, onChange, opciones, todos = 'Todos', disabled = false, ayuda }) {
  return (
    <label className="flex min-w-48 flex-1 flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">
      {etiqueta}
      <select
        className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md normal-case text-on-surface disabled:opacity-50"
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {todos && <option value="">{todos}</option>}
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
      {ayuda && <span className="text-body-sm font-normal normal-case text-outline">{ayuda}</span>}
    </label>
  )
}

// Buscador de estudiantes de la promoción: filtra por nombre o código mientras se escribe.
function BuscadorEstudiante({ estudiantes, valor, onChange, disabled }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const elegido = estudiantes.find((e) => e.id_estudiante === valor)
  const q = texto.trim().toLowerCase()
  const coincidencias = estudiantes
    .filter((e) => !q || `${e.nombres} ${e.apellidos} ${e.apellidos} ${e.nombres} ${e.identificacion}`.toLowerCase().includes(q))
    .slice(0, MAX_SUGERENCIAS)
  const elegir = (id) => {
    onChange(id)
    setTexto('')
    setAbierto(false)
  }

  return (
    <div className="relative flex min-w-64 flex-1 flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">
      <label htmlFor="buscar-estudiante">Estudiante</label>
      {elegido ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-secondary bg-secondary-fixed/30 px-3 py-2 text-body-md normal-case text-on-surface">
          <span className="truncate"><strong>{elegido.apellidos} {elegido.nombres}</strong> · {elegido.identificacion}</span>
          <button type="button" className="btn-enlace shrink-0" onClick={() => elegir('')} aria-label="Quitar estudiante">
            <Icono nombre="close" className="text-[18px]" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Icono nombre="search" className="absolute left-3 top-2.5 text-[20px] text-outline" />
          <input
            id="buscar-estudiante"
            type="search"
            role="combobox"
            aria-expanded={abierto}
            aria-controls="sugerencias-estudiante"
            autoComplete="off"
            disabled={disabled}
            placeholder={disabled ? 'Elija primero una promoción' : `Buscar entre ${estudiantes.length} estudiantes por nombre o código…`}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-md normal-case text-on-surface disabled:opacity-50"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && coincidencias.length) { e.preventDefault(); elegir(coincidencias[0].id_estudiante) }
              if (e.key === 'Escape') setAbierto(false)
            }}
          />
          {abierto && !disabled && (
            <ul id="sugerencias-estudiante" role="listbox"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl bg-surface-container-lowest py-1 normal-case shadow-lg">
              {coincidencias.map((e) => (
                <li key={e.id_estudiante} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => elegir(e.id_estudiante)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-body-md text-on-surface hover:bg-surface-container-low">
                    <span>{e.apellidos} {e.nombres}</span>
                    <span className="text-body-sm text-on-surface-variant">{e.identificacion}</span>
                  </button>
                </li>
              ))}
              {coincidencias.length === 0 && <li className="px-3 py-2 text-body-sm text-on-surface-variant">Sin coincidencias</li>}
            </ul>
          )}
        </div>
      )}
      <span className="text-body-sm font-normal normal-case text-outline">
        {elegido ? 'Perfil del estudiante' : 'Vacío: toda la promoción'}
      </span>
    </div>
  )
}

function Seccion({ titulo, subtitulo, acciones, children }) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="flex flex-col justify-between gap-space-sm pb-space-md sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-headline-md text-primary">{titulo}</h2>
          {subtitulo && <p className="text-body-sm text-on-surface-variant">{subtitulo}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  )
}

const CABECERA = 'bg-surface-container-low text-label-sm uppercase tracking-wider text-on-surface-variant'

// Matriz del mockup: una fila por grupo con % por nivel, promedio y validación contra la meta.
function Matriz({ filas, primera, descripcion = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className={CABECERA}>
            <th className="px-4 py-3">{primera}</th>
            {descripcion && <th className="px-4 py-3">Resultado de aprendizaje</th>}
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
          {filas.map((r) => (
            <tr key={r.grupo} className="transition-colors hover:bg-surface-container-low/50">
              <td className="px-4 py-3 font-bold text-primary">{r.etiqueta}</td>
              {descripcion && (
                <td className="max-w-md px-4 py-3" title={r.descripcion}><span className="line-clamp-2">{r.descripcion}</span></td>
              )}
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
              <td className="px-4 py-3 text-center">{r.promedio === null || r.promedio === undefined ? '—' : r.promedio.toFixed(2)}</td>
              <td className="px-4 py-3 text-center"><Validacion estado={r.validacion} /></td>
            </tr>
          ))}
          {filas.length === 0 && <tr><td colSpan={9} className="px-4 py-3 texto-suave">No hay rúbricas completas con estos filtros.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Histograma({ titulo, filas, niveles, eje }) {
  const series = niveles.map((n) => ({ clave: n.nivel, nombre: n.etiqueta, color: COLOR_NIVEL[n.nivel] }))
  const datos = filas.filter((f) => f.evaluados).map((f) => ({ grupo: f.etiqueta, ...Object.fromEntries(niveles.map((n) => [n.nivel, f[n.nivel]])) }))
  const tabla = {
    columnas: [{ clave: 'grupo', titulo: eje }, ...series.map((s) => ({ clave: s.clave, titulo: s.nombre, formato: numero }))],
    filas: datos,
  }
  return (
    <ChartCard titulo={titulo} subtitulo="Número de estudiantes en cada nivel de la rúbrica" tabla={tabla} altura="h-80">
      {datos.length === 0 ? <p className="texto-suave">No hay rúbricas completas con estos filtros.</p>
        : datos.length > MAX_BARRAS ? <p className="texto-suave">Hay {datos.length} grupos: use «Ver tabla» o acote los filtros.</p>
          : <GraficoBarras datos={datos} ejeX="grupo" series={series} apilado formato={numero} />}
    </ChartCard>
  )
}

// Estudiantes × RA: nota y nivel de cada estudiante de la promoción en cada RA evaluado.
function TablaEstudiantes({ filas, ras, onVer }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className={CABECERA}>
            <th className="px-4 py-3">Estudiante</th>
            {ras.map((ra) => <th key={ra} className="px-3 py-3 text-center">{ra}</th>)}
            <th className="px-4 py-3 text-center">Promedio</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.grupo} className="hover:bg-surface-container-low/50">
              <td className="px-4 py-3">
                <button type="button" className="btn-enlace font-semibold" onClick={() => onVer(f.grupo)}>{f.etiqueta}</button>
              </td>
              {ras.map((ra) => (
                <td key={ra} className="px-3 py-3 text-center">
                  {f.detalle[ra] ? <NivelInsignia nivel={f.detalle[ra].nivel} total={f.detalle[ra].total} /> : <span className="text-outline">—</span>}
                </td>
              ))}
              <td className="px-4 py-3 text-center font-bold text-primary">{f.promedio.toFixed(2)}</td>
            </tr>
          ))}
          {filas.length === 0 && <tr><td colSpan={ras.length + 2} className="px-4 py-3 texto-suave">No hay rúbricas completas para esta promoción.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// Perfil de un estudiante: su nivel consolidado por RA y el resultado de cada curso.
function PerfilEstudiante({ porRA, detalle }) {
  const evaluados = porRA.filter((r) => r.evaluados)
  const nivelDe = (r) => ['Alto', 'Medio', 'Basico', 'Insuficiente'].find((n) => r[n] > 0)
  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-4 xl:grid-cols-7">
        {porRA.map((r) => (
          <div key={r.grupo} className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-low p-space-sm text-center">
            <span className="font-display text-headline-sm text-primary">{r.grupo}</span>
            {r.evaluados ? <NivelInsignia nivel={nivelDe(r)} total={r.promedio} /> : <span className="text-body-sm text-outline">Sin evaluar</span>}
          </div>
        ))}
      </div>
      {evaluados.length === 0 && <p className="texto-suave">El estudiante no tiene rúbricas completas.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className={CABECERA}>
              <th className="px-4 py-3">Curso</th><th className="px-4 py-3">Semestre</th><th className="px-4 py-3">RA</th>
              <th className="px-4 py-3 text-center">Nota</th><th className="px-4 py-3">Nivel</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((d, i) => (
              <tr key={i} className="hover:bg-surface-container-low/50">
                <td className="px-4 py-3"><strong>{d.curso_codigo}</strong> · {d.curso_nombre}</td>
                <td className="px-4 py-3">{d.periodo}</td>
                <td className="px-4 py-3 font-bold text-primary">{d.ra}</td>
                <td className="px-4 py-3 text-center">{d.total === null ? '—' : d.total.toFixed(2)}</td>
                <td className="px-4 py-3">{d.completo ? <NivelInsignia nivel={d.nivel} /> : <span className="text-body-sm text-outline">Rúbrica incompleta</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined))
const vacio = () => Promise.resolve({ data: null })

// Consolidado académico de resultados de aprendizaje (RF-RA-03, RF-RA-04; mockup Coordinador).
// Primero se elige cómo agrupar; después aparecen los filtros propios de esa opción, en cascada.
export default function ConsolidadoRAPage() {
  const [agrupar, setAgrupar] = useState('')
  const [f, setF] = useState(FILTROS_VACIOS)
  const [exportando, setExportando] = useState(false)

  const general = useApi(() => raApi.reporteRA({}))
  const catalogo = useApi(cursosApi.catalogo)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const ofertas = useApi(() => cursosApi.listarOfertas())
  const estudiantes = useApi(() => (f.cohorte && agrupar === 'estudiante' ? cursosApi.estudiantesCohorte(f.cohorte) : vacio()), [f.cohorte, agrupar])

  // Consulta principal según la opción y los filtros; null mientras falte un filtro obligatorio.
  const params = useMemo(() => {
    if (agrupar === 'ra') return sinVacios({ agrupar: 'ra', ra: f.ra, cohorte: f.cohorte, catalogo: f.catalogo, periodo: f.periodo })
    if (agrupar === 'cohorte') {
      return f.cohorte
        ? sinVacios({ agrupar: 'ra', cohorte: f.cohorte, modulo: f.modulo, curso: f.curso, ra: f.ra })
        : sinVacios({ agrupar: 'cohorte', modulo: f.modulo, ra: f.ra })
    }
    if (agrupar === 'estudiante' && f.cohorte) {
      return f.estudiante
        ? sinVacios({ agrupar: 'ra', cohorte: f.cohorte, estudiante: f.estudiante, ra: f.ra })
        : sinVacios({ agrupar: 'estudiante', cohorte: f.cohorte, ra: f.ra })
    }
    return null
  }, [agrupar, f])
  const clave = JSON.stringify(params)
  const reporte = useApi(() => (params ? raApi.reporteRA(params) : vacio()), [clave])
  // Con un RA elegido, su desglose por curso del plan.
  const desglose = useApi(
    () => (agrupar === 'ra' && f.ra ? raApi.reporteRA({ ...params, agrupar: 'catalogo' }) : vacio()),
    [clave],
  )

  if (general.cargando && !general.data) return <Cargando texto="Calculando resultados de aprendizaje…" />
  if (general.error) return <ErrorApi error={general.error} onReintentar={general.recargar} />

  const { meta, porRA: porRAGeneral } = general.data
  const niveles = meta.niveles
  const opcion = OPCIONES.find((o) => o.valor === agrupar)
  const listaCohortes = [...(cohortes.data ?? [])].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? -1 : 1))
  const nombreCohorte = listaCohortes.find((c) => String(c.id_cohorte) === f.cohorte)?.nombre
  const raElegido = porRAGeneral.find((r) => String(r.id_ra) === f.ra)
  // Contexto del flujo de filtros: las ofertas reales cruzan RA, promoción, semestre y curso.
  const ctx = {
    ofertas: ofertas.data ?? [],
    ras: porRAGeneral,
    cohortes: listaCohortes,
    catalogo: catalogo.data ?? [],
    modulos: [...new Map((catalogo.data ?? []).map((k) => [k.id_modulo, k.modulo])).entries()],
    moduloDe: new Map((catalogo.data ?? []).map((k) => [k.id_catalogo, k.id_modulo])),
    codigoRA: new Map(porRAGeneral.map((r) => [String(r.id_ra), r.grupo])),
  }
  const orden = opcion?.filtros ?? []
  const opciones = (campo) => opcionesDe(campo, f, orden, ctx)

  const elegirAgrupacion = (valor) => {
    setAgrupar(valor)
    setF(FILTROS_VACIOS)
  }
  // Cambia un filtro y limpia los posteriores que dejaron de ser válidos.
  const cambiar = (campo) => (valor) =>
    setF((x) => {
      const nuevo = { ...x, [campo]: valor }
      if (campo === 'cohorte') nuevo.estudiante = ''
      return depurar(nuevo, orden, ctx)
    })

  // Selector de curso: sin promoción no aplica; con un solo curso posible se inhabilita y se informa.
  const selectorCurso = (campo, etiqueta, requierePromocion) => {
    const lista = opciones(campo)
    const sinPromocion = requierePromocion && !f.cohorte
    const unico = !sinPromocion && lista.length === 1
    let ayuda
    if (sinPromocion) ayuda = 'Elija primero una promoción'
    else if (lista.length === 0) ayuda = 'Ningún curso coincide con la selección'
    else if (unico) ayuda = `Único curso con esta selección: ${lista[0].etiqueta}`
    else if (campo === 'catalogo' && raElegido) ayuda = `Cursos que evalúan ${raElegido.grupo}`
    return (
      <Selector key={campo} etiqueta={etiqueta} valor={f[campo]} onChange={cambiar(campo)} ayuda={ayuda}
        disabled={sinPromocion || unico || lista.length === 0} opciones={lista} />
    )
  }

  const CONTROLES = {
    ra: (
      <Selector key="ra" etiqueta="Resultado de aprendizaje" valor={f.ra} onChange={cambiar('ra')} opciones={opciones('ra')} />
    ),
    cohorte: (
      <Selector key="cohorte" etiqueta="Promoción" valor={f.cohorte} onChange={cambiar('cohorte')}
        todos={agrupar === 'estudiante' ? 'Seleccione…' : 'Todas'}
        ayuda={agrupar === 'estudiante' ? 'Obligatoria: limita la lista de estudiantes' : undefined}
        opciones={opciones('cohorte')} />
    ),
    periodo: (
      <Selector key="periodo" etiqueta="Semestre académico" valor={f.periodo} onChange={cambiar('periodo')} opciones={opciones('periodo')} />
    ),
    catalogo: selectorCurso('catalogo', 'Curso del plan', false),
    modulo: (
      <Selector key="modulo" etiqueta="Componente de formación" valor={f.modulo} onChange={cambiar('modulo')} opciones={opciones('modulo')} />
    ),
    curso: selectorCurso('curso', 'Curso', true),
    estudiante: (
      <BuscadorEstudiante key="estudiante" estudiantes={estudiantes.data ?? []} valor={f.estudiante}
        onChange={cambiar('estudiante')} disabled={!f.cohorte} />
    ),
  }

  const exportar = async () => {
    setExportando(true)
    try {
      await raApi.exportarRA(params)
    } finally {
      setExportando(false)
    }
  }

  const datos = reporte.data
  const verRA = (filas) => (f.ra ? filas.filter((r) => String(r.id_ra) === f.ra) : filas)
  const rasConDatos = datos?.filas ? [...new Set(datos.filas.flatMap((x) => Object.keys(x.detalle ?? {})))].sort() : []

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
            <Icono nombre="fact_check" className="text-[16px]" /> Aseguramiento de la calidad curricular
          </div>
          <h1 className="mt-1 font-display text-headline-lg text-primary">Consolidado académico de RA</h1>
          <p className="max-w-3xl text-body-md text-on-surface-variant">
            Distribución de los estudiantes por nivel de logro en las rúbricas de RA1 a RA7. El nivel de un estudiante en
            un RA es el promedio de sus rúbricas completas.
          </p>
        </div>
        <div className="flex gap-space-sm">
          <Link to="rubricas" className="btn btn-secundario no-underline">
            <Icono nombre="rule" className="text-[18px]" /> Matriz de rúbricas
          </Link>
          {params && (
            <button type="button" className="btn btn-primario" onClick={exportar} disabled={exportando}>
              <Icono nombre="file_download" className="text-[18px]" /> {exportando ? 'Exportando…' : 'Exportar a Excel'}
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores del programa">
        <TarjetaKpi etiqueta="Cumplimiento RA del programa" valor={meta.cumplimiento === null ? '—' : porcentaje(meta.cumplimiento)} icono="military_tech" destacado>
          <BarraProgreso fraccion={meta.cumplimiento} />
          <p className="mt-2 text-body-sm text-on-surface-variant">% en nivel Alto o Medio · meta {meta.meta_satisfactorio_pct} %</p>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Estudiantes evaluados" valor={numero(meta.estudiantes_evaluados)} icono="groups">
          <Insignia>{numero(meta.unidades)} resultados estudiante–RA</Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="RA en riesgo" valor={numero(meta.ras_en_riesgo)} icono="warning">
          <Insignia tono={meta.ras_en_riesgo ? 'acento' : 'neutro'}>
            {meta.ras_en_riesgo ? porRAGeneral.filter((r) => r.validacion === 'En riesgo').map((r) => r.grupo).join(', ') : 'Todos cumplen o sin datos'}
          </Insignia>
        </TarjetaKpi>
        <TarjetaKpi etiqueta="Rúbricas incompletas" valor={numero(meta.rubricas_incompletas)} icono="pending_actions">
          <p className="text-body-sm text-on-surface-variant">No cuentan hasta que el docente registre todos los criterios.</p>
        </TarjetaKpi>
      </section>

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <h2 className="text-label-md font-bold uppercase tracking-wider text-on-surface-variant">Agrupar por</h2>
        <div className="grid grid-cols-1 gap-space-sm md:grid-cols-3" role="radiogroup" aria-label="Agrupar por">
          {OPCIONES.map((o) => {
            const activa = o.valor === agrupar
            return (
              <button key={o.valor} type="button" role="radio" aria-checked={activa} onClick={() => elegirAgrupacion(o.valor)}
                className={`flex items-start gap-space-sm rounded-xl p-space-sm text-left transition-all ${
                  activa ? 'bg-secondary-fixed/40 shadow-sm ring-2 ring-secondary' : 'bg-surface-container-low hover:bg-surface-container'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${activa ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-secondary'}`}>
                  <Icono nombre={o.icono} />
                </span>
                <span>
                  <span className="block font-display text-headline-sm text-primary">{o.etiqueta}</span>
                  <span className="text-body-sm text-on-surface-variant">{o.descripcion}</span>
                </span>
              </button>
            )
          })}
        </div>
        {opcion && (
          <div className="flex flex-wrap gap-space-sm border-t border-outline-variant pt-space-md" aria-label="Filtros">
            {opcion.filtros.map((c) => CONTROLES[c])}
          </div>
        )}
      </section>

      {!opcion && (
        <div className="flex items-center gap-space-md rounded-xl bg-surface-container-low p-space-lg">
          <Icono nombre="touch_app" className="text-[32px] text-secondary" />
          <p className="text-body-md text-on-surface-variant">
            Elija cómo agrupar los resultados —por resultado de aprendizaje, por promoción o por estudiante— para ver los
            filtros y el reporte correspondiente.
          </p>
        </div>
      )}

      {opcion && !params && (
        <div className="card"><p>Elija una promoción para ver a sus estudiantes.</p></div>
      )}
      {params && reporte.cargando && !datos && <Cargando texto="Calculando…" />}
      {params && <ErrorApi error={reporte.error} onReintentar={reporte.recargar} />}

      {datos && agrupar === 'ra' && (
        <>
          <Histograma titulo="Distribución por nivel · resultado de aprendizaje" filas={verRA(datos.porRA)} niveles={niveles} eje="RA" />
          <Seccion titulo="Matriz de medición de resultados de aprendizaje"
            subtitulo={`Un RA cumple cuando al menos el ${meta.meta_satisfactorio_pct} % de los evaluados queda en nivel Alto o Medio.`}>
            <Matriz filas={verRA(datos.porRA)} primera="Código" descripcion />
          </Seccion>
          {raElegido && desglose.data && (
            <Seccion titulo={`${raElegido.grupo} por curso del plan`} subtitulo="Resultado del RA en cada curso que lo evalúa.">
              <Matriz filas={desglose.data.filas} primera="Curso" />
            </Seccion>
          )}
        </>
      )}

      {datos && agrupar === 'cohorte' && (
        f.cohorte ? (
          <>
            <Histograma titulo={`Promoción ${nombreCohorte ?? ''} · distribución por RA`} filas={verRA(datos.porRA)} niveles={niveles} eje="RA" />
            <Seccion titulo={`Resultados de la promoción ${nombreCohorte ?? ''}`}
              subtitulo={f.curso ? 'Solo el curso elegido.' : 'Todos los cursos de la promoción dentro de los filtros.'}>
              <Matriz filas={verRA(datos.porRA)} primera="Código" descripcion />
            </Seccion>
          </>
        ) : (
          <>
            <Histograma titulo="Distribución por nivel · promoción" filas={datos.filas} niveles={niveles} eje="Promoción" />
            <Seccion titulo="Comparación de promociones">
              <Matriz filas={datos.filas} primera="Promoción" />
            </Seccion>
          </>
        )
      )}

      {datos && agrupar === 'estudiante' && (
        f.estudiante ? (
          <Seccion titulo={(estudiantes.data ?? []).filter((e) => e.id_estudiante === f.estudiante).map((e) => `${e.nombres} ${e.apellidos}`)[0] ?? 'Estudiante'}
            subtitulo={`Promoción ${nombreCohorte ?? ''} · nivel consolidado por RA y resultado en cada curso`}
            acciones={<button type="button" className="btn btn-secundario" onClick={() => cambiar('estudiante')('')}>Ver toda la promoción</button>}>
            <PerfilEstudiante porRA={verRA(datos.porRA)} detalle={(datos.detalleEstudiante ?? []).filter((d) => !f.ra || d.ra === raElegido?.grupo)} />
          </Seccion>
        ) : (
          <Seccion titulo={`Estudiantes de la promoción ${nombreCohorte ?? ''}`}
            subtitulo="Nota consolidada y nivel en cada RA; el nombre abre el perfil del estudiante.">
            <TablaEstudiantes filas={datos.filas} ras={rasConDatos} onVer={cambiar('estudiante')} />
          </Seccion>
        )
      )}
    </div>
  )
}
