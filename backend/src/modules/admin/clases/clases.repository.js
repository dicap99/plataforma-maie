// Acceso a datos (PostgreSQL) — RF-ADM-01 / RF-RA-02 — Clases (asignaturas con identificador único)
// Tablas: clases, cursos_catalogo, catalogo_ra, cursos
const db = require('../../../config/db');

const SELECT = `
  SELECT cl.id_clase, cl.codigo, cl.nombre, cl.descripcion, cl.activa, cl.id_catalogo,
         k.codigo AS curso_plan, k.nombre AS curso_plan_nombre, k.semestre, m.id_modulo, m.nombre AS modulo,
         COALESCE((SELECT json_agg(r.codigo ORDER BY r.id_ra)
                   FROM catalogo_ra cr JOIN resultados_aprendizaje r USING (id_ra)
                   WHERE cr.id_catalogo = cl.id_catalogo), '[]') AS ras,
         (SELECT COUNT(*)::int FROM cursos c WHERE c.id_clase = cl.id_clase) AS ofertas
  FROM clases cl
  JOIN cursos_catalogo k ON k.id_catalogo = cl.id_catalogo
  JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo`;

const list = async ({ catalogo = null } = {}) =>
  (await db.query(`${SELECT} WHERE ($1::int IS NULL OR cl.id_catalogo = $1) ORDER BY k.orden, cl.nombre`, [catalogo])).rows;

const get = async (id) => (await db.query(`${SELECT} WHERE cl.id_clase = $1`, [id])).rows[0] ?? null;

const codigoCatalogo = async (idCatalogo) =>
  (await db.query('SELECT codigo FROM cursos_catalogo WHERE id_catalogo = $1', [idCatalogo])).rows[0]?.codigo ?? null;

const codigosConPrefijo = async (prefijo) =>
  (await db.query("SELECT codigo FROM clases WHERE codigo LIKE $1 || '-%'", [prefijo])).rows.map((r) => r.codigo);

const create = async (c) =>
  (await db.query(
    `INSERT INTO clases (codigo, nombre, id_catalogo, descripcion, activa)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_clase`,
    [c.codigo, c.nombre, c.id_catalogo, c.descripcion || null, c.activa ?? true],
  )).rows[0].id_clase;

const update = async (id, c) =>
  (await db.query(
    'UPDATE clases SET nombre = $2, id_catalogo = $3, descripcion = $4, activa = $5 WHERE id_clase = $1',
    [id, c.nombre, c.id_catalogo, c.descripcion || null, c.activa ?? true],
  )).rowCount;

const remove = async (id) => (await db.query('DELETE FROM clases WHERE id_clase = $1', [id])).rowCount > 0;

module.exports = { list, get, codigoCatalogo, codigosConPrefijo, create, update, remove };
