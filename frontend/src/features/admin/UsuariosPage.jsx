import { useState } from 'react'
import * as usuariosApi from '../../api/usuariosApi'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext.jsx'
import Modal from '../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import Icono from '../../components/common/Icono.jsx'
import { ETIQUETA_ROL } from '../../routes/navigation'
import SelectorCampos from './SelectorCampos.jsx'

const ROLES = ['coordinador', 'docente', 'estudiante']
const BECAS = [
  { valor: '100', etiqueta: 'Beca 100 %' },
  { valor: 'hora_catedra', etiqueta: 'Beca hora cátedra' },
  { valor: 'sintraunicol', etiqueta: 'Beca SINTRAUNICOL' },
]
const VACIO = {
  identificacion: '', nombres: '', apellidos: '', email: '', rol: 'docente', activo: true, password: '',
  id_docente: '', afiliacion: '', campos_formacion: [], id_cohorte: '', beca: '',
}
const separarCampos = (texto) => String(texto ?? '').split(/\n|,|\s-\s|\+/).map((c) => c.replace(/^[-•\s]+/, '').trim()).filter(Boolean)
const etiquetaBeca = (b) => BECAS.find((x) => x.valor === b)?.etiqueta ?? '—'

// Usuarios y roles (RNF-SEG-01), pestaña de Gestión académica. Lo propio de cada rol se registra aquí:
// el estudiante con su promoción y beca, y el docente con su afiliación y campos de formación (perfil
// de la hoja «Docentes», RF-ADM-06). Información académica refleja estos datos.
export default function UsuariosPage({ embebido = false }) {
  const { usuario: sesion } = useAuth()
  const usuarios = useApi(usuariosApi.listarUsuarios)
  const docentes = useApi(() => adminApi.listar('docentes'))
  const cohortes = useApi(() => adminApi.listar('cohortes'))
  const campos = useApi(usuariosApi.camposFormacion)
  const [editando, setEditando] = useState(null) // null | VACIO | usuario
  const [rol, setRol] = useState('')
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
    ...u, password: '', id_docente: u.id_docente ?? '', afiliacion: u.afiliacion ?? '', campos_formacion: separarCampos(u.campo_formacion),
    id_cohorte: u.id_cohorte ? String(u.id_cohorte) : '', beca: u.beca ?? '',
  })

  const q = busqueda.trim().toLowerCase()
  const visibles = (usuarios.data ?? []).filter((u) => (!rol || u.rol === rol)
    && (!q || `${u.nombres} ${u.apellidos} ${u.email} ${u.identificacion}`.toLowerCase().includes(q)))
  const detalleRol = (u) => {
    if (u.rol === 'estudiante') return u.cohorte ? `Promoción ${u.cohorte}${u.beca ? ` · ${etiquetaBeca(u.beca)}` : ''}` : 'Sin promoción'
    if (u.rol === 'docente') {
      if (!u.id_docente) return 'Sin perfil docente'
      return [u.afiliacion === 'EXTERNO' ? 'Externo' : 'UDENAR', separarCampos(u.campo_formacion).join(', ')].filter(Boolean).join(' · ')
    }
    return '—'
  }

  return (
    <div className="flex flex-col gap-space-lg">
      {!embebido && (
        <header>
          <h1 className="m-0 font-display text-headline-lg text-primary">Usuarios</h1>
        </header>
      )}
      <div className="flex flex-wrap items-end justify-between gap-space-sm">
        <div className="flex flex-wrap items-end gap-space-sm">
          <div className="campo">
            <label htmlFor="u-filtro-rol">Rol</label>
            <select id="u-filtro-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="">Todos</option>
              {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="u-buscar">Buscar</label>
            <input id="u-buscar" type="search" placeholder="Nombre, correo o identificación" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn btn-primario" onClick={() => setEditando(VACIO)}>
          <Icono nombre="person_add" className="text-[18px]" /> Nuevo usuario
        </button>
      </div>
      <ErrorApi error={usuarios.error} onReintentar={usuarios.recargar} />
      <ErrorApi error={errorAccion} />
      {usuarios.cargando && !usuarios.data ? <Cargando /> : usuarios.data && (
        <div className="card tabla-scroll">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Promoción / perfil</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id_usuario}>
                  <td>{u.nombres} {u.apellidos}</td>
                  <td>{u.email}</td>
                  <td>{ETIQUETA_ROL[u.rol] ?? u.rol}</td>
                  <td>{detalleRol(u)}</td>
                  <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="acciones">
                    <button type="button" className="btn-enlace" onClick={() => editar(u)}>Editar</button>
                    {u.id_usuario !== sesion.id && (
                      <button type="button" className="btn-enlace peligro" onClick={() => eliminar(u)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={6} className="texto-suave">Ningún usuario coincide con el filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
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
  const [becado, setBecado] = useState(Boolean(inicial.beca))
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const campo = (nombre) => ({ id: `u-${nombre}`, value: v[nombre] ?? '', onChange: (e) => setV({ ...v, [nombre]: e.target.value }) })
  // Perfiles sin cuenta (p. ej. importados del Excel) o el propio, para vincular.
  const perfilesLibres = docentes.filter((d) => !d.id_usuario || d.id_docente === inicial.id_docente)

  const vincular = (idDocente) => {
    const p = docentes.find((d) => d.id_docente === idDocente)
    setV({ ...v, id_docente: idDocente, ...(p ? { afiliacion: p.afiliacion, campos_formacion: separarCampos(p.campo_formacion) } : {}) })
  }

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const esDocente = v.rol === 'docente'
    const esEstudiante = v.rol === 'estudiante'
    const datos = {
      identificacion: v.identificacion, nombres: v.nombres, apellidos: v.apellidos, email: v.email,
      rol: v.rol, activo: v.activo, password: v.password || undefined,
      id_docente: esDocente ? v.id_docente || null : null,
      ...(esDocente ? { afiliacion: v.afiliacion || null, campos_formacion: v.campos_formacion } : {}),
      ...(esEstudiante ? { id_cohorte: v.id_cohorte ? Number(v.id_cohorte) : null, beca: becado ? v.beca || null : null } : {}),
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
              <label className="campo-check">
                <input type="checkbox" checked={becado} disabled={!v.id_cohorte}
                  onChange={(e) => { setBecado(e.target.checked); if (e.target.checked && !v.beca) setV({ ...v, beca: '100' }) }} />
                Becado
              </label>
              {becado && v.id_cohorte && (
                <div className="campo">
                  <label htmlFor="u-beca">Tipo de beca</label>
                  <select {...campo('beca')}>{BECAS.map((b) => <option key={b.valor} value={b.valor}>{b.etiqueta}</option>)}</select>
                </div>
              )}
              {!v.id_cohorte && <p className="texto-suave">Asigne la promoción para registrar la beca.</p>}
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
