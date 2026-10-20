// Acceso a datos (PostgreSQL) — RF-ADM-06 — Perfil del docente y cursos en los que participa
// Tablas: docentes_perfil, usuarios, curso_docentes, cursos, clases, cursos_catalogo, modulos_curriculares, cohortes
// (el CRUD de Coordinación usa el recurso genérico "docentes")
const db = require('../../../config/db');
const { SEMESTRE_REAL } = require('../reportes/reflejo');

// Campos que el propio docente puede mantener; nombre y afiliación los administra Coordinación.
// Los cursos y componentes no se escriben: salen de sus asignaciones.
const CAMPOS_EDITABLES = [
  'formacion_profesional',
  'campo_formacion',
  'enlace_perfil',
  'titulacion_maxima',
  'linea_investigacion',
];

const SELECT_PERFIL = `
  SELECT d.id_docente, d.id_usuario, d.nombre_completo, d.afiliacion,
         ${CAMPOS_EDITABLES.map((c) => `d.${c}`).join(', ')},
         u.identificacion, u.email, COALESCE(u.debe_cambiar_password, FALSE) AS debe_cambiar_password
  FROM docentes_perfil d LEFT JOIN usuarios u ON u.id_usuario = d.id_usuario`;

const findByUsuario = async (idUsuario) =>
  (await db.query(`${SELECT_PERFIL} WHERE d.id_usuario = $1`, [idUsuario])).rows[0] ?? null;

const findById = async (idDocente) =>
  (await db.query(`${SELECT_PERFIL} WHERE d.id_docente = $1`, [idDocente])).rows[0] ?? null;

// Actualiza solo los campos enviados (un PUT parcial no borra los demás).
const updateByUsuario = async (idUsuario, datos) => {
  const enviados = CAMPOS_EDITABLES.filter((c) => datos[c] !== undefined);
  if (enviados.length) {
    await db.query(
      `UPDATE docentes_perfil SET ${enviados.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id_usuario = $1`,
      [idUsuario, ...enviados.map((c) => datos[c])],
    );
  }
  return findByUsuario(idUsuario);
};

// Ofertas en las que participa el docente, con el semestre de la promoción en que se dictaron.
const SELECT_CURSOS = `
  SELECT c.id_curso, c.id_cohorte, h.nombre AS cohorte, c.periodo, ${SEMESTRE_REAL} AS semestre,
         c.id_clase, cl.codigo AS clase_codigo, cl.nombre AS clase, m.id_modulo, m.nombre AS componente,
         (SELECT COUNT(*)::int FROM curso_docentes x WHERE x.id_curso = c.id_curso) AS docentes
  FROM curso_docentes cd
  JOIN cursos c ON c.id_curso = cd.id_curso
  JOIN cohortes h ON h.id_cohorte = c.id_cohorte
  JOIN clases cl ON cl.id_clase = c.id_clase
  JOIN cursos_catalogo k ON k.id_catalogo = c.id_catalogo
  JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo`;

const cursosDe = async (idDocente) =>
  (await db.query(
    `${SELECT_CURSOS} WHERE cd.id_docente = $1 ORDER BY c.periodo DESC, h.periodo_inicio, cl.nombre`,
    [idDocente],
  )).rows;

const cohorte = async (idCohorte) =>
  (await db.query('SELECT id_cohorte, nombre, periodo_inicio, periodo_fin FROM cohortes WHERE id_cohorte = $1', [idCohorte]))
    .rows[0] ?? null;

const clase = async (idClase) =>
  (await db.query('SELECT id_clase, id_catalogo, nombre FROM clases WHERE id_clase = $1', [idClase])).rows[0] ?? null;

// Agrega al docente a la oferta (promoción, periodo, clase); la crea si aún no existe (grupo 1).
const agregarCurso = (idDocente, { id_cohorte, periodo, id_clase }) =>
  db.withTransaction(async (cliente) => {
    let idCurso = (await cliente.query(
      'SELECT id_curso FROM cursos WHERE id_clase = $1 AND id_cohorte = $2 AND periodo = $3 ORDER BY grupo LIMIT 1',
      [id_clase, id_cohorte, periodo],
    )).rows[0]?.id_curso;
    if (!idCurso) {
      idCurso = (await cliente.query(
        `INSERT INTO cursos (id_clase, id_catalogo, id_cohorte, periodo)
         SELECT id_clase, id_catalogo, $2, $3 FROM clases WHERE id_clase = $1 RETURNING id_curso`,
        [id_clase, id_cohorte, periodo],
      )).rows[0].id_curso;
    }
    await cliente.query(
      'INSERT INTO curso_docentes (id_curso, id_docente) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [idCurso, idDocente],
    );
    return idCurso;
  });

// Quita al docente de la oferta; si queda vacía (sin docentes, estudiantes ni notas) se elimina,
// para que no cuente como curso dictado.
const quitarCurso = (idDocente, idCurso) =>
  db.withTransaction(async (cliente) => {
    const { rowCount } = await cliente.query(
      'DELETE FROM curso_docentes WHERE id_curso = $1 AND id_docente = $2',
      [idCurso, idDocente],
    );
    if (rowCount) {
      await cliente.query(
        `DELETE FROM cursos c WHERE c.id_curso = $1
           AND NOT EXISTS (SELECT 1 FROM curso_docentes x WHERE x.id_curso = c.id_curso)
           AND NOT EXISTS (SELECT 1 FROM curso_estudiantes x WHERE x.id_curso = c.id_curso)
           AND NOT EXISTS (SELECT 1 FROM evaluaciones_ra_estudiante x WHERE x.id_curso = c.id_curso)`,
        [idCurso],
      );
    }
    return rowCount > 0;
  });

module.exports = {
  CAMPOS_EDITABLES,
  findByUsuario,
  findById,
  updateByUsuario,
  cursosDe,
  cohorte,
  clase,
  agregarCurso,
  quitarCurso,
};
