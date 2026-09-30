// Ruta de inicio y menú lateral por rol (matriz RBAC del Documento Técnico 2).
export const INICIO_POR_ROL = {
  coordinador: '/coordinacion',
  docente: '/docente',
  estudiante: '/estudiante',
}

// El menú se agrupa por módulo, como en el mockup del coordinador. Un grupo sin
// `grupo` no lleva encabezado (el enlace al panel va suelto arriba de todo).
// `icono` es el nombre del glifo en Material Symbols Outlined.
export const MENU_POR_ROL = {
  coordinador: [
    {
      items: [{ to: '/coordinacion', label: 'Panel general', icono: 'space_dashboard', end: true }],
    },
    {
      grupo: 'Procesos administrativos',
      icono: 'domain',
      items: [
        { to: '/coordinacion/datos', label: 'Información académica', icono: 'groups' },
        { to: '/coordinacion/presupuesto', label: 'Presupuesto y finanzas', icono: 'account_balance_wallet' },
        { to: '/coordinacion/usuarios', label: 'Usuarios', icono: 'manage_accounts' },
      ],
    },
    {
      grupo: 'Resultados de aprendizaje',
      icono: 'fact_check',
      items: [
        { to: '/coordinacion/ra', label: 'Consolidado académico', icono: 'analytics', end: true },
        { to: '/coordinacion/ra/rubricas', label: 'Matriz de rúbricas', icono: 'rule' },
        { to: '/coordinacion/ra/cursos', label: 'Cursos y matrícula', icono: 'menu_book' },
      ],
    },
    {
      grupo: 'Evaluación docente',
      icono: 'rate_review',
      items: [{ to: '/coordinacion/evaluacion-coordinacion', label: 'Evaluación (EC)', icono: 'assignment_ind' }],
    },
  ],
  docente: [
    {
      items: [
        { to: '/docente', label: 'Panel', icono: 'space_dashboard', end: true },
        { to: '/docente/perfil', label: 'Mi perfil', icono: 'badge' },
      ],
    },
    {
      grupo: 'Procesos administrativos',
      icono: 'domain',
      items: [{ to: '/docente/datos', label: 'Información académica', icono: 'groups' }],
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
      items: [{ to: '/estudiante', label: 'Panel', icono: 'space_dashboard', end: true }],
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
