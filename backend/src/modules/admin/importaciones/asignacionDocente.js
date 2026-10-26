// Hoja «Asignación docente» de la plantilla (reunión de avances del 20-oct-2026): qué docente dictó qué
// curso, en qué promoción, semestre y componente. Cada fila crea o reutiliza la oferta de la clase en el
// semestre académico de la promoción (cursos) y le asigna el docente (curso_docentes); de ahí salen la
// hoja «Cursos y docentes por semestre» (reflejo.js), los cursos de cada docente y, en los módulos 2 y 3,
// la asignación de rúbricas y de la evaluación docente. Volver a importar no duplica.
const db = require('../../../config/db');
const { SEMESTRE_REAL } = require('../reportes/reflejo');
const { normalizar } = require('./excel.util');

// Misma forma que un recurso de recursos.definicion.js para reutilizar la plantilla y su lector.
// `options` del componente se completa con los componentes curriculares de la base de datos.
const ASIGNACION = {
  id: 'asignacion-docente',
  titulo: 'Asignación docente por promoción y semestre',
  hoja: 'Asignación docente',
  requisito: 'RF-ADM-06',
  campos: [
    { name: 'id_cohorte', label: 'Promoción', type: 'cohorte', required: true },
    { name: 'semestre', label: 'Semestre de la promoción', type: 'semestre', required: true },
    { name: 'docente', label: 'Docente', type: 'docente', required: true },
    { name: 'componente', label: 'Componente', type: 'enum', options: [] },
    { name: 'curso', label: 'Curso (código o nombre de la clase)', type: 'texto', required: true },
  ],
};

// Semestre académico del semestre n de una promoción: el I es su periodo de inicio (2021-A → II = 2021-B).
const periodoDelSemestre = (inicio, semestre) => {
  const v = Number(inicio.slice(0, 4)) * 2 + (inicio.endsWith('B') ? 1 : 0) + semestre - 1;
  return `${Math.floor(v / 2)}-${v % 2 ? 'B' : 'A'}`;
};

const componentes = async () => (await db.query('SELECT nombre FROM modulos_curriculares ORDER BY id_modulo')).rows.map((r) => r.nombre);

// Definición con los componentes vigentes, para la plantilla.
const definicion = async () => {
  const options = await componentes();
  return { ...ASIGNACION, campos: ASIGNACION.campos.map((c) => (c.name === 'componente' ? { ...c, options } : c)) };
};

// Filas actuales (exportación a Excel): una por docente de cada oferta.
const listar = async () =>
  (await db.query(`
    SELECT h.nombre AS cohorte, ${SEMESTRE_REAL} AS semestre, d.nombre_completo AS docente,
           m.nombre AS componente, cl.codigo AS curso
    FROM cursos c
    JOIN cohortes h ON h.id_cohorte = c.id_cohorte
    JOIN clases cl ON cl.id_clase = c.id_clase
    JOIN cursos_catalogo k ON k.id_catalogo = c.id_catalogo
    JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo
    JOIN curso_docentes cd ON cd.id_curso = c.id_curso
    JOIN docentes_perfil d ON d.id_docente = cd.id_docente
    ORDER BY h.periodo_inicio, h.nombre, semestre, cl.codigo, d.nombre_completo`)).rows;

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Guarda las filas leídas de la hoja dentro de la transacción de la importación. Se llama después de
// guardar las demás hojas, así que las promociones y docentes del mismo archivo ya existen.
// Los errores se acumulan en `errores` y las advertencias en `advertencias` ({ hoja, fila, mensaje }).
const guardar = async (cliente, filas, errores, advertencias) => {
  const cuenta = { hoja: ASIGNACION.hoja, filas: filas.length, insertados: 0, actualizados: 0 };
  const consulta = async (sql) => (await cliente.query(sql)).rows;
  const [cohortes, docentes, clases] = await Promise.all([
    consulta('SELECT id_cohorte, nombre, periodo_inicio FROM cohortes'),
    consulta('SELECT id_docente, nombre_completo FROM docentes_perfil'),
    consulta(`SELECT cl.id_clase, cl.id_catalogo, cl.codigo, cl.nombre, m.nombre AS componente
              FROM clases cl JOIN cursos_catalogo k ON k.id_catalogo = cl.id_catalogo
              JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo`),
  ]);
  const cohortePor = new Map(cohortes.map((c) => [normalizar(c.nombre), c]));
  const docentePor = new Map(docentes.map((d) => [normalizar(d.nombre_completo), d]));
  const clasePor = new Map(clases.flatMap((c) => [[normalizar(c.codigo), c], [normalizar(c.nombre), c]]));

  for (const { fila, hoja, promocion, valores } of filas) {
    const error = (mensaje) => errores.push({ hoja, fila, mensaje });
    const cohorte = cohortePor.get(normalizar(promocion));
    const semestre = Number(valores.semestre);
    const docente = docentePor.get(normalizar(valores.docente));
    const clase = clasePor.get(normalizar(valores.curso));
    if (!cohorte) {
      error(`La promoción "${texto(promocion)}" no existe en "Promociones y Estudiantes"`);
      continue;
    }
    if (!Number.isInteger(semestre) || semestre < 1 || semestre > 4) {
      error(`Semestre de la promoción "${texto(valores.semestre)}" no válido (1 a 4)`);
      continue;
    }
    if (!docente) {
      error(`El docente "${texto(valores.docente)}" no está en "Docentes UDENAR-EXTERNOS"`);
      continue;
    }
    if (!clase) {
      error(`El curso "${texto(valores.curso)}" no corresponde a ninguna clase (Gestión académica › Clases)`);
      continue;
    }
    // El componente lo fija el curso del plan que cubre la clase; la columna solo se contrasta.
    if (texto(valores.componente) && normalizar(valores.componente) !== normalizar(clase.componente)) {
      advertencias.push({
        hoja, fila,
        mensaje: `${clase.codigo} · ${clase.nombre} es del componente ${clase.componente}; se ignoró "${texto(valores.componente)}".`,
      });
    }

    const periodo = periodoDelSemestre(cohorte.periodo_inicio, semestre);
    const { rows: [oferta] } = await cliente.query(
      `INSERT INTO cursos (id_clase, id_catalogo, id_cohorte, periodo) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_clase, id_cohorte, periodo, grupo) DO UPDATE SET periodo = EXCLUDED.periodo
       RETURNING id_curso`,
      [clase.id_clase, clase.id_catalogo, cohorte.id_cohorte, periodo],
    );
    const { rowCount } = await cliente.query(
      'INSERT INTO curso_docentes (id_curso, id_docente) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [oferta.id_curso, docente.id_docente],
    );
    if (rowCount) cuenta.insertados++;
    else cuenta.actualizados++;
  }
  return cuenta;
};

module.exports = { ASIGNACION, HOJA: ASIGNACION, definicion, listar, guardar, periodoDelSemestre };
