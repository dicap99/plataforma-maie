import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { INICIO_POR_ROL } from './navigation'
import ProtectedRoute from './ProtectedRoute.jsx'
import MainLayout from '../layouts/MainLayout.jsx'
import LoginForm from '../features/auth/LoginForm.jsx'
import DocenteDashboard from '../pages/DocenteDashboard.jsx'
import EstudianteDashboard from '../pages/EstudianteDashboard.jsx'
import NotFound from '../pages/NotFound.jsx'
import EstadisticasDashboard from '../features/admin/EstadisticasDashboard.jsx'
import DatosProgramaPage from '../features/admin/DatosProgramaPage.jsx'
import PresupuestoDashboard from '../features/admin/PresupuestoDashboard.jsx'
import UsuariosPage from '../features/admin/UsuariosPage.jsx'
import PerfilDocentePage from '../features/admin/PerfilDocentePage.jsx'
import RubricaGridEvaluador from '../features/ra/RubricaGridEvaluador.jsx'
import HistogramaRAChart from '../features/ra/HistogramaRAChart.jsx'
import FormularioAcuerdo058 from '../features/evalDocente/FormularioAcuerdo058.jsx'
import DocenteResultadoView from '../features/evalDocente/DocenteResultadoView.jsx'

function Inicio() {
  const { usuario } = useAuth()
  return <Navigate to={usuario ? INICIO_POR_ROL[usuario.rol] : '/login'} replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Inicio />} />

          <Route path="coordinacion" element={<ProtectedRoute roles={['coordinador']} />}>
            <Route index element={<EstadisticasDashboard />} />
            <Route path="datos" element={<DatosProgramaPage />} />
            <Route path="presupuesto" element={<PresupuestoDashboard />} />
            <Route path="usuarios" element={<UsuariosPage />} />
            <Route path="ra" element={<HistogramaRAChart />} />
            <Route path="evaluacion-coordinacion" element={<FormularioAcuerdo058 tipo="EC" />} />
          </Route>

          <Route path="docente" element={<ProtectedRoute roles={['docente']} />}>
            <Route index element={<DocenteDashboard />} />
            <Route path="perfil" element={<PerfilDocentePage />} />
            <Route path="datos" element={<DatosProgramaPage />} />
            <Route path="rubricas" element={<RubricaGridEvaluador />} />
            <Route path="autoevaluacion" element={<FormularioAcuerdo058 tipo="AE" />} />
            <Route path="resultados" element={<DocenteResultadoView />} />
          </Route>

          <Route path="estudiante" element={<ProtectedRoute roles={['estudiante']} />}>
            <Route index element={<EstudianteDashboard />} />
            <Route path="evaluacion" element={<FormularioAcuerdo058 tipo="EE" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
