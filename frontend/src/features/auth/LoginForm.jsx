import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { INICIO_POR_ROL } from '../../routes/navigation'

// Autenticación: credenciales → JWT (POST /api/v1/auth/login).
export default function LoginForm() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const sesion = await login(email, password)
      navigate(INICIO_POR_ROL[sesion.rol], { replace: true })
    } catch (err) {
      setError(err.message ?? 'No fue posible iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <form className="card" style={{ width: '100%', maxWidth: 380 }} onSubmit={onSubmit}>
        <h1>Plataforma MaIE</h1>
        <p className="texto-suave">Maestría en Ingeniería Electrónica · Universidad de Nariño</p>
        <div className="campo">
          <label htmlFor="email">Correo institucional</label>
          <input id="email" type="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="alerta-error" role="alert">{error}</p>}
        <button className="btn btn-primario" style={{ width: '100%' }} disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
