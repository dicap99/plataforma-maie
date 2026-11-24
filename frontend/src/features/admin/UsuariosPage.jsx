import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as usuariosApi from '../../api/usuariosApi'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext.jsx'
import Modal from '../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { ETIQUETA_ROL } from '../../routes/navigation'
import SelectorCampos from './SelectorCampos.jsx'
import CursosDocente from './CursosDocente.jsx'
import FichaUsuario from './FichaUsuario.jsx'
import PregradoEvaluacionPage from '../evalDocente/PregradoEvaluacionPage.jsx'

const ROLES = ['coordinador', 'docente', 'estudiante']
const VACIO = {
  identificacion: '', nombres: '', apellidos: '', email: '', telefono: '', rol: 'docente', activo: true, password: '',
  id_docente: '', afiliacion: '', departamento: '', universidad: '', campos_formacion: [], id_cohorte: '',
}
const separarCampos = (texto) => String(texto ?? '').split(/\n|,|\s-\s|\+/).map((c) => c.replace(/^[-•\s]+/, '').trim()).filter(Boolean)

// Coordinación registra los cursos en los que participa un docente (el docente solo los consulta en «Mi perfil»).
function CursosDeDocente({ usuario, onClose }) {
  const perfil = useApi(() => adminApi.perfilDocente(usuario.id_docente), [usuario.id_docente])
  const [cursos, setCursos] = useState(null)
  return (
    <Modal titulo={`Cursos de ${usuario.nombres} ${usuario.apellidos}`} onClose={onClose} ancho={900}>
      <ErrorApi error={perfil.error} onReintentar={perfil.recargar} />
      {perfil.data ? (
        <CursosDocente idDocente={usuario.id_docente} cursos={cursos ?? perfil.data.cursos} onCambio={(p) => setCursos(p.cursos)} />
      ) : !perfil.error && <Cargando />}
      <div className="modal-acciones">
        <button type="button" className="btn btn-secundario" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}

// Usuarios y roles (RNF-SEG-01), pestaña de Gestión académica. Coordinación registra los datos de contacto
// (correo y teléfono) y lo propio de cada rol: el estudiante con su promoción, y el docente con su afiliación
// y campos de formación (perfil de la hoja «Docentes», RF-ADM-06). Los beneficios del estudiante por
// semestre se editan en la pestaña «Beneficios». Información académica refleja estos datos.
// Usuarios por rol (decisión del usuario, 2026-11-24), con el mismo tratamiento que las OPS: por cada promoción
// se muestran los estudiantes registrados y, hasta completar los matriculados que reporta el libro, renglones
// «por registrar»; cada usuario tiene su ficha de detalle (materias, beneficios, producción o perfil docente).
const VISTAS = [
  { id: 'posgrado', titulo: 'Estudiantes de posgrado' },
  { id: 'pregrado', titulo: 'Estudiantes de pregrado' },
  { id: 'docentes', titulo: 'Docentes' },
  { id: 'coordinacion', titulo: 'Coordinación' },
]
const ordenNombre = (a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`)

export default function UsuariosPage({ embebido = false }) {
  const { usuario: sesion } = useAuth()
  const usuarios = useApi(usuariosApi.listarUsuarios)
  const docentes = useApi(() => adminApi.listar('docentes'))
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const campos = useApi(usuariosApi.camposFormacion)
  const [editando, setEditando] = useState(null) // null | VACIO | usuario
  const [cursosDe, setCursosDe] = useState(null) // usuario docente cuyos cursos se editan
  const [fichaDe, setFichaDe] = useState(null)
  const [parametros] = useSearchParams()
  const [vista, setVista] = useState(() => (VISTAS.some((v) => v.id === parametros.get('vista')) ? parametros.get('vista') : 'posgrado'))
  const [busqueda, setBusqueda] = useState('')
  const [errorAccion, setErrorAccion] = useState(null)

  const eliminar = async (u) => {
    if (!window.confirm(`¿Eliminar el usuario ${u.email}?`)) return
    try {
      await usuariosApi.eliminarUsuario(u.id_usuario)
      usuarios.recargar()
    } catch (err) {
      setErrorAccion(err)
    }
  }
  const editar = (u) => setEditando({
    ...u, password: '', telefono: u.telefono ?? '', id_docente: u.id_docente ?? '', afiliacion: u.afiliacion ?? '',
    departamento: u.departamento ?? '', universidad: u.universidad ?? '',
    campos_formacion: separarCampos(u.campo_formacion), id_cohorte: u.id_cohorte ? String(u.id_cohorte) : '',
  })

  const q = busqueda.trim().toLowerCase()
  const coincide = (u) => !q || `${u.nombres} ${u.apellidos} ${u.email} ${u.identificacion}`.toLowerCase().includes(q)
  const todos = usuarios.data ?? []
  const estudiantes = todos.filter((u) => u.rol === 'estudiante')
  const promociones = [...(cohortes.data ?? [])].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? -1 : 1))

  const acciones = (u) => (
    <td className="acciones whitespace-nowrap">
      <button type="button" className="btn-enlace" onClick={() => setFichaDe(u)}>Ficha</button>
      <button type="button" className="btn-enlace" onClick={() => editar(u)}>Editar</button>
      {u.rol === 'docente' && u.id_docente && <button type="button" className="btn-enlace" onClick={() => setCursosDe(u)}>Cursos</button>}
      {u.id_usuario !== sesion.id && <button type="button" className="btn-enlace peligro" onClick={() => eliminar(u)}>Eliminar</button>}
    </td>
  )
  const estado = (u) => `${u.activo ? 'Activo' : 'Inactivo'}${u.debe_cambiar_password ? ' · credenciales temporales' : ''}`
  const pendiente = (clave, texto, onRegistrar, columnas) => (
    <tr key={clave} className="text-slate-400">
      <td colSpan={columnas - 1} className="italic">{texto}</td>
      <td className="acciones"><button type="button" className="btn-enlace" onClick={onRegistrar}>Registrar</button></td>
    </tr>
  )

  // ---- Estudiantes de posgrado por promoción ----
  const tablaPosgrado = () => {
    let reportados = 0
    let registradosTotal = 0
    return (
      <table>
        <thead>
          <tr><th>Estudiante</th><th>Identificación</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr>
        </thead>
        <tbody>
          {promociones.map((c) => {
            const registrados = estudiantes.filter((u) => u.id_cohorte === c.id_cohorte).sort(ordenNombre)
            const n = Number(c.matriculados ?? c.inscritos ?? 0)
            reportados += n
            registradosTotal += registrados.length
            const faltan = q ? 0 : Math.max(0, n - registrados.length)
            const visibles = registrados.filter(coincide)
            if (q && !visibles.length) return null
            return [
              ...visibles.map((u) => (
                <tr key={u.id_usuario}>
                  <td>{u.apellidos} {u.nombres}</td><td>{u.identificacion}</td><td>{u.email}</td>
                  <td className="nowrap">{u.telefono ?? <span className="texto-suave">—</span>}</td><td>{estado(u)}</td>{acciones(u)}
                </tr>
              )),
              ...Array.from({ length: faltan }, (_, i) => pendiente(`p-${c.id_cohorte}-${i}`,
                `Promoción ${c.nombre} · estudiante ${registrados.length + i + 1} de ${n} · por registrar`,
                () => setEditando({ ...VACIO, rol: 'estudiante', id_cohorte: String(c.id_cohorte) }), 6)),
              <tr key={`t-${c.id_cohorte}`} className="bg-slate-50 font-semibold">
                <td colSpan={6}>Promoción {c.nombre} ({c.periodo_inicio} a {c.periodo_fin ?? 'en curso'}) · {n} matriculado(s) reportado(s) · {registrados.length} registrado(s)</td>
              </tr>,
            ]
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold"><td colSpan={6}>Total: {reportados} matriculados reportados · {registradosTotal} registrados en la plataforma</td></tr>
        </tfoot>
      </table>
    )
  }

  // ---- Estudiantes de pregrado (sin promoción de la maestría) ----
  const tablaPregrado = () => {
    const lista = estudiantes.filter((u) => !u.id_cohorte && coincide(u)).sort(ordenNombre)
    return (
      <table>
        <thead><tr><th>Estudiante</th><th>Identificación</th><th>Correo</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          {lista.map((u) => <tr key={u.id_usuario}><td>{u.apellidos} {u.nombres}</td><td>{u.identificacion}</td><td>{u.email}</td><td>{estado(u)}</td>{acciones(u)}</tr>)}
          {lista.length === 0 && (
            <tr><td colSpan={5} className="texto-suave">
              No hay cuentas de estudiantes de pregrado. Se crean al cargar la plantilla de arriba.
            </td></tr>
          )}
        </tbody>
      </table>
    )
  }

  // ---- Docentes: con cuenta y perfiles del directorio aún sin cuenta ----
  // Docentes: un solo rol, presentados en dos grupos (decisión del usuario, 2026-11-24).
  const GRUPOS_DOCENTES = [
    { id: 'externos', titulo: 'Docentes externos', de: (a) => a === 'EXTERNO' },
    { id: 'udenar', titulo: 'Docentes UDENAR', de: (a) => a === 'UDENAR' },
    { id: 'sin', titulo: 'Sin afiliación registrada', de: (a) => !a },
  ]
  const tablaDocentes = () => {
    const conCuenta = todos.filter((u) => u.rol === 'docente' && coincide(u)).sort(ordenNombre)
    const sinCuenta = q ? [] : (docentes.data ?? []).filter((d) => !d.id_usuario)
    const afiliacion = (u) => (u.afiliacion === 'EXTERNO' ? ['Externo', u.universidad].filter(Boolean).join(', ') : u.afiliacion ? 'UDENAR' : '—')
    return (
      <table>
        <thead><tr><th>Docente</th><th>Correo</th><th>Afiliación</th><th>Campos de formación</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          {/* Un solo rol: solo se presentan agrupados, primero los externos y debajo los de UDENAR. */}
          {GRUPOS_DOCENTES.map((g) => {
            const usuariosGrupo = conCuenta.filter((u) => g.de(u.afiliacion))
            const perfilesGrupo = sinCuenta.filter((d) => g.de(d.afiliacion))
            if (!usuariosGrupo.length && !perfilesGrupo.length) return null
            return [
              <tr key={`g-${g.id}`} className="bg-slate-50 font-semibold">
                <td colSpan={6}>{g.titulo} · {usuariosGrupo.length + perfilesGrupo.length}</td>
              </tr>,
              ...usuariosGrupo.map((u) => (
                <tr key={u.id_usuario}>
                  <td>{u.apellidos} {u.nombres}</td><td>{u.email}</td><td>{afiliacion(u)}</td>
                  <td>{separarCampos(u.campo_formacion).join(', ') || <span className="texto-suave">—</span>}</td><td>{estado(u)}</td>{acciones(u)}
                </tr>
              )),
              ...perfilesGrupo.map((d) => pendiente(`d-${d.id_docente}`, `${d.nombre_completo} · perfil del directorio sin cuenta · por registrar`,
                () => setEditando({ ...VACIO, rol: 'docente', id_docente: d.id_docente }), 6)),
            ]
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold"><td colSpan={6}>Total: {conCuenta.length} con cuenta · {sinCuenta.length} perfil(es) sin cuenta</td></tr>
        </tfoot>
      </table>
    )
  }

  const tablaCoordinacion = () => {
    const lista = todos.filter((u) => u.rol === 'coordinador' && coincide(u))
    return (
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{lista.map((u) => <tr key={u.id_usuario}><td>{u.nombres} {u.apellidos}</td><td>{u.email}</td><td>{u.telefono ?? '—'}</td><td>{estado(u)}</td>{acciones(u)}</tr>)}</tbody>
      </table>
    )
  }
  const TABLAS = { posgrado: tablaPosgrado, pregrado: tablaPregrado, docentes: tablaDocentes, coordinacion: tablaCoordinacion }

  return (
    <div className="flex flex-col gap-space-lg">
      {!embebido && (
        <header>
          <h1 className="m-0 font-display text-headline-lg text-primary">Usuarios</h1>
        </header>
      )}
      <div className="flex flex-wrap items-end justify-between gap-space-sm">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Usuarios por rol">
          {VISTAS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === vista} onClick={() => setVista(v.id)}
              className={`rounded-lg border px-3 py-1 text-label-md transition-colors ${
                v.id === vista ? 'border-secondary bg-secondary/10 font-semibold text-secondary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
              {v.titulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-space-sm">
          <div className="campo">
            <label htmlFor="u-buscar">Buscar</label>
            <input id="u-buscar" type="search" placeholder="Nombre, correo o identificación" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primario" onClick={() => setEditando(VACIO)}>
            <Icono nombre="person_add" className="text-[18px]" /> Nuevo usuario
          </button>
        </div>
      </div>
      {vista === 'posgrado' && (
        <p className="m-0 max-w-4xl texto-suave">
          Aquí se registra la información básica de cada usuario. Por cada promoción, los renglones «por registrar» completan
          los matriculados que reporta el libro. La ficha consulta sus materias por semestre (con las electivas), beneficios y
          producción, que se registran en su sección (Asignación por semestre y Datos del programa).
        </p>
      )}
      <ErrorApi error={usuarios.error} onReintentar={usuarios.recargar} />
      <ErrorApi error={errorAccion} />
      {vista === 'pregrado' && <PregradoEvaluacionPage embebido />}
      {vista === 'pregrado' && <h2 className="m-0 font-display text-headline-sm text-primary">Cuentas de estudiantes de pregrado</h2>}
      {usuarios.cargando && !usuarios.data ? <Cargando /> : usuarios.data && <div className="card tabla-scroll">{TABLAS[vista]()}</div>}
      {fichaDe && <FichaUsuario usuario={fichaDe} onClose={() => setFichaDe(null)} />}
      {cursosDe && <CursosDeDocente usuario={cursosDe} onClose={() => { setCursosDe(null); docentes.recargar() }} />}
      {editando && (
        <FormularioUsuario
          inicial={editando}
          docentes={docentes.data ?? []}
          cohortes={[...(cohortes.data ?? [])].sort((a, b) => (a.periodo_inicio < b.periodo_inicio ? 1 : -1))}
          campos={campos.data ?? []}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            usuarios.recargar()
            docentes.recargar()
            campos.recargar()
          }}
        />
      )}
    </div>
  )
}

function FormularioUsuario({ inicial, docentes, cohortes, campos, onClose, onGuardado }) {
  const nuevo = !inicial.id_usuario
  const [v, setV] = useState(inicial)
  // Cambiar de promoción borra la beca y los beneficios registrados en la anterior.
  const pierdeBeneficios = Boolean(inicial.id_cohorte && v.id_cohorte !== inicial.id_cohorte && (inicial.beca || inicial.beneficios?.length))
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const campo = (nombre) => ({ id: `u-${nombre}`, value: v[nombre] ?? '', onChange: (e) => setV({ ...v, [nombre]: e.target.value }) })
  // Perfiles sin cuenta (p. ej. importados del Excel) o el propio, para vincular.
  const perfilesLibres = docentes.filter((d) => !d.id_usuario || d.id_docente === inicial.id_docente)

  const vincular = (idDocente) => {
    const p = docentes.find((d) => d.id_docente === idDocente)
    setV({
      ...v, id_docente: idDocente,
      ...(p ? {
        afiliacion: p.afiliacion, campos_formacion: separarCampos(p.campo_formacion),
        departamento: p.departamento ?? '', universidad: p.universidad ?? '',
      } : {}),
    })
  }

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const esDocente = v.rol === 'docente'
    const esEstudiante = v.rol === 'estudiante'
    const datos = {
      identificacion: v.identificacion, nombres: v.nombres, apellidos: v.apellidos, email: v.email, telefono: v.telefono.trim() || null,
      rol: v.rol, activo: v.activo, password: v.password || undefined,
      id_docente: esDocente ? v.id_docente || null : null,
      // La universidad solo aplica a los externos; al pasar a UDENAR se borra.
      ...(esDocente ? {
        afiliacion: v.afiliacion || null, campos_formacion: v.campos_formacion, departamento: v.departamento,
        universidad: v.afiliacion === 'EXTERNO' ? v.universidad : '',
      } : {}),
      ...(esEstudiante ? { id_cohorte: v.id_cohorte ? Number(v.id_cohorte) : null } : {}),
    }
    try {
      await (nuevo ? usuariosApi.crearUsuario(datos) : usuariosApi.actualizarUsuario(inicial.id_usuario, datos))
      onGuardado()
      onClose()
    } catch (err) {
      setErrores(Array.isArray(err.details) ? err.details.map((d) => d.msg) : [err.message])
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={nuevo ? 'Nuevo usuario' : 'Editar usuario'} onClose={onClose} ancho={640}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <div className="campo"><label htmlFor="u-identificacion">Identificación *</label><input required {...campo('identificacion')} /></div>
          <div className="campo"><label htmlFor="u-email">Correo *</label><input type="email" required {...campo('email')} /></div>
          <div className="campo"><label htmlFor="u-nombres">Nombres *</label><input required {...campo('nombres')} /></div>
          <div className="campo"><label htmlFor="u-apellidos">Apellidos *</label><input required {...campo('apellidos')} /></div>
          <div className="campo">
            <label htmlFor="u-telefono">Teléfono</label>
            <input type="tel" maxLength={30} placeholder="+57 300 000 0000" autoComplete="off" {...campo('telefono')} />
          </div>
          <div className="campo">
            <label htmlFor="u-rol">Rol *</label>
            <select {...campo('rol')}>{ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}</select>
          </div>
          <div className="campo">
            <label htmlFor="u-password">{nuevo ? 'Contraseña *' : 'Nueva contraseña (opcional)'}</label>
            <input type="password" minLength={8} required={nuevo} autoComplete="new-password" {...campo('password')} />
          </div>

          {v.rol === 'estudiante' && (
            <fieldset className="campo-ancho flex flex-col gap-space-sm rounded-xl border border-outline-variant p-space-sm">
              <legend className="px-1 text-label-md font-semibold text-primary">Datos del estudiante</legend>
              <div className="campo">
                <label htmlFor="u-id_cohorte">Promoción</label>
                <select {...campo('id_cohorte')}>
                  <option value="">Sin asignar</option>
                  {cohortes.map((c) => <option key={c.id_cohorte} value={c.id_cohorte}>Promoción {c.nombre} ({c.periodo_inicio})</option>)}
                </select>
              </div>
              {pierdeBeneficios ? (
                <p className="m-0 texto-suave" role="alert">
                  Al cambiar de promoción se borran la beca y los beneficios registrados en la promoción {inicial.cohorte}.
                </p>
              ) : (
                <p className="m-0 texto-suave">La beca y los beneficios de cada semestre se registran en la pestaña «Beneficios».</p>
              )}
            </fieldset>
          )}

          {v.rol === 'docente' && (
            <fieldset className="campo-ancho flex flex-col gap-space-sm rounded-xl border border-outline-variant p-space-sm">
              <legend className="px-1 text-label-md font-semibold text-primary">Perfil docente</legend>
              <div className="campo">
                <span id="u-afiliacion" className="font-semibold">Afiliación *</span>
                <div className="flex gap-space-md" role="radiogroup" aria-labelledby="u-afiliacion">
                  {[['UDENAR', 'UDENAR'], ['EXTERNO', 'Externo']].map(([valor, etiqueta]) => (
                    <label key={valor} className="campo-check">
                      <input type="radio" name="afiliacion" value={valor} checked={v.afiliacion === valor} required
                        onChange={() => setV({ ...v, afiliacion: valor })} />
                      {etiqueta}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <div className="campo">
                  <label htmlFor="u-departamento">Departamento o unidad</label>
                  <input maxLength={150} placeholder="Departamento de Electrónica" {...campo('departamento')} />
                </div>
                {v.afiliacion === 'EXTERNO' && (
                  <div className="campo">
                    <label htmlFor="u-universidad">Universidad</label>
                    <input maxLength={150} placeholder="Institución de afiliación" {...campo('universidad')} />
                  </div>
                )}
              </div>
              <SelectorCampos opciones={campos} valor={v.campos_formacion} onChange={(lista) => setV({ ...v, campos_formacion: lista })} />
              {perfilesLibres.length > 0 && (
                <div className="campo">
                  <label htmlFor="u-id_docente">Vincular a un perfil registrado (opcional)</label>
                  <select id="u-id_docente" value={v.id_docente} onChange={(e) => vincular(e.target.value)}>
                    <option value="">Crear o usar el perfil con su nombre</option>
                    {perfilesLibres.map((d) => <option key={d.id_docente} value={d.id_docente}>{d.nombre_completo} ({d.afiliacion})</option>)}
                  </select>
                </div>
              )}
            </fieldset>
          )}

          <label className="campo-check campo-ancho">
            <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} /> Usuario activo
          </label>
        </div>
        {errores.length > 0 && <ul className="alerta-error" role="alert">{errores.map((m) => <li key={m}>{m}</li>)}</ul>}
        <div className="modal-acciones">
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}
