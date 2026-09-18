// Ruta de inicio y menú lateral por rol (matriz RBAC del Documento Técnico 2).
export const INICIO_POR_ROL = {
  coordinador: '/coordinacion',
  docente: '/docente',
  estudiante: '/estudiante',
}

export const MENU_POR_ROL = {
  coordinador: [
    { to: '/coordinacion', label: 'Estadísticas', end: true },
    { to: '/coordinacion/datos', label: 'Datos del programa' },
    { to: '/coordinacion/presupuesto', label: 'Presupuesto' },
    { to: '/coordinacion/usuarios', label: 'Usuarios' },
    { to: '/coordinacion/ra', label: 'Resultados de aprendizaje' },
    { to: '/coordinacion/evaluacion-coordinacion', label: 'Evaluación (EC)' },
  ],
  docente: [
    { to: '/docente', label: 'Panel', end: true },
    { to: '/docente/perfil', label: 'Mi perfil' },
    { to: '/docente/datos', label: 'Datos del programa' },
    { to: '/docente/rubricas', label: 'Calificar rúbricas' },
    { to: '/docente/autoevaluacion', label: 'Autoevaluación (AE)' },
    { to: '/docente/resultados', label: 'Mis resultados' },
  ],
  estudiante: [
    { to: '/estudiante', label: 'Panel', end: true },
    { to: '/estudiante/evaluacion', label: 'Evaluar docentes (EE)' },
  ],
}
