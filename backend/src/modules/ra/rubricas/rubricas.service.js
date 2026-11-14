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

    const lista = await repository.listCriterios([idRa]);
    const actuales = new Map(lista.map((c) => [c.id_criterio, c]));
    const ajenos = criterios.filter((c) => c.id_criterio && !actuales.has(c.id_criterio));
    if (ajenos.length) throw ApiError.badRequest('Hay criterios que no pertenecen a este RA', { ids: ajenos.map((c) => c.id_criterio) });

    // Con calificaciones registradas, cambiar pesos o añadir criterios recalcularía en silencio los
    // totales ya reportados (y un criterio nuevo dejaría incompletas todas las rúbricas anteriores).
    // Se permiten las correcciones de redacción y de orden.
    if (await repository.tieneCalificaciones(idRa)) {
      const nuevos = criterios.filter((c) => !c.id_criterio);
      const pesos = criterios.filter((c) => c.id_criterio
        && Math.round(Number(c.peso_porcentaje) * 100) !== Math.round(Number(actuales.get(c.id_criterio).peso_porcentaje) * 100));
      if (nuevos.length || pesos.length) {
        throw ApiError.conflict(
          'La rúbrica ya tiene calificaciones: solo se puede corregir la redacción y el orden de los criterios, no añadirlos ni cambiar sus pesos',
          { nuevos: nuevos.length, pesos_cambiados: pesos.map((c) => c.id_criterio) },
        );
      }
    }

    const conservar = criterios.filter((c) => c.id_criterio).map((c) => c.id_criterio);
    const bloqueados = await repository.calificadosFuera(idRa, conservar);
    if (bloqueados.length) {
      throw ApiError.conflict('No se pueden quitar criterios que ya tienen calificaciones', bloqueados);
    }
    await db.withTransaction((cliente) => repository.reemplazar(cliente, idRa, criterios));
    return (await consultar(idRa)).ras[0];
  },
};
