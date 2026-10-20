import { useEffect, useState } from 'react'
import * as adminApi from '../../api/adminApi'
import * as authApi from '../../api/authApi'
import useApi from '../../hooks/useApi'
import { Cargando, ErrorApi } from '../../components/common/Estado.jsx'
import CursosDocente from './CursosDocente.jsx'

const CAMPOS = [
  { name: 'titulacion_maxima', label: 'Titulación máxima' },
  { name: 'formacion_profesional', label: 'Formación profesional', multilinea: true },
  { name: 'campo_formacion', label: 'Campo de formación' },
  { name: 'linea_investigacion', label: 'Línea de investigación' },
  { name: 'enlace_perfil', label: 'Enlace a perfil (CvLAC, ORCID, LinkedIn…)' },
]

const avisarCuenta = () => window.dispatchEvent(new Event('maie:cuenta-actualizada'))

// Identificación, correo (con el que inicia sesión) y contraseña de la cuenta propia.
function MiCuenta({ perfil, onGuardado }) {
  const [cuenta, setCuenta] = useState({ identificacion: perfil.identificacion ?? '', email: perfil.email ?? '' })
  const [clave, setClave] = useState({ actual: '', nueva: '' })
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = async (e, accion, texto) => {
    e.preventDefault()
    setOcupado(true)
    try {
      await accion()
      setMensaje({ ok: true, texto })
      avisarCuenta()
      onGuardado?.()
    } catch (err) {
      setMensaje({ ok: false, texto: err.message })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="card">
      <h2>Mi cuenta</h2>
      {perfil.debe_cambiar_password && (
        <p className="alerta-error">
          Su identificación, su correo y su contraseña son temporales. Registre los suyos; desde entonces inicia sesión con su correo.
        </p>
      )}
      <form className="form-grid" onSubmit={(e) => ejecutar(e, () => authApi.actualizarCuenta(cuenta), 'Datos de la cuenta actualizados')}>
        <div className="campo">
          <label htmlFor="c-identificacion">Identificación</label>
          <input id="c-identificacion" required maxLength={20} value={cuenta.identificacion} onChange={(e) => setCuenta({ ...cuenta, identificacion: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="c-email">Correo (inicio de sesión)</label>
          <input id="c-email" type="email" required value={cuenta.email} onChange={(e) => setCuenta({ ...cuenta, email: e.target.value })} />
        </div>
        <div className="campo" style={{ alignSelf: 'end' }}>
          <button className="btn btn-secundario" disabled={ocupado}>Guardar datos de la cuenta</button>
        </div>
      </form>
      <form className="form-grid" onSubmit={(e) => ejecutar(e, async () => {
        await authApi.cambiarPassword(clave.actual, clave.nueva)
        setClave({ actual: '', nueva: '' })
      }, 'Contraseña actualizada')}>
        <div className="campo">
          <label htmlFor="c-actual">Contraseña actual</label>
          <input id="c-actual" type="password" required autoComplete="current-password" value={clave.actual} onChange={(e) => setClave({ ...clave, actual: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="c-nueva">Nueva contraseña (mínimo 8 caracteres)</label>
          <input id="c-nueva" type="password" required minLength={8} autoComplete="new-password" value={clave.nueva} onChange={(e) => setClave({ ...clave, nueva: e.target.value })} />
        </div>
        <div className="campo" style={{ alignSelf: 'end' }}>
          <button className="btn btn-secundario" disabled={ocupado}>Cambiar contraseña</button>
        </div>
      </form>
      {mensaje && <p className={mensaje.ok ? 'texto-exito' : 'alerta-error'} role="status">{mensaje.texto}</p>}
    </section>
  )
}

// Perfil del docente mantenido por él mismo (RF-ADM-06): cuenta, datos del perfil y cursos.
export default function PerfilDocentePage() {
  const { data, error, cargando, recargar } = useApi(adminApi.perfilDocentePropio)
  const [perfil, setPerfil] = useState(null)
  const [valores, setValores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!data) return
    setPerfil(data)
    setValores(Object.fromEntries(CAMPOS.map((c) => [c.name, data[c.name] ?? ''])))
  }, [data])

  if (cargando && !perfil) return <Cargando />
  if (error) {
    return (
      <>
        <h1>Mi perfil docente</h1>
        <ErrorApi error={error} onReintentar={error.status === 404 ? undefined : recargar} />
      </>
    )
  }
  if (!perfil) return <Cargando />

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const { data: actualizado } = await adminApi.actualizarPerfilDocentePropio(
        Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v === '' ? null : v])),
      )
      setPerfil(actualizado)
      setMensaje({ ok: true, texto: 'Perfil actualizado' })
    } catch (err) {
      setMensaje({ ok: false, texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <header className="encabezado-pagina">
        <h1>Mi perfil docente</h1>
        <p className="texto-suave">{perfil.nombre_completo} · {perfil.afiliacion}</p>
      </header>

      <MiCuenta perfil={perfil} onGuardado={recargar} />

      <form className="card" onSubmit={guardar}>
        <h2>Perfil</h2>
        <div className="form-grid">
          {CAMPOS.map((c) => (
            <div key={c.name} className={`campo${c.multilinea ? ' campo-ancho' : ''}`}>
              <label htmlFor={`p-${c.name}`}>{c.label}</label>
              {c.multilinea ? (
                <textarea id={`p-${c.name}`} rows={3} value={valores[c.name] ?? ''} onChange={(e) => setValores({ ...valores, [c.name]: e.target.value })} />
              ) : (
                <input id={`p-${c.name}`} value={valores[c.name] ?? ''} onChange={(e) => setValores({ ...valores, [c.name]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="campo campo-ancho">
            <span className="etiqueta">Componentes de formación que apoya</span>
            <p>{perfil.componentes?.length ? perfil.componentes.join(', ') : <span className="texto-suave">Se completan al registrar sus cursos.</span>}</p>
          </div>
        </div>
        {mensaje && <p className={mensaje.ok ? 'texto-exito' : 'alerta-error'} role="status">{mensaje.texto}</p>}
        <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar perfil'}</button>
      </form>

      <CursosDocente cursos={perfil.cursos} onCambio={setPerfil} />
    </>
  )
}
