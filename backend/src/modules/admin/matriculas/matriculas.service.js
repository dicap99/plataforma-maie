// RF-ADM-01 / RF-RA-02 — Estudiantes de cada promoción (base para inscribirlos en las ofertas)
const db = require('../../../config/db');
const ApiError = require('../../../utils/ApiError');
const { ROLES } = require('../../../utils/roles');
const cursos = require('../cursos/cursos.repository');
const repository = require('./matriculas.repository');

const asegurarCohorte = async (id) => {
  if (!(await repository.existeCohorte(id))) throw ApiError.notFound('Promoción no encontrada');
};

module.exports = {
  async listar({ params }) {
    await asegurarCohorte(params.id);
    return repository.list(params.id);
  },

  async reemplazar({ params, body }) {
    await asegurarCohorte(params.id);
    const filas = [...new Map(body.estudiantes.map((f) => [f.id_estudiante, f])).values()];
    const invalidos = await cursos.noSonDelRol(filas.map((f) => f.id_estudiante), ROLES.ESTUDIANTE);
    if (invalidos.length) throw ApiError.badRequest('Hay usuarios que no tienen rol estudiante', { ids: invalidos });
    await db.withTransaction((cliente) => repository.reemplazar(cliente, params.id, filas));
    return repository.list(params.id);
  },
};
