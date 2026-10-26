// Recursos tabulares del Módulo 1 (Procesos Administrativos), uno por hoja de "Estadísticas MaIE".
// Esta definición alimenta: API CRUD, validación, plantilla .xlsx, importación y las tablas del frontend.
//
// - llave: columnas que identifican el registro en la URL (/:k1/:k2)
// - campos: columnas editables, en el orden de la plantilla; la llave serial/uuid no se incluye
// - conflicto: restricción única usada al importar (por defecto, la llave)
// - rolesLectura / rolesEscritura: RBAC. Toda información financiera es solo de Coordinación (RNF-SEG-01).
// - nota: aviso que el frontend muestra sobre la tabla
// - reflejados: columnas que, en las promociones con registros en Gestión académica, se calculan desde ahí
//   (reportes/reflejo.js) y por eso no se editan en esas filas
// - calculados: columnas de solo lectura que se derivan de otras tablas ({ name, label, sql } con alias t).
const { ROLES } = require('../../../utils/roles');

const { COORDINADOR, DOCENTE } = ROLES;
const SOLO_COORD = [COORDINADOR];
const ACADEMICO = [COORDINADOR, DOCENTE];

const cohorte = { name: 'id_cohorte', label: 'Promoción', type: 'cohorte', required: true };
// Tipos de producto en el orden de las columnas de «Producción científica» (reflejo.js).
const TIPOS_PRODUCTO = ['Artículo', 'Ponencia', 'Software', 'Prototipo', 'Tesis'];
const ORDEN_COHORTE = 'c.periodo_inicio, c.nombre';

const RECURSOS = [
  {
    id: 'cohortes',
    titulo: 'Promociones y estudiantes',
    hoja: 'Promociones y Estudiantes',
    requisito: 'RF-ADM-01',
    tabla: 'cohortes',
    categoria: 'academico',
    llave: ['id_cohorte'],
    conflicto: ['nombre'],
    ordenarPor: 't.periodo_inicio, t.nombre',
    reflejados: ['inscritos', 'matriculados', 'egresados', 'graduados'],
    rolesLectura: ACADEMICO,
    rolesEscritura: SOLO_COORD,
    campos: [
      { name: 'nombre', label: 'Promoción', type: 'texto', required: true },
      { name: 'periodo_inicio', label: 'Inicio', type: 'periodo', required: true },
      { name: 'periodo_fin', label: 'Fin', type: 'periodo', required: true },
      { name: 'inscritos', label: 'Inscritos al I semestre', type: 'entero', required: true },
      { name: 'matriculados', label: 'Matriculados al I semestre', type: 'entero', required: true },
      { name: 'aprobados_sem1', label: 'Aprobaron I semestre', type: 'entero' },
      { name: 'aprobados_sem2', label: 'Aprobaron II semestre', type: 'entero' },
      { name: 'aprobados_sem3', label: 'Aprobaron III semestre', type: 'entero' },
      { name: 'egresados', label: 'Aprobaron IV semestre (egresados)', type: 'entero' },
      { name: 'graduados', label: 'Graduados', type: 'entero', required: true },
    ],
  },
  {
    id: 'punto-equilibrio',
    titulo: 'Punto de equilibrio',
    hoja: 'Punto de equilibrio',
    requisito: 'RF-ADM-03',
    tabla: 'cohorte_punto_equilibrio',
    categoria: 'financiero',
    llave: ['id_cohorte'],
    unirCohorte: true,
    ordenarPor: ORDEN_COHORTE,
    rolesLectura: SOLO_COORD,
    rolesEscritura: SOLO_COORD,
    campos: [
      cohorte,
      { name: 'estudiantes_equilibrio', label: 'Estudiantes del punto de equilibrio', type: 'entero', required: true },
      { name: 'valor_matricula_smmlv', label: 'Valor matrícula semestral (SMMLV)', type: 'numero', required: true },
      { name: 'ingresos_proyectados', label: 'Ingresos/gastos proyectados (COP)', type: 'dinero', required: true },
    ],
  },
  {
    id: 'cohorte-semestres',
    titulo: 'Cursos y docentes por semestre',
    hoja: 'Cursos y Docentes',
    requisito: 'RF-ADM-01',
    tabla: 'cohorte_semestres',
    categoria: 'academico',
    llave: ['id_cohorte', 'semestre'],
    unirCohorte: true,
    ordenarPor: `${ORDEN_COHORTE}, t.semestre`,
    rolesLectura: ACADEMICO,
    // Nadie la edita: se calcula de los cursos asignados a los docentes (reflejo.js); las filas
    // guardadas son el histórico del libro para promociones sin cursos registrados.
    rolesEscritura: [],
    nota: 'Se calcula sola con los cursos que registran los docentes (Mi perfil) o Coordinación por ellos. '
      + 'Los semestres sin cursos registrados muestran el histórico del libro «Estadísticas MaIE».',
    campos: [
      cohorte,
      { name: 'semestre', label: 'Semestre', type: 'semestre', required: true },
      { name: 'n_cursos', label: 'N.° cursos', type: 'entero', required: true },
      { name: 'docentes_udenar', label: 'Docentes invitados UDENAR', type: 'entero', required: true },
      { name: 'docentes_externos', label: 'Docentes invitados externos', type: 'entero', required: true },
    ],
  },
  {
    id: 'docentes',
    titulo: 'Docentes',
    hoja: 'Docentes UDENAR-EXTERNOS',
    requisito: 'RF-ADM-06',
    tabla: 'docentes_perfil',
    categoria: 'academico',
    llave: ['id_docente'],
    conflicto: ['nombre_completo'],
    ordenarPor: 't.afiliacion DESC, t.nombre_completo',
    rolesLectura: ACADEMICO,
    rolesEscritura: SOLO_COORD,
    campos: [
      { name: 'nombre_completo', label: 'Docente', type: 'texto', required: true },
      { name: 'formacion_profesional', label: 'Formación profesional', type: 'texto', multilinea: true },
      { name: 'campo_formacion', label: 'Campo de formación', type: 'texto' },
      { name: 'afiliacion', label: 'Afiliación', type: 'enum', options: ['UDENAR', 'EXTERNO'], required: true },
      { name: 'enlace_perfil', label: 'Enlace a perfil', type: 'texto' },
    ],
    // Cursos y componentes salen de las asignaciones del docente (curso_docentes).
    calculados: [
      {
        name: 'cursos_asignados',
        label: 'Cursos en los que participa',
        sql: `(SELECT string_agg(DISTINCT cl.nombre, ', ' ORDER BY cl.nombre)
               FROM curso_docentes cd JOIN cursos o ON o.id_curso = cd.id_curso JOIN clases cl ON cl.id_clase = o.id_clase
               WHERE cd.id_docente = t.id_docente)`,
      },
      {
        name: 'componentes_apoya',
        label: 'Componentes de formación que apoya',
        sql: `(SELECT string_agg(DISTINCT m.nombre, ', ' ORDER BY m.nombre)
               FROM curso_docentes cd JOIN cursos o ON o.id_curso = cd.id_curso
               JOIN cursos_catalogo k ON k.id_catalogo = o.id_catalogo JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo
               WHERE cd.id_docente = t.id_docente)`,
      },
    ],
  },
  {
    id: 'presupuesto',
    titulo: 'Presupuesto por promoción',
    hoja: 'Presupuesto',
    requisito: 'RF-ADM-03',
    tabla: 'presupuesto_cohorte',
    categoria: 'financiero',
    llave: ['id_presupuesto'],
    conflicto: ['id_cohorte', 'fecha_corte'],
    unirCohorte: true,
    ordenarPor: `t.fecha_corte DESC, ${ORDEN_COHORTE}`,
    rolesLectura: SOLO_COORD,
    rolesEscritura: SOLO_COORD,
    campos: [
      cohorte,
      { name: 'fecha_corte', label: 'Fecha de corte', type: 'fecha', required: true },
      { name: 'ingresos', label: 'Ingresos', type: 'dinero', required: true },
      { name: 'gastos_comprometidos', label: 'Gastos (comprometido)', type: 'dinero', required: true },
      { name: 'saldo_certificado', label: 'Saldo certificado Oficina de Presupuesto', type: 'dinero' },
      { name: 'transferencia_central', label: 'Transferencias Central', type: 'dinero' },
      { name: 'transferencia_viis', label: 'Transferencias VIIS', type: 'dinero' },
      { name: 'fondo_investigaciones', label: 'Fondo de Investigaciones', type: 'dinero' },
      { name: 'unidad_academica', label: 'Unidad Académica', type: 'dinero' },
      { name: 'observaciones', label: 'Observaciones', type: 'texto', multilinea: true },
    ],
  },
  {
    id: 'pregrado',
    titulo: 'Estudiantes de pregrado',
    hoja: 'Estudiantes Pregrado',
    requisito: 'RF-ADM-01',
    tabla: 'pregrado_periodo',
    categoria: 'financiero',
    llave: ['id_cohorte', 'periodo'],
    unirCohorte: true,
    ordenarPor: `${ORDEN_COHORTE}, t.periodo`,
    rolesLectura: SOLO_COORD,
    rolesEscritura: SOLO_COORD,
    campos: [
      cohorte,
      { name: 'periodo', label: 'Periodo', type: 'periodo', required: true },
      { name: 'estudiantes', label: 'Estudiantes', type: 'entero', required: true },
      { name: 'inscripciones', label: 'Total inscripciones', type: 'entero', required: true },
      { name: 'ingreso', label: 'Ingreso (COP)', type: 'dinero', required: true },
    ],
  },
  {
    id: 'transferencias',
    titulo: 'Transferencias Vicerrectoría Académica',
    hoja: 'Transferencias ViceAcad',
    requisito: 'RF-ADM-03',
    tabla: 'transferencias_periodo',
    categoria: 'financiero',
    llave: ['periodo'],
    ordenarPor: 't.periodo',
    rolesLectura: SOLO_COORD,
    rolesEscritura: SOLO_COORD,
    campos: [
      { name: 'periodo', label: 'Periodo', type: 'periodo', required: true },
      { name: 'promociones', label: 'Promociones', type: 'texto' },
      { name: 'n_docentes', label: 'N.° docentes', type: 'entero', required: true },
      { name: 'valor', label: 'Valor transferido', type: 'dinero', required: true },
    ],
  },
  {
    id: 'contrataciones',
    titulo: 'Contrataciones OPS',
    hoja: 'Contrataciones',
    requisito: 'RF-ADM-03',
    tabla: 'contrataciones_periodo',
    categoria: 'financiero',
    llave: ['periodo'],
    ordenarPor: 't.periodo',
    rolesLectura: SOLO_COORD,
    rolesEscritura: SOLO_COORD,
    campos: [
      { name: 'periodo', label: 'Periodo', type: 'periodo', required: true },
      { name: 'promociones', label: 'Promociones', type: 'texto' },
      { name: 'n_ops', label: 'N.° OPS', type: 'entero', required: true },
      { name: 'valor', label: 'Valor OPS', type: 'dinero', required: true },
    ],
  },
  {
    id: 'beneficios',
    titulo: 'Beneficios',
    hoja: 'Beneficios',
    requisito: 'RF-ADM-01',
    tabla: 'cohorte_beneficios',
    categoria: 'academico',
    llave: ['id_cohorte'],
    unirCohorte: true,
    ordenarPor: ORDEN_COHORTE,
    reflejados: ['becas_100', 'becas_hora_catedra', 'becas_sintraunicol'],
    rolesLectura: ACADEMICO,
    rolesEscritura: SOLO_COORD,
    campos: [
      cohorte,
      { name: 'becas_100', label: 'Becas 100%', type: 'entero', required: true },
      { name: 'becas_hora_catedra', label: 'Becas docentes hora cátedra UDENAR', type: 'entero', required: true },
      { name: 'becas_sintraunicol', label: 'Becas SINTRAUNICOL', type: 'entero', required: true },
      { name: 'asistentes_investigacion', label: 'Asistentes de investigación', type: 'entero', required: true },
      { name: 'ayudantes_docencia', label: 'Ayudantes de docencia', type: 'entero', required: true },
    ],
  },
  {
    id: 'produccion',
    titulo: 'Producción científica',
    hoja: 'Producción Científica',
    requisito: 'RF-ADM-04',
    tabla: 'cohorte_produccion',
    categoria: 'academico',
    llave: ['id_cohorte'],
    unirCohorte: true,
    ordenarPor: ORDEN_COHORTE,
    rolesLectura: ACADEMICO,
    rolesEscritura: SOLO_COORD,
    reflejados: ['articulos', 'ponencias', 'software', 'prototipos', 'tesis', 'detalles'],
    campos: [
      cohorte,
      { name: 'articulos', label: 'Artículos', type: 'entero', required: true },
      { name: 'ponencias', label: 'Ponencias', type: 'entero', required: true },
      { name: 'software', label: 'Software', type: 'entero', required: true },
      { name: 'prototipos', label: 'Prototipos', type: 'entero', required: true },
      { name: 'tesis', label: 'Tesis', type: 'entero', required: true },
      { name: 'detalles', label: 'Detalles (lista de productos)', type: 'texto', multilinea: true },
    ],
  },
  {
    // Un registro por producto (reunión de avances del 20-oct-2026); reflejo.js deriva de aquí los conteos
    // de «Producción científica» de cada promoción con productos registrados.
    id: 'productos',
    titulo: 'Productos de investigación',
    hoja: 'Productos de investigación',
    requisito: 'RF-ADM-04',
    tabla: 'productos_investigacion',
    categoria: 'academico',
    llave: ['id_producto'],
    conflicto: ['id_cohorte', 'tipo', 'cita'],
    unirCohorte: true,
    ordenarPor: `${ORDEN_COHORTE}, t.tipo, t.anio, t.cita`,
    rolesLectura: ACADEMICO,
    rolesEscritura: SOLO_COORD,
    campos: [
      cohorte,
      { name: 'tipo', label: 'Tipo de producto', type: 'enum', options: TIPOS_PRODUCTO, required: true },
      { name: 'cita', label: 'Cita bibliográfica', type: 'texto', multilinea: true, mostrarEnTabla: true, required: true },
      { name: 'anio', label: 'Año', type: 'entero' },
      { name: 'estudiantes', label: 'Estudiantes participantes', type: 'texto' },
      { name: 'enlace', label: 'Enlace (DOI o URL)', type: 'texto' },
    ],
  },
  {
    id: 'pasantias',
    titulo: 'Pasantías',
    hoja: 'Pasantías',
    requisito: 'RF-ADM-04',
    tabla: 'cohorte_pasantias',
    categoria: 'academico',
    llave: ['id_cohorte'],
    unirCohorte: true,
    ordenarPor: ORDEN_COHORTE,
    rolesLectura: ACADEMICO,
    rolesEscritura: SOLO_COORD,
    campos: [
      cohorte,
      { name: 'nacionales', label: 'Pasantías nacionales', type: 'entero', required: true },
      { name: 'internacionales', label: 'Pasantías internacionales', type: 'entero', required: true },
    ],
  },
  {
    id: 'parametros',
    titulo: 'Parámetros del programa',
    hoja: 'Parámetros',
    requisito: 'RF-ADM-05',
    tabla: 'parametros_programa',
    categoria: 'financiero',
    llave: ['clave'],
    ordenarPor: 't.clave',
    rolesLectura: SOLO_COORD,
    rolesEscritura: SOLO_COORD,
    campos: [
      { name: 'clave', label: 'Clave', type: 'texto', required: true },
      { name: 'valor', label: 'Valor', type: 'numero', required: true },
      { name: 'descripcion', label: 'Descripción', type: 'texto' },
    ],
  },
];

const porId = Object.fromEntries(RECURSOS.map((r) => [r.id, r]));

// Metadatos que se exponen al frontend (sin nombres de tablas ni SQL).
const metadatos = (rol) =>
  RECURSOS.filter((r) => r.rolesLectura.includes(rol)).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    hoja: r.hoja,
    requisito: r.requisito,
    llave: r.llave,
    editable: r.rolesEscritura.includes(rol),
    campos: [...r.campos, ...(r.calculados ?? []).map(({ name, label }) => ({ name, label, type: 'texto', calculado: true }))],
    categoria: r.categoria,
    reflejados: r.reflejados ?? [],
    nota: r.nota,
  }));

module.exports = { RECURSOS, porId, metadatos, TIPOS_PRODUCTO };
