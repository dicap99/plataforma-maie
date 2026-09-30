// Acceso a datos (PostgreSQL) — RF-RA-01 — Resultados de aprendizaje RA1–RA7
// Tablas: resultados_aprendizaje, ra_estrategias, catalogo_ra, cursos_catalogo, rubricas_criterios
const db = require('../../../config/db');

const SELECT = `
  SELECT r.id_ra, r.codigo, r.descripcion,
         COALESCE((SELECT json_agg(json_build_object('codigo', e.codigo, 'descripcion', e.descripcion) ORDER BY e.codigo)
                   FROM ra_estrategias re JOIN estrategias_evaluacion e USING (id_estrategia)
                   WHERE re.id_ra = r.id_ra), '[]') AS estrategias,
         COALESCE((SELECT json_agg(json_build_object('codigo', k.codigo, 'nombre', k.nombre, 'semestre', k.semestre,
                                                     'nivel_dominio', cr.nivel_dominio) ORDER BY k.orden)
                   FROM catalogo_ra cr JOIN cursos_catalogo k USING (id_catalogo)
                   WHERE cr.id_ra = r.id_ra), '[]') AS cursos,
         (SELECT COUNT(*)::int FROM rubricas_criterios rc WHERE rc.id_ra = r.id_ra) AS criterios
  FROM resultados_aprendizaje r`;

const list = async () => (await db.query(`${SELECT} ORDER BY r.id_ra`)).rows;

const get = async (id) => (await db.query(`${SELECT} WHERE r.id_ra = $1`, [id])).rows[0] ?? null;

module.exports = { list, get };
