import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { INICIO_POR_ROL } from './navigation'

// Exige sesión activa y, si se indica, uno de los roles permitidos.
export default function ProtectedRoute({ roles }) {
  const { usuario } = useAuth()
  const location = useLocation()

  if (!usuario) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to={INICIO_POR_ROL[usuario.rol] ?? '/login'} replace />
  }
  return <Outlet />
}
