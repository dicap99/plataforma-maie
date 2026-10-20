// Reflejo de Gestión académica en las hojas del Módulo 1 (Información académica y Panel general).
// Híbrido: si una promoción tiene registros en Gestión (estudiantes con su promoción y beca; en cursos y
// docentes, cada semestre con clases ofertadas), sus cifras se calculan desde ahí; si no, se conservan las de la hoja
// (registro histórico importado del Excel). Cada fila indica su `origen`: 'gestion' o 'registro'.
const db = require('../../../config/db');

const BECAS = { 100: 'becas_100', hora_catedra: 'becas_hora_catedra', sintraunicol: 'becas_sintraunicol' };

// --- Consultas ---------------------------------------------------------------------
const estudiantesPorCohorte = async () =>
  (await db.query(`
    SELECT id_cohorte,
           COUNT(*)::int AS inscritos,
           COUNT(*) FILTER (WHERE estado <> 'inscrito')::int AS matriculados,
           COUNT(*) FILTER (WHERE estado IN ('egresado', 'graduado'))::int AS egresados,
           COUNT(*) FILTER (WHERE estado = 'graduado')::int AS graduados,
           COUNT(*) FILTER (WHERE beca = '100')::int AS becas_100,
           COUNT(*) FILTER (WHERE beca = 'hora_catedra')::int AS becas_hora_catedra,
           COUNT(*) FILTER (WHERE beca = 'sintraunicol')::int AS becas_sintraunicol
    FROM cohorte_estudiantes
    GROUP BY id_cohorte`)).rows;

// Semestre de la promoción en que cae un periodo: 1 en su periodo de inicio, 2 en el siguiente…
// (p. ej. 2022-A es el semestre III de una promoción que empezó en 2021-A). No es el semestre del plan:
// un curso puede dictarse en otro semestre que el previsto.
const SEMESTRE_REAL = `((SUBSTRING(c.periodo FROM 1 FOR 4)::int - SUBSTRING(h.periodo_inicio FROM 1 FOR 4)::int) * 2
  + (CASE WHEN RIGHT(c.periodo, 1) = 'B' THEN 1 ELSE 0 END)
  - (CASE WHEN RIGHT(h.periodo_inicio, 1) = 'B' THEN 1 ELSE 0 END) + 1)`;

// Clases ofertadas por promoción y semestre, con sus docentes según la afiliación del perfil.
const ofertasPorCohorte = async () =>
  (await db.query(`
    SELECT c.id_cohorte, ${SEMESTRE_REAL} AS semestre,
           COUNT(DISTINCT c.id_curso)::int AS n_cursos,
           COUNT(DISTINCT cd.id_docente) FILTER (WHERE d.afiliacion = 'UDENAR')::int AS docentes_udenar,
           COUNT(DISTINCT cd.id_docente) FILTER (WHERE d.afiliacion = 'EXTERNO')::int AS docentes_externos
    FROM cursos c
    JOIN cohortes h ON h.id_cohorte = c.id_cohorte
    LEFT JOIN curso_docentes cd ON cd.id_curso = c.id_curso
    LEFT JOIN docentes_perfil d ON d.id_docente = cd.id_docente
    WHERE ${SEMESTRE_REAL} BETWEEN 1 AND 4
    GROUP BY c.id_cohorte, semestre`)).rows;

// --- Combinación (funciones puras) -------------------------------------------------------
// Promociones: inscritos, matriculados, egresados y graduados desde los estudiantes registrados.
// Los aprobados por semestre siguen saliendo de la hoja.
const combinarCohortes = (hoja, estudiantes) => {
  const est = new Map(estudiantes.map((e) => [e.id_cohorte, e]));
  return hoja.map((c) => {
    const e = est.get(c.id_cohorte);
    if (!e) return { ...c, origen: 'registro' };
    return {
      ...c,
      inscritos: e.inscritos,
      matriculados: e.matriculados,
      egresados: e.egresados > 0 ? e.egresados : null, // sin egresados aún: promoción en curso
      graduados: e.graduados,
      origen: 'gestion',
    };
  });
};

// Beneficios: becas por tipo desde los estudiantes; asistentes y ayudantes, de la hoja.
const combinarBeneficios = (hoja, estudiantes, cohortes) => {
  const est = new Map(estudiantes.map((e) => [e.id_cohorte, e]));
  const nombre = new Map(cohortes.map((c) => [c.id_cohorte, c.nombre]));
  const filas = hoja.map((b) => {
    const e = est.get(b.id_cohorte);
    if (!e) return { ...b, origen: 'registro' };
    return { ...b, ...Object.fromEntries(Object.values(BECAS).map((k) => [k, e[k]])), origen: 'gestion' };
  });
  // Promociones con estudiantes registrados pero sin fila en la hoja.
  for (const e of estudiantes) {
    if (filas.some((b) => b.id_cohorte === e.id_cohorte) || !nombre.has(e.id_cohorte)) continue;
    filas.push({
      id_cohorte: e.id_cohorte, cohorte: nombre.get(e.id_cohorte),
      ...Object.fromEntries(Object.values(BECAS).map((k) => [k, e[k]])),
      asistentes_investigacion: 0, ayudantes_docencia: 0, origen: 'gestion',
    });
  }
  return filas;
};

// Cursos y docentes por semestre: cada semestre con clases ofertadas sale de ellas; los demás
// semestres de la promoción conservan la hoja (p. ej. mientras se completan los históricos).
const combinarSemestres = (hoja, ofertas, cohortes) => {
  const clave = (f) => `${f.id_cohorte}|${f.semestre}`;
  const conOfertas = new Set(ofertas.map(clave));
  const nombre = new Map(cohortes.map((c) => [c.id_cohorte, c.nombre]));
  return [
    ...hoja.filter((s) => !conOfertas.has(clave(s))).map((s) => ({ ...s, origen: 'registro' })),
    ...ofertas.filter((o) => nombre.has(o.id_cohorte)).map((o) => ({ ...o, cohorte: nombre.get(o.id_cohorte), origen: 'gestion' })),
  ].sort((a, b) => a.id_cohorte - b.id_cohorte || a.semestre - b.semestre);
};

// Aplica el reflejo a las hojas ya cargadas: { cohortes, beneficios, 'cohorte-semestres', … }.
const aplicar = async (datos) => {
  const [estudiantes, ofertas] = await Promise.all([estudiantesPorCohorte(), ofertasPorCohorte()]);
  return {
    ...datos,
    cohortes: combinarCohortes(datos.cohortes, estudiantes),
    beneficios: combinarBeneficios(datos.beneficios, estudiantes, datos.cohortes),
    'cohorte-semestres': combinarSemestres(datos['cohorte-semestres'], ofertas, datos.cohortes),
  };
};

module.exports = { SEMESTRE_REAL, aplicar, combinarCohortes, combinarBeneficios, combinarSemestres, RECURSOS_REFLEJADOS: ['cohortes', 'beneficios', 'cohorte-semestres'] };
