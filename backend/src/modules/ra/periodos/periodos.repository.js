// Acceso a datos (PostgreSQL) — RF-RA-02 — Apertura de la calificación por semestre académico
// Tablas: periodos_calificacion_ra, cursos
const db = require('../../../config/db');

// Semestres con ofertas o con estado registrado; un semestre sin fila está cerrado.
const list = async () =>
  (await db.query(`
    SELECT x.periodo,
           COALESCE(p.abierto, FALSE) AS abierto,
           p.actualizado_en,
           (SELECT COUNT(*)::int FROM cursos c WHERE c.periodo = x.periodo) AS cursos
    FROM (SELECT periodo FROM cursos UNION SELECT periodo FROM periodos_calificacion_ra) x
    LEFT JOIN periodos_calificacion_ra p ON p.periodo = x.periodo
    ORDER BY x.periodo DESC`)).rows;

const guardar = async (periodo, abierto, idUsuario) =>
  (await db.query(
    `INSERT INTO periodos_calificacion_ra (periodo, abierto, actualizado_en, actualizado_por)
     VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
     ON CONFLICT (periodo) DO UPDATE
       SET abierto = EXCLUDED.abierto, actualizado_en = EXCLUDED.actualizado_en, actualizado_por = EXCLUDED.actualizado_por
     RETURNING periodo, abierto, actualizado_en`,
    [periodo, abierto, idUsuario],
  )).rows[0];

module.exports = { list, guardar };
