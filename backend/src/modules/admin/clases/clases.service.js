// RF-ADM-01 / RF-RA-02 — Clases: asignaturas con identificador único (p. ej. «Robótica»), cada una
// ligada al curso del plan que cubre. Las ofertas por semestre (con sus docentes) parten de ellas.
const ApiError = require('../../../utils/ApiError');
const repository = require('./clases.repository');

const noEncontrada = () => ApiError.notFound('Clase no encontrada');

// Código generado a partir del curso del plan: MaIE-CE2 → CE2-01, CE2-02…
const generarCodigo = async (idCatalogo) => {
  const codigo = await repository.codigoCatalogo(idCatalogo);
  if (!codigo) throw ApiError.badRequest('Curso del plan inexistente');
  const prefijo = codigo.replace(/^MaIE-/i, '').toUpperCase();
  const usados = (await repository.codigosConPrefijo(prefijo))
    .map((c) => Number(c.slice(prefijo.length + 1)))
    .filter(Number.isInteger);
  return `${prefijo}-${String(Math.max(0, ...usados) + 1).padStart(2, '0')}`;
};

module.exports = {
  listar: ({ query }) => repository.list({ catalogo: query.catalogo ?? null }),

  async obtener({ params }) {
    const clase = await repository.get(params.id);
    if (!clase) throw noEncontrada();
    return clase;
  },

  async crear({ body }) {
    const id = await repository.create({ ...body, codigo: await generarCodigo(body.id_catalogo) });
    return repository.get(id);
  },

  async actualizar({ params, body }) {
    const actual = await repository.get(params.id);
    if (!actual) throw noEncontrada();
    if (body.id_catalogo !== actual.id_catalogo && actual.ofertas > 0) {
      throw ApiError.conflict('No se puede cambiar el curso del plan de una clase que ya se ha ofertado');
    }
    await repository.update(params.id, body);
    return repository.get(params.id);
  },

  async eliminar({ params }) {
    const actual = await repository.get(params.id);
    if (!actual) throw noEncontrada();
    if (actual.ofertas > 0) throw ApiError.conflict('No se puede eliminar una clase que ya se ha ofertado; puede desactivarla');
    await repository.remove(params.id);
    return { eliminado: true };
  },
};
