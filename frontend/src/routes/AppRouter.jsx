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
import GestionAcademicaPage from '../features/admin/GestionAcademicaPage.jsx'
import PerfilDocentePage from '../features/admin/PerfilDocentePage.jsx'
import MiCuentaPage from '../features/auth/MiCuentaPage.jsx'
import MisCursosPage from '../features/ra/MisCursosPage.jsx'
import PlanillaRubricaPage from '../features/ra/PlanillaRubricaPage.jsx'
import ConsolidadoRAPage from '../features/ra/ConsolidadoRAPage.jsx'
import MatrizRubricasPage from '../features/ra/MatrizRubricasPage.jsx'
import AperturaCalificacionPage from '../features/ra/AperturaCalificacionPage.jsx'
import AnalisisRAPage from '../features/ra/AnalisisRAPage.jsx'
import MisEvaluacionesPage from '../features/evalDocente/MisEvaluacionesPage.jsx'
import HabilitacionEvaluacionPage from '../features/evalDocente/HabilitacionEvaluacionPage.jsx'
import FormulariosEvaluacionPage from '../features/evalDocente/FormulariosEvaluacionPage.jsx'
import ResultadosEvaluacionPage from '../features/evalDocente/ResultadosEvaluacionPage.jsx'
import MisResultadosEvaluacionPage from '../features/evalDocente/MisResultadosEvaluacionPage.jsx'

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
          {/* Mi cuenta: datos de la cuenta y cambio de contraseña, para todos los roles */}
          <Route path="cuenta" element={<MiCuentaPage />} />

          <Route path="coordinacion" element={<ProtectedRoute roles={['coordinador']} />}>
            <Route index element={<EstadisticasDashboard />} />
            <Route path="datos" element={<DatosProgramaPage />} />
            <Route path="presupuesto" element={<PresupuestoDashboard />} />
            <Route path="gestion" element={<GestionAcademicaPage />} />
            <Route path="gestion/cursos/:idCurso" element={<PlanillaRubricaPage soloLectura />} />
            {/* Rutas anteriores: Usuarios y Cursos y matrícula viven ahora en Gestión académica */}
            <Route path="usuarios" element={<Navigate to="/coordinacion/gestion" replace />} />
            <Route path="ra" element={<ConsolidadoRAPage />} />
            <Route path="ra/analisis" element={<AnalisisRAPage />} />
            <Route path="ra/rubricas" element={<MatrizRubricasPage />} />
            <Route path="ra/calificacion" element={<AperturaCalificacionPage />} />
            <Route path="ra/cursos" element={<Navigate to="/coordinacion/gestion?pestana=semestre" replace />} />
            <Route path="ra/cursos/:idCurso" element={<PlanillaRubricaPage soloLectura />} />
            {/* Módulo 3: evaluación docente (Acuerdo 058) */}
            <Route path="evaluacion" element={<HabilitacionEvaluacionPage />} />
            <Route path="evaluacion/formularios" element={<FormulariosEvaluacionPage />} />
            {/* Los estudiantes de pregrado se registran en Gestión académica › Usuarios (2026-11-24) */}
            <Route path="evaluacion/pregrado" element={<Navigate to="/coordinacion/gestion?pestana=usuarios&vista=pregrado" replace />} />
            <Route path="evaluacion/coordinacion" element={<MisEvaluacionesPage tipo="EC" />} />
            <Route path="evaluacion/resultados" element={<ResultadosEvaluacionPage />} />
            <Route path="evaluacion-coordinacion" element={<Navigate to="/coordinacion/evaluacion/coordinacion" replace />} />
          </Route>

          <Route path="docente" element={<ProtectedRoute roles={['docente']} />}>
            <Route index element={<DocenteDashboard />} />
            <Route path="perfil" element={<PerfilDocentePage />} />
            <Route path="datos" element={<DatosProgramaPage />} />
            <Route path="rubricas" element={<MisCursosPage />} />
            <Route path="rubricas/:idCurso" element={<PlanillaRubricaPage />} />
            <Route path="autoevaluacion" element={<MisEvaluacionesPage tipo="AE" />} />
            <Route path="resultados" element={<MisResultadosEvaluacionPage />} />
          </Route>

          <Route path="estudiante" element={<ProtectedRoute roles={['estudiante']} />}>
            <Route index element={<EstudianteDashboard />} />
            <Route path="evaluacion" element={<MisEvaluacionesPage tipo="EE" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
