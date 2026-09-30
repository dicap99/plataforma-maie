import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as raApi from '../../api/raApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { leerNota } from './rubrica'
import { clave, estadoEstudiante, nombreEstudiante } from './planilla/comun'
import DescriptoresModal from './planilla/DescriptoresModal.jsx'
import EvaluacionEstudiante from './planilla/EvaluacionEstudiante.jsx'
import ResumenPlanilla from './planilla/ResumenPlanilla.jsx'

const FILTROS = [
  { valor: 'todos', etiqueta: 'Todos', incluye: () => true },
  { valor: 'pendientes', etiqueta: 'Pendientes', incluye: (i) => !i.completo },
  { valor: 'completados', etiqueta: 'Completados', incluye: (i) => i.completo },
  { valor: 'riesgo', etiqueta: 'En riesgo < 3.0', incluye: (i) => i.estado === 'riesgo' },
]

function Kpi({ etiqueta, valor, acento }) {
  return (
    <div className="rounded-xl bg-surface-container-lowest/10 p-space-sm backdrop-blur-sm">
      <span className="block text-label-sm text-primary-fixed-dim">{etiqueta}</span>
      <span className={`font-display text-headline-sm ${acento ?? 'text-on-primary'}`}>{valor}</span>
    </div>
  )
}

// Calificación de rúbricas de una oferta (RF-RA-02; mockup Mockups/Evaluacion_RA.txt).
// «Evaluación por estudiante» muestra la rúbrica completa criterio por criterio; «Resumen general»
// lista a todos los estudiantes con sus notas y también permite editarlas. Ambas vistas comparten
// las ediciones sin guardar. En modo `soloLectura` (Coordinación) sirve de auditoría.
export default function PlanillaRubricaPage({ soloLectura = false }) {
  const { idCurso } = useParams()
  const { data, error, cargando, recargar } = useApi(() => raApi.planilla(idCurso), [idCurso])
  const [planilla, setPlanilla] = useState(null)
  const [idRa, setIdRa] = useState(null)
  const [vista, setVista] = useState(soloLectura ? 'resumen' : 'estudiante')
  const [idEstudiante, setIdEstudiante] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [ediciones, setEdiciones] = useState({}) // clave → texto escrito
  const [verDescriptores, setVerDescriptores] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [errorGuardar, setErrorGuardar] = useState(null)

  useEffect(() => {
    if (data) setPlanilla(data)
  }, [data])

  // Celdas cambiadas respecto a lo guardado; calificacion undefined = texto no válido.
  const cambios = useMemo(() => {
    if (!planilla) return []
    const originales = new Map(planilla.estudiantes.map((e) => [e.id_estudiante, e.notas]))
    return Object.entries(ediciones).flatMap(([k, texto]) => {
      const [idEst, idCrit] = k.split('|')
      const antes = originales.get(idEst)?.[idCrit] ?? null
      const ahora = leerNota(texto)
      return ahora === antes ? [] : [{ id_estudiante: idEst, id_criterio: Number(idCrit), calificacion: ahora }]
    })
  }, [ediciones, planilla])
  const invalidas = cambios.filter((c) => c.calificacion === undefined)

  useEffect(() => {
    if (!cambios.length) return undefined
    const avisar = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambios.length])

  if (cargando && !planilla) return <Cargando texto="Cargando planilla…" />
  if (error) return <ErrorApi error={error} onReintentar={recargar} />
  if (!planilla) return null

  const { curso, niveles, ras, estudiantes } = planilla
  // Con la calificación del semestre cerrada, el docente solo consulta.
  const cerrada = !soloLectura && !curso.calificacion_abierta
  const lectura = soloLectura || cerrada
  const ra = ras.find((r) => r.id_ra === idRa) ?? ras[0]
  const volver = soloLectura ? '/coordinacion/ra/cursos' : '/docente/rubricas'

  const infos = new Map(estudiantes.map((e) => [e.id_estudiante, estadoEstudiante(niveles, ediciones, e, ra.criterios)]))
  const completos = estudiantes.filter((e) => infos.get(e.id_estudiante).completo)
  const promedio = completos.length ? completos.reduce((s, e) => s + infos.get(e.id_estudiante).total, 0) / completos.length : null
  const avance = estudiantes.length ? completos.length / estudiantes.length : 0
  const q = busqueda.trim().toLowerCase()
  const regla = FILTROS.find((f) => f.valor === filtro)
  const visibles = estudiantes.filter((e) => regla.incluye(infos.get(e.id_estudiante))
    && (!q || nombreEstudiante(e).toLowerCase().includes(q) || e.identificacion.toLowerCase().includes(q)))
  const contar = (f) => estudiantes.filter((e) => f.incluye(infos.get(e.id_estudiante))).length

  const onNota = (e, c, texto) => {
    setMensaje(null)
    setEdiciones((ed) => ({ ...ed, [clave(e.id_estudiante, c.id_criterio)]: texto }))
  }
  const cambiosDe = (id) => cambios.filter((c) => c.id_estudiante === id)

  // Guarda los cambios (de un estudiante o todos); devuelve true si se guardó.
  const guardar = async (soloEstudiante = null) => {
    const lote = soloEstudiante ? cambiosDe(soloEstudiante) : cambios
    if (!lote.length || lote.some((c) => c.calificacion === undefined)) return false
    setGuardando(true)
    setErrorGuardar(null)
    setMensaje(null)
    try {
      const { data: nueva } = await raApi.registrarCalificaciones(curso.id_curso, lote)
      setPlanilla(nueva)
      const guardadas = new Set(lote.map((c) => clave(c.id_estudiante, c.id_criterio)))
      setEdiciones((ed) => Object.fromEntries(Object.entries(ed).filter(([k]) => !guardadas.has(k))))
      setMensaje(`Se guardaron ${lote.length} nota(s).`)
      return true
    } catch (err) {
      setErrorGuardar(err)
      return false
    } finally {
      setGuardando(false)
    }
  }

  const verEstudiante = (id) => {
    setIdEstudiante(id)
    setVista('estudiante')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary-container to-secondary-container p-space-lg text-on-primary shadow-xl">
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-secondary-container/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-space-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav className="flex flex-wrap items-center gap-space-xs text-label-sm text-primary-fixed-dim" aria-label="Ruta">
              <Link to={volver} className="text-primary-fixed-dim no-underline hover:text-on-primary">
                {soloLectura ? 'Cursos y matrícula' : 'Calificar rúbricas'}
              </Link>
              <span>/</span>
              <span className="font-semibold text-on-primary">{curso.codigo} · Rúbrica {ra.codigo}</span>
            </nav>
            <span className="rounded-full bg-white/10 px-3 py-1 text-label-sm">
              {curso.docentes.length > 1 ? 'Docentes' : 'Docente'}: {curso.docentes.map((d) => d.nombre).join(', ') || 'sin asignar'}
            </span>
          </div>

          <div className="flex flex-col justify-between gap-space-md xl:flex-row xl:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-secondary-fixed">{curso.codigo}</span>
                <span className="text-label-md text-primary-fixed-dim">Promoción {curso.cohorte} · Periodo {curso.periodo}</span>
              </div>
              <h1 className="font-display text-headline-lg text-on-primary">Rúbrica {ra.codigo}: {curso.nombre}</h1>
              <p className="max-w-3xl text-body-sm text-primary-fixed-dim">{ra.descripcion}</p>
            </div>
            <div className="flex flex-wrap items-center gap-space-xs xl:justify-end">
              <button type="button" onClick={() => setVerDescriptores(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-label-lg text-on-primary shadow-sm hover:bg-white/20">
                <Icono nombre="menu_book" className="text-[18px]" /> Descriptores oficiales
              </button>
              {!lectura && (
                <button type="button" onClick={() => guardar()} disabled={!cambios.length || invalidas.length > 0 || guardando}
                  className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-label-lg text-on-secondary shadow-md hover:bg-secondary/90 disabled:opacity-50">
                  <Icono nombre="save" className="text-[18px]" /> {guardando ? 'Guardando…' : `Guardar todo${cambios.length ? ` (${cambios.length})` : ''}`}
                </button>
              )}
            </div>
          </div>

          {ras.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Resultados de aprendizaje del curso">
              {ras.map((r) => (
                <button key={r.id_ra} type="button" role="tab" aria-selected={r.id_ra === ra.id_ra} onClick={() => setIdRa(r.id_ra)}
                  className={`rounded-xl px-4 py-1.5 text-label-md font-bold ${r.id_ra === ra.id_ra ? 'bg-on-primary text-primary' : 'bg-white/10 text-on-primary hover:bg-white/20'}`}>
                  {r.codigo}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-4">
            <Kpi etiqueta="Estrategias sugeridas" valor={ra.estrategias.join(', ')} />
            <Kpi etiqueta="Dominio esperado" valor={ra.nivel_dominio} acento="text-tertiary-fixed" />
            <Kpi etiqueta="Progreso" valor={`${completos.length} / ${estudiantes.length} evaluados`} />
            <Kpi etiqueta="Promedio del curso" valor={promedio === null ? '—' : `${promedio.toFixed(2)} / 5.0`} acento="text-secondary-fixed" />
          </div>
        </div>
      </section>

      {soloLectura && (
        <p className="rounded-xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
          Vista de auditoría: las notas las registra el docente del curso
          {curso.calificacion_abierta ? ' (calificación del semestre abierta).' : ' (calificación del semestre cerrada).'}
        </p>
      )}
      {cerrada && (
        <div className="flex items-center gap-space-sm rounded-xl bg-tertiary-fixed/60 p-space-sm text-body-sm text-on-tertiary-fixed-variant" role="status">
          <Icono nombre="lock" className="text-[20px]" />
          La calificación del semestre {curso.periodo} está cerrada; Coordinación la habilita al final del semestre.
          Puede consultar la rúbrica y las notas registradas.
        </div>
      )}
      {invalidas.length > 0 && (
        <div className="alerta-error" role="alert">Hay {invalidas.length} nota(s) no válidas: use números de 0 a 5 con máximo dos decimales.</div>
      )}
      <ErrorApi error={errorGuardar} />
      {mensaje && <p className="texto-exito" role="status">{mensaje}</p>}

      <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-center">
          <div className="flex items-center gap-space-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-fixed text-on-secondary-fixed">
              <Icono nombre="analytics" className="text-[22px]" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-lg font-bold text-primary">Avance de evaluación {ra.codigo}</span>
                <span className="rounded bg-secondary-container px-2 py-0.5 text-label-sm font-semibold text-on-secondary-container">
                  {(avance * 100).toFixed(1)} % completado
                </span>
              </div>
              <span className="text-body-sm text-on-surface-variant">
                {estudiantes.length - completos.length} pendiente(s) de completar · {completos.length} rúbrica(s) completas
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTROS.map((f) => (
              <button key={f.valor} type="button" onClick={() => setFiltro(f.valor)} aria-pressed={filtro === f.valor}
                className={`rounded-xl px-3 py-1.5 text-label-sm font-semibold transition-all ${
                  filtro === f.valor ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
                {f.etiqueta} ({contar(f)})
              </button>
            ))}
          </div>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-low p-0.5">
          <div className="h-full rounded-full bg-gradient-to-r from-secondary to-secondary-container transition-all duration-700" style={{ width: `${avance * 100}%` }} />
        </div>
        <div className="flex flex-col items-center justify-between gap-space-sm sm:flex-row">
          <div className="relative w-full sm:w-96">
            <Icono nombre="search" className="absolute left-3 top-2.5 text-[20px] text-outline" />
            <input
              className="w-full rounded-xl bg-surface-container-low py-2 pl-10 pr-3 text-body-sm text-on-surface focus:bg-surface-container focus:outline-none"
              placeholder="Buscar por nombre o código estudiantil…"
              aria-label="Buscar estudiante"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex items-center rounded-xl bg-surface-container-low p-1 text-label-sm" role="tablist" aria-label="Vista">
            {[['estudiante', 'Evaluación por estudiante', 'person_check'], ['resumen', 'Resumen general', 'table_view']].map(([v, etiqueta, icono]) => (
              <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ${vista === v ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <Icono nombre={icono} className="text-[16px]" /> {etiqueta}
              </button>
            ))}
          </div>
        </div>
      </section>

      {vista === 'estudiante' ? (
        <EvaluacionEstudiante
          ra={ra}
          niveles={niveles}
          estudiantes={estudiantes}
          visibles={visibles}
          idEstudiante={idEstudiante}
          onElegir={setIdEstudiante}
          ediciones={ediciones}
          onNota={onNota}
          cambiosDe={cambiosDe}
          onGuardar={guardar}
          guardando={guardando}
          soloLectura={lectura}
        />
      ) : (
        <ResumenPlanilla
          ra={ra}
          niveles={niveles}
          estudiantes={visibles}
          ediciones={ediciones}
          cambios={cambios}
          onNota={onNota}
          onVer={verEstudiante}
          soloLectura={lectura}
        />
      )}

      {verDescriptores && <DescriptoresModal ra={ra} niveles={niveles} onClose={() => setVerDescriptores(false)} />}
    </div>
  )
}
