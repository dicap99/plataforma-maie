import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import * as cursosApi from '../../api/cursosApi'
import * as raApi from '../../api/raApi'
import * as usuariosApi from '../../api/usuariosApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import Modal from '../../components/common/Modal.jsx'
import { BarraProgreso, Insignia } from '../admin/panel/TarjetaKpi.jsx'
import { periodoAcademico } from '../../utils/periodo'
import { porcentaje } from '../../utils/formato'

const ESTADOS = ['inscrito', 'matriculado', 'egresado', 'graduado', 'retirado']
const nombreDe = (u) => `${u.apellidos} ${u.nombres}`

// Formulario de oferta: la clase (que fija el curso del plan y sus RA), la promoción, el semestre
// académico y los docentes asignados para ese semestre.
function FormularioOferta({ oferta, periodo, clases, cohortes, docentes, onClose, onGuardada }) {
  const activas = clases.filter((c) => c.activa || c.id_clase === oferta?.id_clase)
  const [datos, setDatos] = useState({
    id_clase: oferta?.id_clase ?? activas[0]?.id_clase ?? '',
    id_cohorte: oferta?.id_cohorte ?? cohortes.at(-1)?.id_cohorte ?? '',
    periodo: oferta?.periodo ?? periodo ?? periodoAcademico(),
    grupo: oferta?.grupo ?? 1,
    docentes: oferta?.docentes.map((d) => d.id_usuario) ?? [],
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const campo = (k) => (e) => setDatos((d) => ({ ...d, [k]: e.target.value }))
  const alternarDocente = (id) => setDatos((d) => ({
    ...d, docentes: d.docentes.includes(id) ? d.docentes.filter((x) => x !== id) : [...d.docentes, id],
  }))
  const porCurso = [...new Map(activas.map((c) => [c.curso_plan, activas.filter((x) => x.curso_plan === c.curso_plan)])).entries()]
  const elegida = clases.find((c) => String(c.id_clase) === String(datos.id_clase))

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = { ...datos, id_clase: Number(datos.id_clase), id_cohorte: Number(datos.id_cohorte), grupo: Number(datos.grupo) }
    try {
      if (oferta) await cursosApi.actualizarOferta(oferta.id_curso, cuerpo)
      else await cursosApi.crearOferta(cuerpo)
      onGuardada()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={oferta ? 'Editar clase ofertada' : 'Ofertar una clase en el semestre'} onClose={onClose} ancho={680}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="of-clase">Clase</label>
            <select id="of-clase" value={datos.id_clase} onChange={campo('id_clase')} required>
              {porCurso.map(([curso, lista]) => (
                <optgroup key={curso} label={`${curso} · ${lista[0].curso_plan_nombre} (sem. ${lista[0].semestre})`}>
                  {lista.map((c) => <option key={c.id_clase} value={c.id_clase}>{c.codigo} · {c.nombre}</option>)}
                </optgroup>
              ))}
            </select>
            {elegida && <span className="texto-suave">Evalúa {elegida.ras.join(', ')} · componente {elegida.modulo}</span>}
          </div>
          <div className="campo">
            <label htmlFor="of-periodo">Semestre académico</label>
            <input id="of-periodo" value={datos.periodo} onChange={campo('periodo')} pattern="[0-9]{4}-[AB]" placeholder="2026-B" required />
          </div>
          <div className="campo">
            <label htmlFor="of-cohorte">Promoción</label>
            <select id="of-cohorte" value={datos.id_cohorte} onChange={campo('id_cohorte')} required>
              {cohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="of-grupo">Grupo</label>
            <input id="of-grupo" type="number" min="1" max="99" value={datos.grupo} onChange={campo('grupo')} />
          </div>
        </div>
        <fieldset className="campo">
          <legend>Docentes asignados en este semestre</legend>
          {docentes.length === 0 && <p className="texto-suave">No hay usuarios con rol docente. Créelos en Usuarios.</p>}
          <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {docentes.map((d) => (
              <label key={d.id_usuario} className="campo-check">
                <input type="checkbox" checked={datos.docentes.includes(d.id_usuario)} onChange={() => alternarDocente(d.id_usuario)} />
                {nombreDe(d)}
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorApi error={error} />
        <div className="modal-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando || !datos.id_clase}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

// Asignación rápida de docentes de una oferta en su semestre.
function DocentesOferta({ oferta, docentes, onClose, onGuardada }) {
  const [elegidos, setElegidos] = useState(oferta.docentes.map((d) => d.id_usuario))
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const alternar = (id) => setElegidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await cursosApi.asignarDocentes(oferta.id_curso, elegidos)
      onGuardada()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Modal titulo={`Docentes · ${oferta.nombre} · ${oferta.periodo}`} onClose={onClose} ancho={560}>
      <p className="texto-suave">Promoción {oferta.cohorte} · {oferta.codigo}. La asignación aplica solo a este semestre.</p>
      <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
        {docentes.map((d) => (
          <label key={d.id_usuario} className="campo-check">
            <input type="checkbox" checked={elegidos.includes(d.id_usuario)} onChange={() => alternar(d.id_usuario)} />
            {nombreDe(d)}
          </label>
        ))}
      </div>
      <ErrorApi error={error} />
      <div className="modal-acciones">
        <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Modal>
  )
}

// Matrícula de una oferta: estudiantes de la promoción con casillas.
function MatriculaOferta({ oferta, onClose, onGuardada }) {
  const detalle = useApi(() => cursosApi.obtenerOferta(oferta.id_curso), [oferta.id_curso])
  const promocion = useApi(() => cursosApi.estudiantesCohorte(oferta.id_cohorte), [oferta.id_cohorte])
  const [seleccion, setSeleccion] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const inscritos = useMemo(() => new Set(detalle.data?.estudiantes.map((e) => e.id_estudiante) ?? []), [detalle.data])
  const marcados = seleccion ?? inscritos

  const alternar = (id) => {
    const s = new Set(marcados)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setSeleccion(s)
  }
  const accion = async (fn) => {
    setGuardando(true)
    setError(null)
    try {
      await fn()
      onGuardada()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={`Matrícula · ${oferta.codigo} · Promoción ${oferta.cohorte}`} onClose={onClose} ancho={640}>
      {(detalle.cargando || promocion.cargando) && <Cargando />}
      <ErrorApi error={detalle.error ?? promocion.error} />
      {promocion.data && detalle.data && (
        <>
          {promocion.data.length === 0 ? (
            <p className="texto-suave">La promoción no tiene estudiantes. Agréguelos en la pestaña «Estudiantes por promoción».</p>
          ) : (
            <div className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {promocion.data.map((e) => (
                <label key={e.id_estudiante} className="campo-check">
                  <input type="checkbox" checked={marcados.has(e.id_estudiante)} onChange={() => alternar(e.id_estudiante)} />
                  {nombreDe(e)}{e.estado === 'retirado' && <span className="texto-suave"> (retirado)</span>}
                </label>
              ))}
            </div>
          )}
          <p className="texto-suave">No se puede desmatricular a un estudiante que ya tiene notas de rúbrica en el curso.</p>
          <ErrorApi error={error} />
          <div className="modal-acciones">
            <button type="button" className="btn btn-secundario" disabled={guardando}
              onClick={() => accion(() => cursosApi.matricularCohorte(oferta.id_curso))}>
              Matricular toda la promoción
            </button>
            <button type="button" className="btn btn-primario" disabled={guardando || seleccion === null}
              onClick={() => accion(() => cursosApi.inscribir(oferta.id_curso, [...marcados]))}>
              Guardar selección
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

// Estudiantes de una promoción (cohorte_estudiantes) con su estado académico.
function EstudiantesPromocion({ cohortes }) {
  const [idCohorte, setIdCohorte] = useState(cohortes.at(-1)?.id_cohorte ?? '')
  const lista = useApi(() => (idCohorte ? cursosApi.estudiantesCohorte(idCohorte) : Promise.resolve({ data: [] })), [idCohorte])
  const usuarios = useApi(() => usuariosApi.listarUsuarios('estudiante'))
  const [cambios, setCambios] = useState(null) // [{ id_estudiante, estado }]
  const [agregar, setAgregar] = useState('')
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  const filas = cambios ?? (lista.data ?? []).map((e) => ({ id_estudiante: e.id_estudiante, estado: e.estado }))
  const porId = new Map((usuarios.data ?? []).map((u) => [u.id_usuario, u]))
  const disponibles = (usuarios.data ?? []).filter((u) => !filas.some((f) => f.id_estudiante === u.id_usuario))

  const guardar = async () => {
    setError(null)
    try {
      await cursosApi.guardarEstudiantesCohorte(idCohorte, filas)
      setCambios(null)
      setMensaje('Estudiantes de la promoción actualizados.')
      lista.recargar()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex flex-wrap items-end gap-space-sm">
        <div className="campo">
          <label htmlFor="ep-cohorte">Promoción</label>
          <select id="ep-cohorte" value={idCohorte} onChange={(e) => { setIdCohorte(e.target.value); setCambios(null); setMensaje(null) }}>
            {cohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ep-agregar">Agregar estudiante</label>
          <select id="ep-agregar" value={agregar} onChange={(e) => setAgregar(e.target.value)}>
            <option value="">Seleccione…</option>
            {disponibles.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{nombreDe(u)} · {u.identificacion}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-secundario" disabled={!agregar}
          onClick={() => { setCambios([...filas, { id_estudiante: agregar, estado: 'matriculado' }]); setAgregar('') }}>
          Agregar
        </button>
        <button type="button" className="btn btn-primario" disabled={!cambios} onClick={guardar}>Guardar cambios</button>
      </div>
      <p className="texto-suave">Los usuarios con rol estudiante se crean en Procesos administrativos › Usuarios.</p>
      <ErrorApi error={error ?? lista.error ?? usuarios.error} />
      {mensaje && <p className="texto-exito" role="status">{mensaje}</p>}
      {lista.cargando && !lista.data ? <Cargando /> : (
        <div className="tabla-scroll">
          <table className="text-body-sm">
            <thead><tr><th>Estudiante</th><th>Identificación</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {filas.map((f, i) => {
                const u = porId.get(f.id_estudiante)
                return (
                  <tr key={f.id_estudiante}>
                    <td>{u ? nombreDe(u) : f.id_estudiante}</td>
                    <td>{u?.identificacion}</td>
                    <td>
                      <select aria-label="Estado" value={f.estado} onChange={(e) => setCambios(filas.map((x, j) => (j === i ? { ...x, estado: e.target.value } : x)))}>
                        {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="acciones">
                      <button type="button" className="btn-enlace peligro" onClick={() => setCambios(filas.filter((_, j) => j !== i))}>Quitar</button>
                    </td>
                  </tr>
                )
              })}
              {filas.length === 0 && <tr><td colSpan={4} className="texto-suave">Sin estudiantes.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Apertura de la calificación de rúbricas por semestre académico: cada curso se evalúa al final
// de su semestre y Coordinación abre o cierra la calificación de todos sus cursos a la vez.
function CalificacionPorSemestre() {
  const periodos = useApi(raApi.listarPeriodos)
  const [cambiando, setCambiando] = useState(null)
  const [error, setError] = useState(null)

  const alternar = async (p) => {
    setCambiando(p.periodo)
    setError(null)
    try {
      await raApi.cambiarPeriodo(p.periodo, !p.abierto)
      await periodos.recargar()
    } catch (err) {
      setError(err)
    } finally {
      setCambiando(null)
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <p className="text-body-sm text-on-surface-variant">
        Mientras el semestre está cerrado, los docentes solo consultan sus planillas. Abra la calificación al final del
        semestre y ciérrela cuando los docentes hayan registrado las rúbricas.
      </p>
      <ErrorApi error={error ?? periodos.error} onReintentar={periodos.error ? periodos.recargar : undefined} />
      {periodos.cargando && !periodos.data ? <Cargando /> : (
        <div className="tabla-scroll">
          <table className="text-body-sm">
            <thead>
              <tr><th>Semestre académico</th><th className="num">Cursos ofertados</th><th>Calificación</th><th>Último cambio</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {(periodos.data ?? []).map((p) => (
                <tr key={p.periodo}>
                  <td className="font-semibold text-primary">{p.periodo}</td>
                  <td className="num">{p.cursos}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm font-bold ${
                      p.abierto ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      <Icono nombre={p.abierto ? 'lock_open' : 'lock'} className="text-[14px]" /> {p.abierto ? 'Abierta' : 'Cerrada'}
                    </span>
                  </td>
                  <td className="texto-suave">{p.actualizado_en ? new Date(p.actualizado_en).toLocaleString('es-CO') : '—'}</td>
                  <td className="acciones">
                    <button type="button" className={p.abierto ? 'btn btn-secundario' : 'btn btn-primario'}
                      disabled={cambiando !== null} onClick={() => alternar(p)}>
                      {cambiando === p.periodo ? 'Guardando…' : p.abierto ? 'Cerrar calificación' : 'Abrir calificación'}
                    </button>
                  </td>
                </tr>
              ))}
              {periodos.data?.length === 0 && <tr><td colSpan={5} className="texto-suave">Aún no hay cursos ofertados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Clases con identificador único: cada una cubre un curso del plan (y sus RA).
function FormularioClase({ clase, catalogo, onClose, onGuardada }) {
  const [datos, setDatos] = useState({
    nombre: clase?.nombre ?? '',
    id_catalogo: clase?.id_catalogo ?? catalogo[0]?.id_catalogo ?? '',
    descripcion: clase?.descripcion ?? '',
    activa: clase?.activa ?? true,
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = { ...datos, id_catalogo: Number(datos.id_catalogo), nombre: datos.nombre.trim(), descripcion: datos.descripcion.trim() || null }
    try {
      if (clase) await cursosApi.actualizarClase(clase.id_clase, cuerpo)
      else await cursosApi.crearClase(cuerpo)
      onGuardada()
    } catch (err) {
      setError(err)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Modal titulo={clase ? `Editar clase ${clase.codigo}` : 'Nueva clase'} onClose={onClose} ancho={600}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="cl-nombre">Nombre de la clase</label>
            <input id="cl-nombre" value={datos.nombre} maxLength={150} required placeholder="p. ej. Robótica"
              onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))} />
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="cl-catalogo">Curso del plan que cubre</label>
            <select id="cl-catalogo" value={datos.id_catalogo} disabled={clase?.ofertas > 0}
              onChange={(e) => setDatos((d) => ({ ...d, id_catalogo: e.target.value }))}>
              {catalogo.map((k) => (
                <option key={k.id_catalogo} value={k.id_catalogo}>
                  {k.codigo} · {k.nombre} (sem. {k.semestre}) · {k.ras.map((r) => r.codigo).join(', ')}
                </option>
              ))}
            </select>
            {clase?.ofertas > 0 && <span className="texto-suave">Ya se ofertó: no se puede cambiar el curso del plan.</span>}
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="cl-desc">Descripción (opcional)</label>
            <textarea id="cl-desc" rows={2} value={datos.descripcion} onChange={(e) => setDatos((d) => ({ ...d, descripcion: e.target.value }))} />
          </div>
          <label className="campo-check">
            <input type="checkbox" checked={datos.activa} onChange={(e) => setDatos((d) => ({ ...d, activa: e.target.checked }))} />
            Activa (disponible para ofertar)
          </label>
        </div>
        <p className="texto-suave">{clase ? `Código: ${clase.codigo}` : 'El código se genera a partir del curso del plan (p. ej. CE2-04).'}</p>
        <ErrorApi error={error} />
        <div className="modal-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ClasesPanel({ clases, catalogo, onCambio }) {
  const [editando, setEditando] = useState(null) // null | 'nueva' | clase
  const [error, setError] = useState(null)
  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar la clase ${c.codigo} · ${c.nombre}?`)) return
    setError(null)
    try {
      await cursosApi.eliminarClase(c.id_clase)
      onCambio()
    } catch (err) {
      setError(err)
    }
  }
  return (
    <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <p className="max-w-3xl text-body-sm text-on-surface-variant">
          Cada clase tiene un identificador único y cubre un curso del plan, del que toma los RA que evalúa. Los
          docentes no se fijan aquí: se asignan en cada semestre al ofertar la clase.
        </p>
        <button type="button" className="btn btn-primario" onClick={() => setEditando('nueva')}>
          <Icono nombre="add" className="text-[18px]" /> Nueva clase
        </button>
      </div>
      <ErrorApi error={error} />
      <div className="tabla-scroll">
        <table className="text-body-sm">
          <thead>
            <tr><th>Código</th><th>Clase</th><th>Curso del plan</th><th>RA</th><th className="num">Ofertas</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            {clases.map((c) => (
              <tr key={c.id_clase}>
                <td className="nowrap font-semibold text-primary">{c.codigo}</td>
                <td>{c.nombre}</td>
                <td>{c.curso_plan} · {c.curso_plan_nombre} <span className="texto-suave">(sem. {c.semestre})</span></td>
                <td><div className="flex flex-wrap gap-1">{c.ras.map((r) => <Insignia key={r} tono="acento">{r}</Insignia>)}</div></td>
                <td className="num">{c.ofertas}</td>
                <td>{c.activa ? 'Activa' : <span className="texto-suave">Inactiva</span>}</td>
                <td className="acciones">
                  <button type="button" className="btn-enlace" onClick={() => setEditando(c)}>Editar</button>
                  {c.ofertas === 0 && <button type="button" className="btn-enlace peligro" onClick={() => eliminar(c)}>Eliminar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <FormularioClase clase={editando === 'nueva' ? null : editando} catalogo={catalogo}
          onClose={() => setEditando(null)} onGuardada={() => { setEditando(null); onCambio() }} />
      )}
    </section>
  )
}

// Cursos y matrícula (RF-ADM-01, RF-RA-02): por semestre académico se ofertan clases a las
// promociones y se asignan sus docentes; además, clases, estudiantes por promoción y apertura
// de la calificación.
export default function OfertasCursoPage() {
  const [pestana, setPestana] = useState('semestre')
  const [periodo, setPeriodo] = useState(periodoAcademico())
  const [filtro, setFiltro] = useState({ cohorte: '', docente: '' })
  const [editando, setEditando] = useState(null) // null | 'nueva' | oferta
  const [asignando, setAsignando] = useState(null)
  const [matriculando, setMatriculando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)

  const params = Object.fromEntries(Object.entries({ periodo, ...filtro }).filter(([, v]) => v))
  const ofertas = useApi(() => cursosApi.listarOfertas(params), [periodo, filtro.cohorte, filtro.docente])
  const periodos = useApi(raApi.listarPeriodos)
  const clases = useApi(() => cursosApi.listarClases())
  const catalogo = useApi(cursosApi.catalogo)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const docentes = useApi(() => usuariosApi.listarUsuarios('docente'))

  if ((clases.cargando && !clases.data) || (cohortes.cargando && !cohortes.data) || (catalogo.cargando && !catalogo.data)) return <Cargando />
  const errorCarga = clases.error ?? cohortes.error ?? docentes.error ?? catalogo.error
  if (errorCarga) return <ErrorApi error={errorCarga} onReintentar={() => { clases.recargar(); cohortes.recargar(); docentes.recargar(); catalogo.recargar() }} />

  const listaCohortes = [...cohortes.data].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? -1 : 1))
  const semestres = [...new Set([periodoAcademico(), periodo, ...(periodos.data ?? []).map((p) => p.periodo)])].sort().reverse()
  const estadoSemestre = (periodos.data ?? []).find((p) => p.periodo === periodo)
  const lista = ofertas.data ?? []

  // Carga docente del semestre: clases asignadas a cada docente.
  const carga = new Map()
  for (const o of lista) for (const d of o.docentes) carga.set(d.nombre, [...(carga.get(d.nombre) ?? []), o.nombre])

  const recargar = () => {
    ofertas.recargar()
    periodos.recargar()
    clases.recargar()
  }
  const alGuardar = () => {
    setEditando(null)
    setAsignando(null)
    setMatriculando(null)
    recargar()
  }
  const eliminar = async (o) => {
    if (!window.confirm(`¿Quitar ${o.nombre} (${o.periodo}, promoción ${o.cohorte}) de las ofertas?`)) return
    setErrorAccion(null)
    try {
      await cursosApi.eliminarOferta(o.id_curso)
      recargar()
    } catch (err) {
      setErrorAccion(err)
    }
  }

  const PESTANAS = [
    ['semestre', 'Asignación por semestre'],
    ['clases', 'Clases'],
    ['promocion', 'Estudiantes por promoción'],
    ['semestres', 'Calificación por semestre'],
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
            <Icono nombre="menu_book" className="text-[16px]" /> Resultados de aprendizaje
          </div>
          <h1 className="mt-1 font-display text-headline-lg text-primary">Cursos y matrícula</h1>
          <p className="max-w-3xl text-body-md text-on-surface-variant">
            En cada semestre académico se ofertan clases a las promociones y se asignan sus docentes; el docente califica
            en ellas la rúbrica de los RA que evalúa el curso del plan de la clase.
          </p>
        </div>
      </header>

      <div className="pestanas" role="tablist">
        {PESTANAS.map(([valor, etiqueta]) => (
          <button key={valor} type="button" role="tab" aria-selected={pestana === valor} className={pestana === valor ? 'activa' : ''} onClick={() => setPestana(valor)}>
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'clases' && <ClasesPanel clases={clases.data} catalogo={catalogo.data} onCambio={clases.recargar} />}
      {pestana === 'promocion' && (listaCohortes.length > 0
        ? <EstudiantesPromocion cohortes={listaCohortes} />
        : <div className="card"><p>No hay promociones registradas. Créelas en Información académica.</p></div>)}
      {pestana === 'semestres' && <CalificacionPorSemestre />}

      {pestana === 'semestre' && (
        <>
          <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <div className="flex flex-wrap items-end gap-space-sm">
              <div className="campo">
                <label htmlFor="f-semestre">Semestre académico</label>
                <input id="f-semestre" list="lista-semestres" value={periodo} pattern="[0-9]{4}-[AB]"
                  onChange={(e) => setPeriodo(e.target.value.toUpperCase())} />
                <datalist id="lista-semestres">{semestres.map((p) => <option key={p} value={p} />)}</datalist>
              </div>
              <div className="campo">
                <label htmlFor="f-cohorte">Promoción</label>
                <select id="f-cohorte" value={filtro.cohorte} onChange={(e) => setFiltro((f) => ({ ...f, cohorte: e.target.value }))}>
                  <option value="">Todas</option>
                  {listaCohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="f-docente">Docente</label>
                <select id="f-docente" value={filtro.docente} onChange={(e) => setFiltro((f) => ({ ...f, docente: e.target.value }))}>
                  <option value="">Todos</option>
                  {(docentes.data ?? []).map((d) => <option key={d.id_usuario} value={d.id_usuario}>{nombreDe(d)}</option>)}
                </select>
              </div>
              <span className="text-body-sm text-on-surface-variant">
                Calificación del semestre: <strong>{estadoSemestre?.abierto ? 'abierta' : 'cerrada'}</strong>
              </span>
              <button type="button" className="btn btn-primario ml-auto" onClick={() => setEditando('nueva')}
                disabled={listaCohortes.length === 0 || !/^[0-9]{4}-[AB]$/.test(periodo)}>
                <Icono nombre="add" className="text-[18px]" /> Ofertar clase en {periodo}
              </button>
            </div>
            <ErrorApi error={errorAccion ?? ofertas.error} />
            {ofertas.cargando && !ofertas.data ? <Cargando /> : (
              <div className="tabla-scroll">
                <table className="text-body-sm">
                  <thead>
                    <tr>
                      <th>Clase</th><th>Curso del plan</th><th>Promoción</th><th>Docentes</th><th>RA</th>
                      <th className="num">Inscritos</th><th>Notas</th><th><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((o) => {
                      const esperadas = o.inscritos * o.criterios
                      const avance = esperadas ? o.notas / esperadas : 0
                      return (
                        <tr key={o.id_curso}>
                          <td><strong>{o.nombre}</strong>{o.grupo > 1 && ` · grupo ${o.grupo}`}<br /><span className="texto-suave">{o.clase_codigo}</span></td>
                          <td className="nowrap">{o.codigo}<br /><span className="texto-suave">sem. {o.semestre}</span></td>
                          <td>{o.cohorte}</td>
                          <td>
                            {o.docentes.map((d) => d.nombre).join(', ') || <span className="texto-suave">Sin asignar</span>}
                            <br /><button type="button" className="btn-enlace" onClick={() => setAsignando(o)}>Asignar docentes</button>
                          </td>
                          <td><div className="flex flex-wrap gap-1">{o.ras.map((r) => <Insignia key={r} tono="acento">{r}</Insignia>)}</div></td>
                          <td className="num">{o.inscritos}</td>
                          <td style={{ minWidth: 110 }}>
                            <span className="text-label-sm text-on-surface-variant">{porcentaje(avance)}</span>
                            <BarraProgreso fraccion={avance} />
                          </td>
                          <td className="acciones">
                            <Link to={String(o.id_curso)} className="btn-enlace">Planilla</Link>
                            <button type="button" className="btn-enlace" onClick={() => setMatriculando(o)}>Matrícula</button>
                            <button type="button" className="btn-enlace" onClick={() => setEditando(o)}>Editar</button>
                            <button type="button" className="btn-enlace peligro" onClick={() => eliminar(o)}>Quitar</button>
                          </td>
                        </tr>
                      )
                    })}
                    {lista.length === 0 && <tr><td colSpan={8} className="texto-suave">No hay clases ofertadas en {periodo} con estos filtros.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {carga.size > 0 && (
            <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
              <h2 className="font-display text-headline-sm text-primary">Carga docente · {periodo}</h2>
              <ul className="mt-space-sm grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {[...carga.entries()].sort().map(([nombre, cls]) => (
                  <li key={nombre} className="rounded-xl bg-surface-container-low p-space-sm">
                    <span className="font-semibold text-primary">{nombre}</span>
                    <span className="texto-suave"> · {cls.length} clase(s)</span>
                    <br /><span className="text-body-sm text-on-surface-variant">{cls.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {editando && (
        <FormularioOferta
          oferta={editando === 'nueva' ? null : editando}
          periodo={periodo}
          clases={clases.data}
          cohortes={listaCohortes}
          docentes={docentes.data ?? []}
          onClose={() => setEditando(null)}
          onGuardada={alGuardar}
        />
      )}
      {asignando && <DocentesOferta oferta={asignando} docentes={docentes.data ?? []} onClose={() => setAsignando(null)} onGuardada={alGuardar} />}
      {matriculando && <MatriculaOferta oferta={matriculando} onClose={() => setMatriculando(null)} onGuardada={alGuardar} />}
    </div>
  )
}
