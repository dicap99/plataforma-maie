// RF-RA-01 — Resultados de aprendizaje con sus estrategias y los cursos que los evalúan
const ApiError = require('../../../utils/ApiError');
const repository = require('./resultados.repository');

module.exports = {
  listar: () => repository.list(),

  async obtener({ params }) {
    const ra = await repository.get(params.id);
    if (!ra) throw ApiError.notFound('Resultado de aprendizaje no encontrado');
    return ra;
  },
};
