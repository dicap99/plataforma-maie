import { useState } from 'react'
import * as usuariosApi from '../../api/usuariosApi'
import * as adminApi from '../../api/adminApi'
import useApi from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext.jsx'
import Modal from '../../components/common/Modal.jsx'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'

const ROLES = ['coordinador', 'docente', 'estudiante']
const VACIO = { identificacion: '', nombres: '', apellidos: '', email: '', rol: 'docente', activo: true, password: '', id_docente: '' }

// Gestión de usuarios y roles (RNF-SEG-01). Un usuario docente puede vincularse a su perfil (RF-ADM-06).
export default function UsuariosPage() {
  const { usuario: sesion } = useAuth()
  const usuarios = useApi(usuariosApi.listarUsuarios)
  const docentes = useApi(() => adminApi.listar('docentes'))
  const [editando, setEditando] = useState(null) // null | VACIO | usuario
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

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Usuarios</h1>
        <button type="button" className="btn btn-primario" onClick={() => setEditando(VACIO)}>Nuevo usuario</button>
      </header>
      <ErrorApi error={usuarios.error} onReintentar={usuarios.recargar} />
      <ErrorApi error={errorAccion} />
      {usuarios.cargando && !usuarios.data ? <Cargando /> : usuarios.data && (
        <div className="card tabla-scroll">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Perfil docente</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {usuarios.data.map((u) => (
                <tr key={u.id_usuario}>
                  <td>{u.nombres} {u.apellidos}</td>
                  <td>{u.email}</td>
                  <td>{u.rol}</td>
                  <td>{u.docente_vinculado ?? '—'}</td>
                  <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="acciones">
                    <button type="button" className="btn-enlace" onClick={() => setEditando({ ...u, password: '', id_docente: u.id_docente ?? '' })}>Editar</button>
                    {u.id_usuario !== sesion.id && (
                      <button type="button" className="btn-enlace peligro" onClick={() => eliminar(u)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <FormularioUsuario
          inicial={editando}
          docentes={docentes.data ?? []}
          onClose={() => setEditando(null)}
          onGuardado={() => usuarios.recargar()}
        />
      )}
    </>
  )
}

function FormularioUsuario({ inicial, docentes, onClose, onGuardado }) {
  const nuevo = !inicial.id_usuario
  const [v, setV] = useState(inicial)
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const campo = (nombre) => ({ id: `u-${nombre}`, value: v[nombre] ?? '', onChange: (e) => setV({ ...v, [nombre]: e.target.value }) })

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const datos = {
      identificacion: v.identificacion, nombres: v.nombres, apellidos: v.apellidos, email: v.email,
      rol: v.rol, activo: v.activo, password: v.password || undefined,
      id_docente: v.rol === 'docente' ? v.id_docente || null : null,
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
    <Modal titulo={nuevo ? 'Nuevo usuario' : 'Editar usuario'} onClose={onClose}>
      <form onSubmit={enviar}>
        <div className="form-grid">
          <div className="campo"><label htmlFor="u-identificacion">Identificación *</label><input required {...campo('identificacion')} /></div>
          <div className="campo"><label htmlFor="u-email">Correo *</label><input type="email" required {...campo('email')} /></div>
          <div className="campo"><label htmlFor="u-nombres">Nombres *</label><input required {...campo('nombres')} /></div>
          <div className="campo"><label htmlFor="u-apellidos">Apellidos *</label><input required {...campo('apellidos')} /></div>
          <div className="campo">
            <label htmlFor="u-rol">Rol *</label>
            <select {...campo('rol')}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          </div>
          <div className="campo">
            <label htmlFor="u-password">{nuevo ? 'Contraseña *' : 'Nueva contraseña (opcional)'}</label>
            <input type="password" minLength={8} required={nuevo} autoComplete="new-password" {...campo('password')} />
          </div>
          {v.rol === 'docente' && (
            <div className="campo campo-ancho">
              <label htmlFor="u-id_docente">Perfil docente vinculado</label>
              <select {...campo('id_docente')}>
                <option value="">Sin vincular</option>
                {docentes.map((d) => <option key={d.id_docente} value={d.id_docente}>{d.nombre_completo} ({d.afiliacion})</option>)}
              </select>
            </div>
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
