// Ruta de inicio y menú lateral por rol (matriz RBAC del Documento Técnico 2).
export const INICIO_POR_ROL = {
  coordinador: '/coordinacion',
  // Sin panel para docentes y estudiantes (2026-11-25): entran a su primera opción del menú.
  docente: '/docente/perfil',
  estudiante: '/estudiante/evaluacion',
}

// El menú se agrupa por módulo, como en el mockup del coordinador. Un grupo sin
// `grupo` no lleva encabezado (el enlace al panel va suelto arriba de todo).
// `icono` es el nombre del glifo en Material Symbols Outlined.
export const MENU_POR_ROL = {
  coordinador: [
    {
      items: [
        { to: '/coordinacion', label: 'Panel general', icono: 'space_dashboard', end: true },
        // Sin «Mi cuenta» en el menú (2026-11-25): los datos se editan en Gestión académica › Usuarios; la
        // contraseña propia se cambia desde el nombre en la barra superior.
      ],
    },
    {
      grupo: 'Procesos administrativos',
      icono: 'domain',
      items: [
        { to: '/coordinacion/datos', label: 'Información académica', icono: 'groups' },
        { to: '/coordinacion/presupuesto', label: 'Presupuesto y finanzas', icono: 'account_balance_wallet' },
        { to: '/coordinacion/gestion', label: 'Gestión académica', icono: 'school' },
      ],
    },
    {
      grupo: 'Resultados de aprendizaje',
      icono: 'fact_check',
      items: [
        { to: '/coordinacion/ra', label: 'Consolidado académico', icono: 'analytics', end: true },
        { to: '/coordinacion/ra/analisis', label: 'Análisis del programa', icono: 'insights' },
        { to: '/coordinacion/ra/rubricas', label: 'Matriz de rúbricas', icono: 'rule' },
        { to: '/coordinacion/ra/calificacion', label: 'Apertura de calificación', icono: 'lock_clock' },
      ],
    },
    {
      grupo: 'Evaluación docente',
      icono: 'rate_review',
      items: [
        { to: '/coordinacion/evaluacion', label: 'Habilitación y seguimiento', icono: 'event_available', end: true },
        { to: '/coordinacion/evaluacion/formularios', label: 'Formularios', icono: 'quiz' },
        { to: '/coordinacion/evaluacion/coordinacion', label: 'Evaluación al docente (EC)', icono: 'assignment_ind' },
        { to: '/coordinacion/evaluacion/resultados', label: 'Resultados de desempeño', icono: 'insights' },
      ],
    },
  ],
  docente: [
    {
      items: [
        { to: '/docente/perfil', label: 'Mi perfil', icono: 'badge' },
      ],
    },
    {
      grupo: 'Resultados de aprendizaje',
      icono: 'fact_check',
      items: [{ to: '/docente/rubricas', label: 'Mis cursos: calificar rúbricas', icono: 'rule' }],
    },
    {
      grupo: 'Evaluación docente',
      icono: 'rate_review',
      items: [
        { to: '/docente/autoevaluacion', label: 'Autoevaluación (AE)', icono: 'assignment_ind' },
        { to: '/docente/resultados', label: 'Mis resultados', icono: 'insights' },
      ],
    },
  ],
  estudiante: [
    {
      items: [
        { to: '/cuenta', label: 'Mi cuenta', icono: 'key' },
      ],
    },
    {
      grupo: 'Evaluación docente',
      icono: 'rate_review',
      items: [{ to: '/estudiante/evaluacion', label: 'Evaluar docentes (EE)', icono: 'assignment_ind' }],
    },
  ],
}

export const ETIQUETA_ROL = {
  coordinador: 'Coordinador',
  docente: 'Docente',
  estudiante: 'Estudiante',
}
