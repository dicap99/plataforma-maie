import { useState } from 'react'
import * as authApi from '../../api/authApi'
import { useAuth } from '../../context/AuthContext.jsx'

// Cambio de la contraseña propia: es lo único que cada usuario modifica de su cuenta (asesoría del
// 20-oct-2026). Al cambiarla deja de ser temporal: avisa a MainLayout y llama `onCambio` para que la
// página recargue sus datos.
export default function CambiarContrasena({ temporal = false, onCambio }) {
  const [clave, setClave] = useState({ actual: '', nueva: '', confirmacion: '' })
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const { actualizarToken } = useAuth()

  const cambiar = async (e) => {
    e.preventDefault()
    if (clave.nueva !== clave.confirmacion) {
      setMensaje({ ok: false, texto: 'La confirmación no coincide con la nueva contraseña' })
      return
    }
    setOcupado(true)
    try {
      const { data } = await authApi.cambiarPassword(clave.actual, clave.nueva)
      if (data?.token) actualizarToken(data.token) // la sesión deja de estar restringida
      setClave({ actual: '', nueva: '', confirmacion: '' })
      setMensaje({ ok: true, texto: 'Contraseña actualizada' })
      window.dispatchEvent(new Event('maie:cuenta-actualizada'))
      onCambio?.()
    } catch (err) {
      setMensaje({ ok: false, texto: err.message })
    } finally {
      setOcupado(false)
    }
  }
  const campo = (nombre) => ({ value: clave[nombre], onChange: (e) => setClave({ ...clave, [nombre]: e.target.value }) })

  return (
    <form className="form-grid" onSubmit={cambiar}>
      {temporal && <p className="alerta-error campo-ancho">Su contraseña es temporal: cámbiela.</p>}
      <div className="campo">
        <label htmlFor="c-actual">Contraseña actual</label>
        <input id="c-actual" type="password" required autoComplete="current-password" {...campo('actual')} />
      </div>
      <div className="campo">
        <label htmlFor="c-nueva">Nueva contraseña (mínimo 8 caracteres)</label>
        <input id="c-nueva" type="password" required minLength={8} autoComplete="new-password" {...campo('nueva')} />
      </div>
      <div className="campo">
        <label htmlFor="c-confirmacion">Confirme la nueva contraseña</label>
        <input id="c-confirmacion" type="password" required minLength={8} autoComplete="new-password" {...campo('confirmacion')} />
      </div>
      <div className="campo" style={{ alignSelf: 'end' }}>
        <button className="btn btn-secundario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </div>
      {mensaje && <p className={`campo-ancho ${mensaje.ok ? 'texto-exito' : 'alerta-error'}`} role="status">{mensaje.texto}</p>}
    </form>
  )
}
