// RF-RA-02 / RF-RA-03 — Planilla de calificación de rúbricas de una oferta de curso
// El docente registra una nota 0–5 por criterio; el nivel de cada criterio y el total ponderado
// de cada RA se calculan con modules/ra/rubrica.js. Coordinación consulta en modo auditoría.
const db = require('../../../config/db');
const ApiError = require('../../../utils/ApiError');
const cursos = require('../../admin/cursos/cursos.repository');
const { asegurarAccesoCurso } = require('../propiedad');
const { NIVELES, nivelDeNota, resultadoRA } = require('../rubrica');
const repository = require('./evaluaciones.repository');

const vacia = (v) => v === null || v === undefined;

const planilla = async (idCurso) => {
  const [curso, estudiantes, ras, notas] = await Promise.all([
    cursos.get(idCurso), cursos.estudiantes(idCurso), repository.rasDelCurso(idCurso), repository.notas(idCurso),
  ]);
  const porEstudiante = new Map(estudiantes.map((e) => [e.id_estudiante, new Map()]));
  for (const n of notas) porEstudiante.get(n.id_estudiante)?.set(n.id_criterio, n.calificacion);

  return {
    curso,
    niveles: NIVELES,
    ras,
    estudiantes: estudiantes.map((e) => {
      const propias = porEstudiante.get(e.id_estudiante);
      return {
        ...e,
        notas: Object.fromEntries(propias),
        resultados: Object.fromEntries(ras.map((r) => [r.id_ra, resultadoRA(r.criterios, propias)])),
      };
    }),
  };
};

module.exports = {
  planilla,

  async listar({ query, user }) {
    await asegurarAccesoCurso(user, query.curso);
    return planilla(query.curso);
  },

  async registrarLote({ body, user }) {
    const idCurso = body.id_curso;
    await asegurarAccesoCurso(user, idCurso);

    const permitidos = new Set((await repository.rasDelCurso(idCurso)).flatMap((r) => r.criterios.map((c) => c.id_criterio)));
    const ajenos = [...new Set(body.calificaciones.map((c) => c.id_criterio).filter((id) => !permitidos.has(id)))];
    if (ajenos.length) {
      throw ApiError.badRequest('Hay criterios de rúbricas de RA que este curso no evalúa', { criterios: ajenos });
    }
    const fuera = await repository.noInscritos(idCurso, [...new Set(body.calificaciones.map((c) => c.id_estudiante))]);
    if (fuera.length) throw ApiError.conflict('Hay estudiantes que no están inscritos en el curso', { ids: fuera });

    // Si una celda llega repetida en el lote, prevalece la última.
    const celdas = [...new Map(body.calificaciones.map((c) => [`${c.id_estudiante}|${c.id_criterio}`, c])).values()];
    const guardar = celdas.filter((c) => !vacia(c.calificacion)).map((c) => ({ ...c, nivel: nivelDeNota(c.calificacion) }));
    const borrar = celdas.filter((c) => vacia(c.calificacion));

    await db.withTransaction(async (cliente) => {
      if (guardar.length) await repository.guardar(cliente, idCurso, user.id, guardar);
      if (borrar.length) await repository.borrar(cliente, idCurso, borrar);
    });
    return planilla(idCurso);
  },
};
