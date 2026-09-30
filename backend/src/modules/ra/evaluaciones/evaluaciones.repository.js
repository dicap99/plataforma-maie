// Acceso a datos (PostgreSQL) — RF-RA-02 — Calificación de rúbricas por estudiante
// Tablas: evaluaciones_ra_estudiante, catalogo_ra, rubricas_criterios, curso_estudiantes
const db = require('../../../config/db');

// RA que evalúa la oferta (según su curso del catálogo) con los criterios de cada rúbrica.
const rasDelCurso = async (idCurso) =>
  (await db.query(
    `SELECT r.id_ra, r.codigo, r.descripcion, cr.nivel_dominio,
            COALESCE((SELECT json_agg(e.codigo ORDER BY e.codigo)
                      FROM catalogo_ra_estrategias ce JOIN estrategias_evaluacion e USING (id_estrategia)
                      WHERE ce.id_catalogo = cr.id_catalogo AND ce.id_ra = cr.id_ra), '[]') AS estrategias,
            COALESCE((SELECT json_agg(json_build_object(
                        'id_criterio', rc.id_criterio, 'orden', rc.orden, 'nombre_criterio', rc.nombre_criterio,
                        'peso_porcentaje', rc.peso_porcentaje, 'desc_nivel_alto', rc.desc_nivel_alto,
                        'desc_nivel_medio', rc.desc_nivel_medio, 'desc_nivel_basico', rc.desc_nivel_basico,
                        'desc_nivel_insuficiente', rc.desc_nivel_insuficiente) ORDER BY rc.orden)
                      FROM rubricas_criterios rc WHERE rc.id_ra = r.id_ra), '[]') AS criterios
     FROM cursos c
     JOIN catalogo_ra cr ON cr.id_catalogo = c.id_catalogo
     JOIN resultados_aprendizaje r ON r.id_ra = cr.id_ra
     WHERE c.id_curso = $1
     ORDER BY r.id_ra`,
    [idCurso],
  )).rows;

const notas = async (idCurso) =>
  (await db.query(
    `SELECT id_estudiante, id_criterio, calificacion, nivel, id_docente,
            COALESCE(actualizado_en, fecha_evaluacion) AS actualizado
     FROM evaluaciones_ra_estudiante WHERE id_curso = $1`,
    [idCurso],
  )).rows;

// Ids de la lista que no están inscritos en la oferta.
const noInscritos = async (idCurso, ids) =>
  (await db.query(
    `SELECT x.id FROM unnest($2::uuid[]) AS x(id)
     WHERE NOT EXISTS (SELECT 1 FROM curso_estudiantes ce WHERE ce.id_curso = $1 AND ce.id_estudiante = x.id)`,
    [idCurso, ids],
  )).rows.map((r) => r.id);

const guardar = (cliente, idCurso, idDocente, filas) =>
  cliente.query(
    `INSERT INTO evaluaciones_ra_estudiante (id_curso, id_estudiante, id_criterio, id_docente, calificacion, nivel)
     SELECT $1, x.est, x.crit, $2, x.nota, x.nivel::tipo_nivel_logro
     FROM unnest($3::uuid[], $4::int[], $5::numeric[], $6::text[]) AS x(est, crit, nota, nivel)
     ON CONFLICT (id_curso, id_estudiante, id_criterio) DO UPDATE
       SET calificacion = EXCLUDED.calificacion, nivel = EXCLUDED.nivel, id_docente = EXCLUDED.id_docente,
           actualizado_en = CURRENT_TIMESTAMP`,
    [idCurso, idDocente, filas.map((f) => f.id_estudiante), filas.map((f) => f.id_criterio),
      filas.map((f) => f.calificacion), filas.map((f) => f.nivel)],
  );

const borrar = (cliente, idCurso, filas) =>
  cliente.query(
    `DELETE FROM evaluaciones_ra_estudiante e
     USING unnest($2::uuid[], $3::int[]) AS x(est, crit)
     WHERE e.id_curso = $1 AND e.id_estudiante = x.est AND e.id_criterio = x.crit`,
    [idCurso, filas.map((f) => f.id_estudiante), filas.map((f) => f.id_criterio)],
  );

module.exports = { rasDelCurso, notas, noInscritos, guardar, borrar };
