// Acceso a datos (PostgreSQL) — RF-RA-03 / RF-RA-04 — Resultados consolidados de RA
// Tablas y vistas: v_ra_resultados, evaluaciones_ra_estudiante, rubricas_criterios, cursos,
// cursos_catalogo, modulos_curriculares, cohortes, usuarios, parametros_programa
const db = require('../../../config/db');

// Filtros combinables ($1…$7); el periodo es el semestre académico de la oferta.
const FILTROS = `
      ($1::int IS NULL OR c.id_cohorte = $1)
  AND ($2::text IS NULL OR c.periodo = $2)
  AND ($3::int IS NULL OR k.id_modulo = $3)
  AND ($4::int IS NULL OR c.id_catalogo = $4)
  AND ($5::int IS NULL OR c.id_curso = $5)
  AND ($6::int IS NULL OR r.id_ra = $6)
  AND ($7::uuid IS NULL OR u.id_usuario = $7)`;

const parametros = (f) => [f.cohorte, f.periodo, f.modulo, f.catalogo, f.curso, f.ra, f.estudiante]
  .map((v) => (v === undefined ? null : v));

const JOINS = `
  JOIN resultados_aprendizaje r ON r.id_ra = v.id_ra
  JOIN cursos c ON c.id_curso = v.id_curso
  JOIN cursos_catalogo k ON k.id_catalogo = c.id_catalogo
  JOIN modulos_curriculares m ON m.id_modulo = k.id_modulo
  JOIN cohortes h ON h.id_cohorte = c.id_cohorte
  JOIN usuarios u ON u.id_usuario = v.id_estudiante`;

// Un registro por (oferta, estudiante, RA) con su total ponderado y si la rúbrica está completa.
const resultados = async (filtros) =>
  (await db.query(
    `SELECT v.id_curso, v.id_estudiante, v.id_ra, v.total, (v.calificados = v.criterios) AS completo,
            r.codigo AS ra, r.descripcion AS ra_descripcion,
            c.periodo, c.grupo, c.id_catalogo, k.codigo AS curso_codigo, COALESCE(c.nombre, k.nombre) AS curso_nombre,
            k.semestre, k.orden AS curso_orden, m.id_modulo, m.nombre AS modulo,
            h.id_cohorte, h.nombre AS cohorte, h.periodo_inicio,
            u.identificacion, u.apellidos || ' ' || u.nombres AS estudiante
     FROM v_ra_resultados v ${JOINS}
     WHERE ${FILTROS}
     ORDER BY r.id_ra, h.periodo_inicio, k.orden, u.apellidos, u.nombres`,
    parametros(filtros),
  )).rows;

// Notas por criterio con los mismos filtros (hoja de detalle de la exportación).
const detalleCriterios = async (filtros) =>
  (await db.query(
    `SELECT h.nombre AS cohorte, c.periodo, k.codigo AS curso_codigo, COALESCE(c.nombre, k.nombre) AS curso_nombre,
            r.codigo AS ra, rc.orden, rc.nombre_criterio, rc.peso_porcentaje,
            u.identificacion, u.apellidos || ' ' || u.nombres AS estudiante, e.calificacion, e.nivel
     FROM evaluaciones_ra_estudiante e
     JOIN rubricas_criterios rc ON rc.id_criterio = e.id_criterio
     JOIN (SELECT id_curso, id_estudiante, id_ra FROM v_ra_resultados) v
       ON v.id_curso = e.id_curso AND v.id_estudiante = e.id_estudiante AND v.id_ra = rc.id_ra
     ${JOINS}
     WHERE ${FILTROS}
     ORDER BY h.periodo_inicio, k.orden, r.id_ra, u.apellidos, u.nombres, rc.orden`,
    parametros(filtros),
  )).rows;

const listRA = async () =>
  (await db.query('SELECT id_ra, codigo, descripcion FROM resultados_aprendizaje ORDER BY id_ra')).rows;

const metaSatisfactorio = async () =>
  (await db.query("SELECT valor FROM parametros_programa WHERE clave = 'meta_ra_satisfactorio_pct'")).rows[0]?.valor ?? null;

module.exports = { resultados, detalleCriterios, listRA, metaSatisfactorio };
