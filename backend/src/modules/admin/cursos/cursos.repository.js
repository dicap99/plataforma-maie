// Acceso a datos (PostgreSQL) — RF-ADM-01 / RF-RA-02 — Catálogo de cursos y ofertas por promoción
// Tablas: cursos_catalogo, catalogo_ra, catalogo_ra_estrategias, cursos (oferta), curso_docentes,
// curso_estudiantes, cohorte_estudiantes
const db = require('../../../config/db');

const listCatalogo = async () =>
  (await db.query(`
    SELECT k.id_catalogo, k.codigo, k.nombre, k.semestre, k.orden, m.id_modulo, m.nombre AS modulo,
           COALESCE((
             SELECT json_agg(json_build_object(
                      'id_ra', r.id_ra, 'codigo', r.codigo, 'nivel_dominio', cr.nivel_dominio,
                      'estrategias', (SELECT json_agg(e.codigo ORDER BY e.codigo)
                                      FROM catalogo_ra_estrategias ce
                                      JOIN estrategias_evaluacion e USING (id_estrategia)
                                      WHERE ce.id_catalogo = cr.id_catalogo AND ce.id_ra = cr.id_ra))
                    ORDER BY r.id_ra)
             FROM catalogo_ra cr JOIN resultados_aprendizaje r USING (id_ra)
             WHERE cr.id_catalogo = k.id_catalogo), '[]') AS ras
    FROM cursos_catalogo k
    JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo
    ORDER BY k.orden`)).rows;

// Oferta con catálogo, promoción, docentes, RA evaluados y avance de la calificación.
const SELECT_OFERTA = `
  SELECT c.id_curso, c.id_catalogo, k.codigo, k.nombre AS nombre_catalogo, c.nombre AS nombre_oferta,
         COALESCE(c.nombre, k.nombre) AS nombre, c.id_cohorte, h.nombre AS cohorte, c.periodo, c.grupo,
         k.semestre, m.nombre AS modulo,
         COALESCE((SELECT p.abierto FROM periodos_calificacion_ra p WHERE p.periodo = c.periodo), FALSE)
           AS calificacion_abierta,
         COALESCE((SELECT json_agg(json_build_object('id_usuario', u.id_usuario,
                                                     'nombre', u.nombres || ' ' || u.apellidos)
                                   ORDER BY u.apellidos, u.nombres)
                   FROM curso_docentes cd JOIN usuarios u ON u.id_usuario = cd.id_docente
                   WHERE cd.id_curso = c.id_curso), '[]') AS docentes,
         COALESCE((SELECT json_agg(r.codigo ORDER BY r.id_ra)
                   FROM catalogo_ra cr JOIN resultados_aprendizaje r USING (id_ra)
                   WHERE cr.id_catalogo = c.id_catalogo), '[]') AS ras,
         (SELECT COUNT(*)::int FROM curso_estudiantes ce WHERE ce.id_curso = c.id_curso) AS inscritos,
         (SELECT COUNT(*)::int FROM evaluaciones_ra_estudiante e WHERE e.id_curso = c.id_curso) AS notas,
         (SELECT COUNT(*)::int FROM catalogo_ra cr JOIN rubricas_criterios rc USING (id_ra)
          WHERE cr.id_catalogo = c.id_catalogo) AS criterios
  FROM cursos c
  JOIN cursos_catalogo k ON k.id_catalogo = c.id_catalogo
  JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo
  JOIN cohortes h ON h.id_cohorte = c.id_cohorte`;

const list = async ({ cohorte = null, periodo = null, catalogo = null, docente = null } = {}) =>
  (await db.query(
    `${SELECT_OFERTA}
     WHERE ($1::int IS NULL OR c.id_cohorte = $1)
       AND ($2::text IS NULL OR c.periodo = $2)
       AND ($3::int IS NULL OR c.id_catalogo = $3)
       AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM curso_docentes cd
                                         WHERE cd.id_curso = c.id_curso AND cd.id_docente = $4))
     ORDER BY c.periodo DESC, h.periodo_inicio DESC, k.orden, c.grupo`,
    [cohorte, periodo, catalogo, docente],
  )).rows;

const get = async (id) => (await db.query(`${SELECT_OFERTA} WHERE c.id_curso = $1`, [id])).rows[0] ?? null;

const estudiantes = async (id) =>
  (await db.query(
    `SELECT u.id_usuario AS id_estudiante, u.identificacion, u.nombres, u.apellidos, u.email, he.estado
     FROM curso_estudiantes ce
     JOIN cursos c ON c.id_curso = ce.id_curso
     JOIN usuarios u ON u.id_usuario = ce.id_estudiante
     LEFT JOIN cohorte_estudiantes he ON he.id_cohorte = c.id_cohorte AND he.id_estudiante = u.id_usuario
     WHERE ce.id_curso = $1
     ORDER BY u.apellidos, u.nombres`,
    [id],
  )).rows;

const create = async (cliente, o) =>
  (await cliente.query(
    `INSERT INTO cursos (id_catalogo, id_cohorte, periodo, nombre, grupo)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_curso`,
    [o.id_catalogo, o.id_cohorte, o.periodo, o.nombre || null, o.grupo ?? 1],
  )).rows[0].id_curso;

const update = async (cliente, id, o) =>
  (await cliente.query(
    `UPDATE cursos SET id_catalogo = $2, id_cohorte = $3, periodo = $4, nombre = $5, grupo = $6
     WHERE id_curso = $1`,
    [id, o.id_catalogo, o.id_cohorte, o.periodo, o.nombre || null, o.grupo ?? 1],
  )).rowCount;

const remove = async (id) => (await db.query('DELETE FROM cursos WHERE id_curso = $1', [id])).rowCount > 0;

const contarNotas = async (id) =>
  (await db.query('SELECT COUNT(*)::int AS n FROM evaluaciones_ra_estudiante WHERE id_curso = $1', [id])).rows[0].n;

const setDocentes = async (cliente, id, docentes) => {
  await cliente.query('DELETE FROM curso_docentes WHERE id_curso = $1', [id]);
  if (docentes.length) {
    await cliente.query(
      'INSERT INTO curso_docentes (id_curso, id_docente) SELECT $1, unnest($2::uuid[])',
      [id, docentes],
    );
  }
};

// Deja inscritos exactamente a `ids`. Quitar a un estudiante con notas viola la FK de
// evaluaciones_ra_estudiante (23503), que el errorHandler traduce a 409.
const setEstudiantes = async (cliente, id, ids) => {
  await cliente.query(
    'DELETE FROM curso_estudiantes WHERE id_curso = $1 AND NOT (id_estudiante = ANY($2::uuid[]))',
    [id, ids],
  );
  if (ids.length) {
    await cliente.query(
      `INSERT INTO curso_estudiantes (id_curso, id_estudiante) SELECT $1, unnest($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [id, ids],
    );
  }
};

const matricularCohorte = async (id) =>
  (await db.query(
    `INSERT INTO curso_estudiantes (id_curso, id_estudiante)
     SELECT c.id_curso, he.id_estudiante
     FROM cursos c JOIN cohorte_estudiantes he ON he.id_cohorte = c.id_cohorte
     WHERE c.id_curso = $1 AND he.estado <> 'retirado'
     ON CONFLICT DO NOTHING`,
    [id],
  )).rowCount;

const esDocenteDe = async (idCurso, idUsuario) =>
  (await db.query('SELECT 1 FROM curso_docentes WHERE id_curso = $1 AND id_docente = $2', [idCurso, idUsuario]))
    .rowCount > 0;

const existe = async (id) => (await db.query('SELECT 1 FROM cursos WHERE id_curso = $1', [id])).rowCount > 0;

// Ids de la lista que no son usuarios con el rol indicado.
const noSonDelRol = async (ids, rol) =>
  (await db.query(
    `SELECT x.id FROM unnest($1::uuid[]) AS x(id)
     WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = x.id AND u.rol = $2)`,
    [ids, rol],
  )).rows.map((r) => r.id);

// Ids de la lista que no pertenecen a la promoción de la oferta.
const fueraDeCohorte = async (idCurso, ids) =>
  (await db.query(
    `SELECT x.id FROM unnest($2::uuid[]) AS x(id)
     WHERE NOT EXISTS (SELECT 1 FROM cursos c
                       JOIN cohorte_estudiantes he ON he.id_cohorte = c.id_cohorte
                       WHERE c.id_curso = $1 AND he.id_estudiante = x.id)`,
    [idCurso, ids],
  )).rows.map((r) => r.id);

module.exports = {
  listCatalogo,
  list,
  get,
  estudiantes,
  create,
  update,
  remove,
  contarNotas,
  setDocentes,
  setEstudiantes,
  matricularCohorte,
  esDocenteDe,
  existe,
  noSonDelRol,
  fueraDeCohorte,
};
