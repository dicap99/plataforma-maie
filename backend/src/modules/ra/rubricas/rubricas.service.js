// RF-RA-01 — Rúbricas institucionales por RA (Tablas 5 a 11 del documento RA MaIE)
// Coordinación las edita completas para que los pesos de cada RA siempre sumen 100 %.
const db = require('../../../config/db');
const ApiError = require('../../../utils/ApiError');
const { NIVELES, validarPesos } = require('../rubrica');
const repository = require('./rubricas.repository');

const consultar = async (idRa = null) => {
  const ras = await repository.listRA(idRa);
  const criterios = await repository.listCriterios(ras.map((r) => r.id_ra));
  return {
    niveles: NIVELES,
    ras: ras.map((r) => {
      const propios = criterios.filter((c) => c.id_ra === r.id_ra);
      return { ...r, suma_pesos: validarPesos(propios).suma, criterios: propios };
    }),
  };
};

module.exports = {
  consultar,

  listar: ({ query }) => consultar(query.ra ?? null),

  async reemplazar({ params, body }) {
    const idRa = params.idRa;
    if (!(await repository.listRA(idRa)).length) throw ApiError.notFound('Resultado de aprendizaje no encontrado');
    const { criterios } = body;
    const pesos = validarPesos(criterios);
    if (!pesos.valido) throw ApiError.badRequest('La rúbrica no es válida', pesos.errores);

    const actuales = new Set((await repository.listCriterios([idRa])).map((c) => c.id_criterio));
    const ajenos = criterios.filter((c) => c.id_criterio && !actuales.has(c.id_criterio));
    if (ajenos.length) throw ApiError.badRequest('Hay criterios que no pertenecen a este RA', { ids: ajenos.map((c) => c.id_criterio) });

    const conservar = criterios.filter((c) => c.id_criterio).map((c) => c.id_criterio);
    const bloqueados = await repository.calificadosFuera(idRa, conservar);
    if (bloqueados.length) {
      throw ApiError.conflict('No se pueden quitar criterios que ya tienen calificaciones', bloqueados);
    }
    await db.withTransaction((cliente) => repository.reemplazar(cliente, idRa, criterios));
    return (await consultar(idRa)).ras[0];
  },
};
