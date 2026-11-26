// Acceso a datos (PostgreSQL) — Matrícula financiera por estudiante (asesoría 25-nov-2026)
// Tablas: matriculas_financieras, cohorte_estudiantes, curso_estudiantes_pregrado, usuarios, cohortes
const db = require('../../../config/db');

// Estudiantes de posgrado de la promoción (o de todas) con su estado financiero para `periodo`.
// Si `periodo` es null, devuelve solo los registros de pago ya guardados.
const listarPosgrado = async ({ periodo = null, id_cohorte = null } = {}) => {
  if (periodo) {
    return (await db.query(
      `SELECT mf.id_matricula_fin, u.id_usuario AS id_estudiante, u.identificacion, u.nombres, u.apellidos, u.email,
              'posgrado'::varchar AS poblacion, ce.id_cohorte, h.nombre AS cohorte, ce.estado AS estado_academico,
              $1::varchar AS periodo,
              COALESCE(mf.pagado, FALSE) AS pagado,
              COALESCE(mf.valor_pagado, 0)::float8 AS valor_pagado,
              mf.fecha_pago::text AS fecha_pago,
              mf.referencia,
              mf.observaciones
       FROM cohorte_estudiantes ce
       JOIN cohortes h ON h.id_cohorte = ce.id_cohorte
       JOIN usuarios u ON u.id_usuario = ce.id_estudiante
       LEFT JOIN matriculas_financieras mf
         ON mf.id_estudiante = ce.id_estudiante
        AND mf.poblacion = 'posgrado'
        AND mf.id_cohorte = ce.id_cohorte
        AND mf.periodo = $1
       WHERE ($2::int IS NULL OR ce.id_cohorte = $2)
         AND u.rol = 'estudiante'
       ORDER BY h.periodo_inicio DESC, u.apellidos, u.nombres`,
      [periodo, id_cohorte],
    )).rows;
  }
  return (await db.query(
    `SELECT mf.id_matricula_fin, u.id_usuario AS id_estudiante, u.identificacion, u.nombres, u.apellidos, u.email,
            mf.poblacion, mf.id_cohorte, h.nombre AS cohorte, ce.estado AS estado_academico,
            mf.periodo, mf.pagado, mf.valor_pagado::float8 AS valor_pagado,
            mf.fecha_pago::text AS fecha_pago, mf.referencia, mf.observaciones
     FROM matriculas_financieras mf
     JOIN usuarios u ON u.id_usuario = mf.id_estudiante
     LEFT JOIN cohortes h ON h.id_cohorte = mf.id_cohorte
     LEFT JOIN cohorte_estudiantes ce ON ce.id_cohorte = mf.id_cohorte AND ce.id_estudiante = mf.id_estudiante
     WHERE mf.poblacion = 'posgrado'
       AND ($1::int IS NULL OR mf.id_cohorte = $1)
     ORDER BY mf.periodo DESC, h.periodo_inicio DESC, u.apellidos, u.nombres`,
    [id_cohorte],
  )).rows;
};

// Estudiantes de pregrado con inscripción en cursos de la maestría (o con pago directo registrado).
const listarPregrado = async ({ periodo = null, id_cohorte = null } = {}) =>
  (await db.query(
    `WITH base AS (
       SELECT cp.id_estudiante, c.id_cohorte, c.periodo,
              STRING_AGG(DISTINCT cl.nombre, ', ' ORDER BY cl.nombre) AS cursos,
              MAX(cp.programa) AS programa,
              BOOL_OR(cp.estado <> 'retirado') AS vigente
       FROM curso_estudiantes_pregrado cp
       JOIN cursos c ON c.id_curso = cp.id_curso
       JOIN clases cl ON cl.id_clase = c.id_clase
       WHERE ($1::varchar IS NULL OR c.periodo = $1)
         AND ($2::int IS NULL OR c.id_cohorte = $2)
       GROUP BY cp.id_estudiante, c.id_cohorte, c.periodo
     ),
     combinados AS (
       SELECT COALESCE(b.id_estudiante, mf.id_estudiante) AS id_estudiante,
              COALESCE(b.id_cohorte, mf.id_cohorte) AS id_cohorte,
              COALESCE(b.periodo, mf.periodo) AS periodo,
              b.cursos, b.programa, b.vigente, mf.id_matricula_fin,
              COALESCE(mf.pagado, FALSE) AS pagado,
              COALESCE(mf.valor_pagado, 0)::float8 AS valor_pagado,
              mf.fecha_pago::text AS fecha_pago,
              mf.referencia, mf.observaciones
       FROM base b
       FULL OUTER JOIN matriculas_financieras mf
         ON mf.poblacion = 'pregrado'
        AND mf.id_estudiante = b.id_estudiante
        AND mf.periodo = b.periodo
        AND mf.id_cohorte IS NOT DISTINCT FROM b.id_cohorte
       WHERE (mf.id_matricula_fin IS NULL OR mf.poblacion = 'pregrado')
         AND ($1::varchar IS NULL OR COALESCE(b.periodo, mf.periodo) = $1)
         AND ($2::int IS NULL OR COALESCE(b.id_cohorte, mf.id_cohorte) = $2)
     )
     SELECT x.id_matricula_fin, x.id_estudiante, u.identificacion, u.nombres, u.apellidos, u.email,
            'pregrado'::varchar AS poblacion, x.id_cohorte, h.nombre AS cohorte,
            x.periodo, x.cursos, x.programa, COALESCE(x.vigente, TRUE) AS vigente,
            x.pagado, x.valor_pagado, x.fecha_pago, x.referencia, x.observaciones
     FROM combinados x
     JOIN usuarios u ON u.id_usuario = x.id_estudiante
     LEFT JOIN cohortes h ON h.id_cohorte = x.id_cohorte
     ORDER BY x.periodo DESC, h.periodo_inicio DESC NULLS LAST, u.apellidos, u.nombres`,
    [periodo, id_cohorte],
  )).rows;

const upsertPago = async (p) =>
  (await db.query(
    `INSERT INTO matriculas_financieras
       (id_estudiante, poblacion, id_cohorte, periodo, pagado, valor_pagado, fecha_pago, referencia, observaciones, actualizado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
     ON CONFLICT ON CONSTRAINT unq_matricula_fin
     DO UPDATE SET pagado = EXCLUDED.pagado,
                   valor_pagado = EXCLUDED.valor_pagado,
                   fecha_pago = EXCLUDED.fecha_pago,
                   referencia = EXCLUDED.referencia,
                   observaciones = EXCLUDED.observaciones,
                   actualizado_en = CURRENT_TIMESTAMP
     RETURNING id_matricula_fin, id_estudiante, poblacion, id_cohorte, periodo, pagado,
               valor_pagado::float8 AS valor_pagado, fecha_pago::text AS fecha_pago, referencia, observaciones`,
    [
      p.id_estudiante,
      p.poblacion,
      p.id_cohorte ?? null,
      p.periodo,
      p.pagado,
      p.pagado ? p.valor_pagado : 0,
      p.fecha_pago || null,
      p.referencia || null,
      p.observaciones || null,
    ],
  )).rows[0];

const removePago = async (id) =>
  (await db.query('DELETE FROM matriculas_financieras WHERE id_matricula_fin = $1', [id])).rowCount > 0;

const existeEstudiante = async (id) =>
  (await db.query("SELECT 1 FROM usuarios WHERE id_usuario = $1 AND rol = 'estudiante'", [id])).rowCount > 0;

const existeCohorte = async (id) =>
  (await db.query('SELECT 1 FROM cohortes WHERE id_cohorte = $1', [id])).rowCount > 0;

const resumenPorCohorte = async () =>
  (await db.query(
    `SELECT mf.id_cohorte, h.nombre AS cohorte,
            COALESCE(SUM(mf.valor_pagado) FILTER (WHERE mf.pagado AND mf.poblacion = 'posgrado'), 0)::float8 AS posgrado,
            COALESCE(SUM(mf.valor_pagado) FILTER (WHERE mf.pagado AND mf.poblacion = 'pregrado'), 0)::float8 AS pregrado,
            COALESCE(SUM(mf.valor_pagado) FILTER (WHERE mf.pagado), 0)::float8 AS total,
            COUNT(*) FILTER (WHERE mf.pagado AND mf.poblacion = 'posgrado')::int AS pagados_posgrado,
            COUNT(*) FILTER (WHERE mf.pagado AND mf.poblacion = 'pregrado')::int AS pagados_pregrado
     FROM matriculas_financieras mf
     LEFT JOIN cohortes h ON h.id_cohorte = mf.id_cohorte
     GROUP BY mf.id_cohorte, h.nombre, h.periodo_inicio
     ORDER BY h.periodo_inicio NULLS LAST, h.nombre`,
  )).rows;

module.exports = {
  listarPosgrado,
  listarPregrado,
  upsertPago,
  removePago,
  existeEstudiante,
  existeCohorte,
  resumenPorCohorte,
};
