import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminApi from '../../api/adminApi'
import * as cursosApi from '../../api/cursosApi'
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

// Formulario de oferta: curso del catálogo, promoción, periodo, nombre propio y docentes.
function FormularioOferta({ oferta, catalogo, cohortes, docentes, onClose, onGuardada }) {
  const [datos, setDatos] = useState({
    id_catalogo: oferta?.id_catalogo ?? catalogo[0]?.id_catalogo ?? '',
    id_cohorte: oferta?.id_cohorte ?? cohortes.at(-1)?.id_cohorte ?? '',
    periodo: oferta?.periodo ?? periodoAcademico(),
    nombre: oferta?.nombre_oferta ?? '',
    grupo: oferta?.grupo ?? 1,
    docentes: oferta?.docentes.map((d) => d.id_usuario) ?? [],
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const campo = (k) => (e) => setDatos((d) => ({ ...d, [k]: e.target.value }))
  const alternarDocente = (id) => setDatos((d) => ({
    ...d, docentes: d.docentes.includes(id) ? d.docentes.filter((x) => x !== id) : [...d.docentes, id],
  }))

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = { ...datos, id_catalogo: Number(datos.id_catalogo), id_cohorte: Number(datos.id_cohorte), grupo: Number(datos.grupo), nombre: datos.nombre.trim() || null }
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
    <Modal titulo={oferta ? 'Editar curso ofertado' : 'Nuevo curso ofertado'} onClose={onClose} ancho={640}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <div className="campo">
            <label htmlFor="of-catalogo">Curso del plan de estudios</label>
            <select id="of-catalogo" value={datos.id_catalogo} onChange={campo('id_catalogo')} required>
              {catalogo.map((k) => <option key={k.id_catalogo} value={k.id_catalogo}>{k.codigo} · {k.nombre} (sem. {k.semestre})</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="of-cohorte">Promoción</label>
            <select id="of-cohorte" value={datos.id_cohorte} onChange={campo('id_cohorte')} required>
              {cohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="of-periodo">Periodo académico</label>
            <input id="of-periodo" value={datos.periodo} onChange={campo('periodo')} pattern="[0-9]{4}-[AB]" placeholder="2026-B" required />
          </div>
          <div className="campo">
            <label htmlFor="of-grupo">Grupo</label>
            <input id="of-grupo" type="number" min="1" max="99" value={datos.grupo} onChange={campo('grupo')} />
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="of-nombre">Nombre de la oferta (opcional, p. ej. tema de la electiva)</label>
            <input id="of-nombre" value={datos.nombre} onChange={campo('nombre')} maxLength={150} />
          </div>
        </div>
        <fieldset className="campo">
          <legend>Docentes del curso</legend>
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
          <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
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

// Cursos ofertados por promoción y periodo, con sus docentes y matrícula (RF-ADM-01, RF-RA-02).
export default function OfertasCursoPage() {
  const [pestana, setPestana] = useState('ofertas')
  const [filtro, setFiltro] = useState({ cohorte: '', periodo: '' })
  const [editando, setEditando] = useState(null) // null | 'nueva' | oferta
  const [matriculando, setMatriculando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)

  const params = Object.fromEntries(Object.entries(filtro).filter(([, v]) => v))
  const ofertas = useApi(() => cursosApi.listarOfertas(params), [filtro.cohorte, filtro.periodo])
  const catalogo = useApi(cursosApi.catalogo)
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const docentes = useApi(() => usuariosApi.listarUsuarios('docente'))

  if ((catalogo.cargando && !catalogo.data) || (cohortes.cargando && !cohortes.data)) return <Cargando />
  const errorCarga = catalogo.error ?? cohortes.error ?? docentes.error
  if (errorCarga) return <ErrorApi error={errorCarga} onReintentar={() => { catalogo.recargar(); cohortes.recargar(); docentes.recargar() }} />

  const listaCohortes = [...cohortes.data].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? -1 : 1))
  const periodos = [...new Set((ofertas.data ?? []).map((o) => o.periodo))]

  const eliminar = async (o) => {
    if (!window.confirm(`¿Eliminar el curso ofertado ${o.codigo} · ${o.nombre} (${o.periodo})?`)) return
    setErrorAccion(null)
    try {
      await cursosApi.eliminarOferta(o.id_curso)
      ofertas.recargar()
    } catch (err) {
      setErrorAccion(err)
    }
  }
  const alGuardar = () => {
    setEditando(null)
    setMatriculando(null)
    ofertas.recargar()
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">
            <Icono nombre="menu_book" className="text-[16px]" /> Resultados de aprendizaje
          </div>
          <h1 className="mt-1 font-display text-headline-lg text-primary">Cursos y matrícula</h1>
          <p className="max-w-3xl text-body-md text-on-surface-variant">
            Cada curso del plan se oferta a una promoción en un periodo, con sus docentes y estudiantes. El docente
            califica en él la rúbrica de los RA que ese curso evalúa.
          </p>
        </div>
        {pestana === 'ofertas' && (
          <button type="button" className="btn btn-primario" onClick={() => setEditando('nueva')} disabled={listaCohortes.length === 0}>
            <Icono nombre="add" className="text-[18px]" /> Nuevo curso ofertado
          </button>
        )}
      </header>

      <div className="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'ofertas'} className={pestana === 'ofertas' ? 'activa' : ''} onClick={() => setPestana('ofertas')}>
          Cursos ofertados
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'promocion'} className={pestana === 'promocion' ? 'activa' : ''} onClick={() => setPestana('promocion')}>
          Estudiantes por promoción
        </button>
      </div>

      {listaCohortes.length === 0 && (
        <div className="card"><p>No hay promociones registradas. Créelas en Información académica › Promociones y Estudiantes.</p></div>
      )}

      {pestana === 'promocion' && listaCohortes.length > 0 && <EstudiantesPromocion cohortes={listaCohortes} />}

      {pestana === 'ofertas' && (
        <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <div className="flex flex-wrap gap-space-sm">
            <div className="campo">
              <label htmlFor="f-cohorte">Promoción</label>
              <select id="f-cohorte" value={filtro.cohorte} onChange={(e) => setFiltro((f) => ({ ...f, cohorte: e.target.value }))}>
                <option value="">Todas</option>
                {listaCohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="f-periodo">Periodo</label>
              <select id="f-periodo" value={filtro.periodo} onChange={(e) => setFiltro((f) => ({ ...f, periodo: e.target.value }))}>
                <option value="">Todos</option>
                {[...new Set([filtro.periodo, ...periodos].filter(Boolean))].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <ErrorApi error={errorAccion ?? ofertas.error} />
          {ofertas.cargando && !ofertas.data ? <Cargando /> : (
            <div className="tabla-scroll">
              <table className="text-body-sm">
                <thead>
                  <tr>
                    <th>Curso</th><th>Promoción</th><th>Periodo</th><th>Docentes</th><th>RA</th>
                    <th className="num">Inscritos</th><th>Notas</th><th><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(ofertas.data ?? []).map((o) => {
                    const esperadas = o.inscritos * o.criterios
                    const avance = esperadas ? o.notas / esperadas : 0
                    return (
                      <tr key={o.id_curso}>
                        <td><strong>{o.codigo}</strong><br />{o.nombre}{o.grupo > 1 && ` · grupo ${o.grupo}`}</td>
                        <td>{o.cohorte}</td>
                        <td className="nowrap">{o.periodo}</td>
                        <td>{o.docentes.map((d) => d.nombre).join(', ') || <span className="texto-suave">Sin asignar</span>}</td>
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
                          <button type="button" className="btn-enlace peligro" onClick={() => eliminar(o)}>Eliminar</button>
                        </td>
                      </tr>
                    )
                  })}
                  {ofertas.data?.length === 0 && <tr><td colSpan={8} className="texto-suave">No hay cursos ofertados con estos filtros.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editando && (
        <FormularioOferta
          oferta={editando === 'nueva' ? null : editando}
          catalogo={catalogo.data}
          cohortes={listaCohortes}
          docentes={docentes.data ?? []}
          onClose={() => setEditando(null)}
          onGuardada={alGuardar}
        />
      )}
      {matriculando && <MatriculaOferta oferta={matriculando} onClose={() => setMatriculando(null)} onGuardada={alGuardar} />}
    </div>
  )
}
