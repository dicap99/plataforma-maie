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

// Avance de la calificación de cada curso de los semestres con la calificación abierta. Notas esperadas =
// criterios de los RA del curso × inscritos; un retirado de la promoción sin notas no cuenta (como en la planilla).
const avanceAbiertos = async () =>
  (await db.query(`
    SELECT c.periodo, c.id_curso, c.id_cohorte, h.nombre AS cohorte, cl.nombre AS curso,
           COALESCE((SELECT json_agg(COALESCE(u.nombres || ' ' || u.apellidos, d.nombre_completo) ORDER BY d.nombre_completo)
                     FROM curso_docentes cd JOIN docentes_perfil d ON d.id_docente = cd.id_docente
                     LEFT JOIN usuarios u ON u.id_usuario = d.id_usuario
                     WHERE cd.id_curso = c.id_curso), '[]') AS docentes,
           (SELECT COUNT(*)::int FROM catalogo_ra cr JOIN rubricas_criterios rc USING (id_ra)
            WHERE cr.id_catalogo = c.id_catalogo)
             * (SELECT COUNT(*)::int FROM curso_estudiantes ce
                LEFT JOIN cohorte_estudiantes he ON he.id_cohorte = c.id_cohorte AND he.id_estudiante = ce.id_estudiante
                WHERE ce.id_curso = c.id_curso
                  AND (he.estado IS DISTINCT FROM 'retirado'
                       OR EXISTS (SELECT 1 FROM evaluaciones_ra_estudiante e
                                  WHERE e.id_curso = c.id_curso AND e.id_estudiante = ce.id_estudiante))) AS esperadas,
           (SELECT COUNT(*)::int FROM evaluaciones_ra_estudiante e WHERE e.id_curso = c.id_curso) AS notas
    FROM cursos c
    JOIN periodos_calificacion_ra p ON p.periodo = c.periodo AND p.abierto
    JOIN cohortes h ON h.id_cohorte = c.id_cohorte
    JOIN clases cl ON cl.id_clase = c.id_clase
    ORDER BY c.periodo DESC, h.periodo_inicio DESC, cl.nombre`)).rows;

module.exports = { list, guardar, avanceAbiertos };
