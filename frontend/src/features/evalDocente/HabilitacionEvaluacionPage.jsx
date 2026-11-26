import { useState } from 'react'
import * as evalApi from '../../api/evalDocenteApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import Modal from '../../components/common/Modal.jsx'
import { Encabezado, Seccion } from './comun.jsx'

// Habilitación de la evaluación docente por semestre académico (dentro del Módulo 3, separada de la
// apertura de rúbricas del Módulo 2), cronograma (Art. 10), opciones de cálculo, avance de
// diligenciamiento y publicación de resultados a los docentes (RF-EVAL-05).
const fraccion = (a, b) => `${a} / ${b}`

function Estado({ p }) {
  const [texto, clase, icono] = p.publicado
    ? ['Publicada', 'bg-primary-fixed text-on-primary-fixed-variant', 'campaign']
    : p.habilitada
      ? [p.abierta ? 'Abierta' : 'Habilitada (fuera de fechas)', 'bg-secondary-fixed text-on-secondary-fixed-variant', 'lock_open']
      : ['Cerrada', 'bg-surface-container-high text-on-surface-variant', 'lock']
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-label-sm font-bold ${clase}`}>
      <Icono nombre={icono} className="text-[14px]" /> {texto}
    </span>
  )
}

function Configurar({ periodo, onClose, onGuardado }) {
  const [datos, setDatos] = useState({
    habilitada: periodo.habilitada, incluye_pregrado: periodo.incluye_pregrado, excluir_extremas: periodo.excluir_extremas,
    fecha_apertura: periodo.fecha_apertura?.slice(0, 10) ?? '', fecha_cierre: periodo.fecha_cierre?.slice(0, 10) ?? '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    if (datos.habilitada && (!datos.fecha_apertura || !datos.fecha_cierre)) {
      setError({ message: 'Para habilitar la evaluación docente debe indicar las fechas de inicio y cierre.' })
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await evalApi.guardarPeriodo(periodo.periodo, { ...datos, fecha_apertura: datos.fecha_apertura || null, fecha_cierre: datos.fecha_cierre || null })
      onGuardado()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  const Casilla = ({ campo, titulo, ayuda }) => (
    <label className="flex items-start gap-2">
      <input type="checkbox" checked={datos[campo]} onChange={cambiar(campo)} className="mt-1" />
      <span><span className="font-semibold">{titulo}</span><span className="block text-body-sm text-on-surface-variant">{ayuda}</span></span>
    </label>
  )

  return (
    <Modal titulo={`Evaluación docente ${periodo.periodo}`} onClose={onClose} ancho={560}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <Casilla campo="habilitada" titulo="Habilitar la evaluación"
          ayuda="Los estudiantes (EE), los docentes (AE) y Coordinación (EC) pueden diligenciar los formularios entre las fechas indicadas." />
        <Casilla campo="incluye_pregrado" titulo="Incluir a los estudiantes de pregrado"
          ayuda="Los de la lista de pregrado del semestre también evalúan a los docentes de sus cursos." />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">
            Fecha de inicio{datos.habilitada ? ' *' : ''}
            <input type="date" value={datos.fecha_apertura} onChange={cambiar('fecha_apertura')} required={datos.habilitada}
              className="rounded-xl border border-outline-variant px-3 py-2 text-body-md normal-case" />
          </label>
          <label className="flex flex-col gap-1 text-label-sm font-semibold uppercase text-on-surface-variant">
            Fecha de cierre{datos.habilitada ? ' *' : ''}
            <input type="date" value={datos.fecha_cierre} onChange={cambiar('fecha_cierre')} required={datos.habilitada}
              className="rounded-xl border border-outline-variant px-3 py-2 text-body-md normal-case" />
          </label>
        </div>
        <p className="m-0 text-body-sm text-on-surface-variant">
          Cronograma de evaluación (Art. 10: al menos dos semanas antes de terminar el semestre). La recepción de respuestas solo opera entre las fechas definidas.
        </p>
        <Casilla campo="excluir_extremas" titulo="Excluir respuestas extremas (Parágrafo 2 del Art. 12)"
          ayuda="Si un docente tiene más de 10 respuestas de estudiantes, se descartan las que califican todo MA o todo MI. El informe dice cuántas se excluyeron." />
        <ErrorApi error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function HabilitacionEvaluacionPage() {
  const periodos = useApi(evalApi.listarPeriodos)
  const matriz = useApi(evalApi.categorizacion)
  const [editando, setEditando] = useState(null)
  const [detalleFaltantes, setDetalleFaltantes] = useState(null)
  const [error, setError] = useState(null)
  const [publicando, setPublicando] = useState(null)

  const publicar = async (p) => {
    setPublicando(p.periodo)
    setError(null)
    try {
      await evalApi.publicarPeriodo(p.periodo, !p.publicado)
      await periodos.recargar()
    } catch (err) {
      setError(err)
    } finally {
      setPublicando(null)
    }
  }

  const abiertos = (periodos.data ?? []).filter((p) => p.habilitada && p.avance?.faltantes)
  const periodoVisible = (periodos.data ?? []).find((p) => p.periodo === detalleFaltantes) ?? abiertos[0]

  return (
    <div className="flex flex-col gap-space-lg">
      <Encabezado icono="event_available" titulo="Habilitación y seguimiento">
        Habilite la evaluación docente de cada semestre académico con sus fechas de inicio y cierre, elija si incluye a los estudiantes de
        pregrado y siga en tiempo real quiénes faltan por diligenciar. Al terminar, ciérrela y publique los resultados para que cada docente consulte los suyos.
      </Encabezado>

      <Seccion>
        <ErrorApi error={error ?? periodos.error} onReintentar={periodos.error ? periodos.recargar : undefined} />
        {periodos.cargando && !periodos.data ? <Cargando /> : (
          <div className="tabla-scroll">
            <table className="text-body-sm">
              <thead>
                <tr>
                  <th>Semestre</th><th>Estado</th><th>Población</th><th>Cronograma</th>
                  <th className="num">Docentes</th><th className="num">EE posgrado</th><th className="num">EE pregrado</th>
                  <th className="num">EC</th><th className="num">AE</th><th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {(periodos.data ?? []).map((p) => (
                  <tr key={p.periodo}>
                    <td className="font-semibold text-primary">{p.periodo}</td>
                    <td><Estado p={p} /></td>
                    <td>{p.incluye_pregrado ? 'Posgrado y pregrado' : 'Solo posgrado'}{p.excluir_extremas ? <span className="block text-on-surface-variant">Excluye extremas</span> : null}</td>
                    <td className="texto-suave">{p.fecha_apertura ? `${p.fecha_apertura.slice(0, 10)} → ${p.fecha_cierre?.slice(0, 10) ?? '…'}` : 'Sin fechas'}</td>
                    <td className="num">{p.avance.docentes}</td>
                    <td className="num" title="Respuestas recibidas / esperadas (una por estudiante y docente)">{fraccion(p.avance.ee.posgrado.recibidas, p.avance.ee.posgrado.esperadas)}</td>
                    <td className="num">{p.incluye_pregrado || p.avance.ee.pregrado.recibidas ? fraccion(p.avance.ee.pregrado.recibidas, p.avance.ee.pregrado.esperadas) : '—'}</td>
                    <td className="num">{fraccion(p.avance.ec.recibidas, p.avance.ec.esperadas)}</td>
                    <td className="num" title={p.avance.ae.sin_cuenta ? `${p.avance.ae.sin_cuenta} docente(s) sin cuenta no pueden diligenciar su AE` : undefined}>
                      {fraccion(p.avance.ae.recibidas, p.avance.ae.esperadas)}{p.avance.ae.sin_cuenta ? ' *' : ''}
                    </td>
                    <td className="acciones whitespace-nowrap">
                      <button type="button" className="btn btn-secundario" onClick={() => setDetalleFaltantes(p.periodo)}>Faltantes</button>{' '}
                      <button type="button" className="btn btn-secundario" disabled={p.publicado} onClick={() => setEditando(p)}
                        title={p.publicado ? 'Retire la publicación para cambiar la configuración' : undefined}>Configurar</button>{' '}
                      <button type="button" className={p.publicado ? 'btn btn-secundario' : 'btn btn-primario'}
                        disabled={publicando !== null || (!p.publicado && p.habilitada)} onClick={() => publicar(p)}
                        title={!p.publicado && p.habilitada ? 'Cierre la evaluación antes de publicar' : undefined}>
                        {publicando === p.periodo ? 'Guardando…' : p.publicado ? 'Retirar publicación' : 'Publicar resultados'}
                      </button>
                    </td>
                  </tr>
                ))}
                {periodos.data?.length === 0 && (
                  <tr><td colSpan={10} className="texto-suave">Aún no hay cursos ofertados (Gestión académica › Asignación por semestre).</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="m-0 text-body-sm text-on-surface-variant">
          EE: respuestas recibidas / esperadas (una por estudiante y docente). * Docentes sin cuenta en la plataforma: su AE queda pendiente.
          Por anonimato, el seguimiento de estudiantes muestra únicamente cantidades globales, sin nombres.
        </p>
      </Seccion>

      {periodoVisible?.avance?.faltantes && (
        <Seccion>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 font-display text-headline-sm text-primary">Faltantes por evaluar · Semestre {periodoVisible.periodo}</h2>
            <Estado p={periodoVisible} />
          </div>
          <div className="grid gap-space-md md:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-xl border border-outline-variant p-space-md">
              <h3 className="m-0 flex items-center gap-1.5 font-display text-body-lg text-primary">
                <Icono nombre="visibility_off" className="text-[18px] text-secondary" /> Estudiantes (EE, anónimo)
              </h3>
              <p className="m-0 text-body-md font-semibold text-primary">
                {periodoVisible.avance.faltantes.ee.estudiantes_pendientes === 0
                  ? 'Todos los estudiantes están al día.'
                  : `Faltan ${periodoVisible.avance.faltantes.ee.estudiantes_pendientes} estudiante(s) por completar`}
              </p>
              <p className="m-0 text-body-sm text-on-surface-variant">
                Faltan {periodoVisible.avance.faltantes.ee.respuestas_posgrado} respuesta(s) de posgrado
                {periodoVisible.incluye_pregrado || periodoVisible.avance.faltantes.ee.respuestas_pregrado > 0
                  ? ` y ${periodoVisible.avance.faltantes.ee.respuestas_pregrado} de pregrado`
                  : ''}.
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-outline-variant p-space-md">
              <h3 className="m-0 flex items-center gap-1.5 font-display text-body-lg text-primary">
                <Icono nombre="assignment_ind" className="text-[18px] text-secondary" /> Coordinación (EC)
              </h3>
              {periodoVisible.avance.faltantes.ec.length === 0 ? (
                <p className="m-0 text-body-md font-semibold text-emerald-800">Coordinación completó todas las evaluaciones.</p>
              ) : (
                <>
                  <p className="m-0 text-body-sm font-semibold text-amber-900">
                    Faltan {periodoVisible.avance.faltantes.ec.length} evaluación(es) por diligenciar:
                  </p>
                  <ul className="m-0 max-h-40 overflow-y-auto pl-5 text-body-sm text-on-surface">
                    {periodoVisible.avance.faltantes.ec.map((u) => (
                      <li key={`${u.id_docente}-${u.id_cohorte}`}>{u.docente} (Prom. {u.cohorte})</li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-outline-variant p-space-md">
              <h3 className="m-0 flex items-center gap-1.5 font-display text-body-lg text-primary">
                <Icono nombre="rate_review" className="text-[18px] text-secondary" /> Autoevaluación docente (AE)
              </h3>
              {periodoVisible.avance.faltantes.ae.length === 0 ? (
                <p className="m-0 text-body-md font-semibold text-emerald-800">Todos los docentes completaron su autoevaluación.</p>
              ) : (
                <>
                  <p className="m-0 text-body-sm font-semibold text-amber-900">
                    Faltan {periodoVisible.avance.faltantes.ae.length} autoevaluación(es):
                  </p>
                  <ul className="m-0 max-h-40 overflow-y-auto pl-5 text-body-sm text-on-surface">
                    {periodoVisible.avance.faltantes.ae.map((u) => (
                      <li key={`${u.id_docente}-${u.id_cohorte}`}>
                        {u.docente} (Prom. {u.cohorte}){u.sin_cuenta ? ' · sin cuenta' : ''}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </Seccion>
      )}

      <Seccion>
        <h2 className="m-0 font-display text-headline-sm text-primary">Quién evalúa a quién</h2>
        {matriz.data && (
          <>
            <div className="tabla-scroll">
              <table className="text-body-sm">
                <thead><tr><th>Evaluador</th><th>Formulario</th><th>Evalúa a</th><th>Condición</th><th>Fuente</th></tr></thead>
                <tbody>
                  {matriz.data.matriz.map((m) => (
                    <tr key={m.evaluador}><td className="font-semibold">{m.evaluador}</td><td>{m.formulario}</td><td>{m.evalua_a}</td><td>{m.condicion}</td><td className="texto-suave">{m.fuente}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary className="cursor-pointer font-semibold text-primary">Casos particulares</summary>
              <ul className="mt-2 text-body-sm">
                {matriz.data.casos_borde.map((c) => <li key={c.caso}><strong>{c.caso}:</strong> {c.regla}</li>)}
              </ul>
            </details>
          </>
        )}
      </Seccion>

      {editando && <Configurar periodo={editando} onClose={() => setEditando(null)} onGuardado={() => { setEditando(null); periodos.recargar() }} />}
    </div>
  )
}
