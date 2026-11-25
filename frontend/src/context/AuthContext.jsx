import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { TOKEN_KEY } from '../api/client'
import * as authApi from '../api/authApi'

const AuthContext = createContext(null)

// Lee el token guardado y lo descarta si expiró. Payload: { sub, rol, nombre, exp }.
const leerSesion = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  try {
    const payload = jwtDecode(token)
    if (payload.exp * 1000 < Date.now()) throw new Error('expirado')
    // `temporal`: contraseña temporal; solo puede ir a «Mi cuenta» a cambiarla (la API también lo exige).
    return { id: payload.sub, rol: payload.rol, nombre: payload.nombre, temporal: Boolean(payload.temporal) }
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerSesion)

  // El cliente HTTP avisa cuando el API rechaza el token (expirado o usuario desactivado).
  useEffect(() => {
    const cerrar = () => setUsuario(null)
    window.addEventListener('maie:sesion-expirada', cerrar)
    return () => window.removeEventListener('maie:sesion-expirada', cerrar)
  }, [])

  const login = useCallback(async (identificacion, password) => {
    const { data } = await authApi.login(identificacion, password)
    localStorage.setItem(TOKEN_KEY, data.token)
    const sesion = leerSesion()
    setUsuario(sesion)
    return sesion
  }, [])

  // Token nuevo tras cambiar la contraseña (deja de ser temporal).
  const actualizarToken = useCallback((token) => {
    localStorage.setItem(TOKEN_KEY, token)
    setUsuario(leerSesion())
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUsuario(null)
  }, [])

  const value = useMemo(() => ({ usuario, login, logout, actualizarToken }), [usuario, login, logout, actualizarToken])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
