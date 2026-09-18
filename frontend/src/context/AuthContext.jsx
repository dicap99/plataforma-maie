import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { TOKEN_KEY } from '../api/client'
import * as authApi from '../api/authApi'

const AuthContext = createContext(null)

// Lee el token guardado y lo descarta si expiró. Payload esperado: { sub, rol, exp }.
const leerSesion = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  try {
    const payload = jwtDecode(token)
    if (payload.exp * 1000 < Date.now()) throw new Error('expirado')
    return { id: payload.sub, rol: payload.rol, nombre: payload.nombre }
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerSesion)

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password)
    localStorage.setItem(TOKEN_KEY, data.token)
    const sesion = leerSesion()
    setUsuario(sesion)
    return sesion
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUsuario(null)
  }, [])

  const value = useMemo(() => ({ usuario, login, logout }), [usuario, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
