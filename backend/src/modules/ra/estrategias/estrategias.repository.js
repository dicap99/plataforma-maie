// Acceso a datos (PostgreSQL) — RF-RA-01 — Estrategias de evaluación E1–E6
// Tablas: estrategias_evaluacion, ra_estrategias
const db = require('../../../config/db');

const list = async () =>
  (await db.query(`
    SELECT e.id_estrategia, e.codigo, e.descripcion,
           COALESCE((SELECT json_agg(r.codigo ORDER BY r.id_ra)
                     FROM ra_estrategias re JOIN resultados_aprendizaje r USING (id_ra)
                     WHERE re.id_estrategia = e.id_estrategia), '[]') AS ras
    FROM estrategias_evaluacion e
    ORDER BY e.codigo`)).rows;

module.exports = { list };
