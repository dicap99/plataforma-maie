// Beneficios de los estudiantes por semestre de su promoción (pestaña «Beneficios» de Gestión académica).
// Se separaron del formulario de usuario por acuerdo de la asesoría del 20-oct-2026: el usuario solo
// registra que es estudiante y su promoción; Coordinación edita aquí la beca, las asistencias y las
// ayudantías de cada semestre. La beca de la promoción se deduce de los semestres (la de más semestres).
const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { becaPrincipal, semestresConVariasBecas } = require('../../utils/beneficios');
const repository = require('./usuarios.repository');

module.exports = {
  async listar({ query }) {
    if (!(await repository.existeCohorte(query.id_cohorte))) throw ApiError.notFound('La promoción indicada no existe');
    return repository.estudiantesConBeneficios(query.id_cohorte);
  },

  // Reemplaza los beneficios del estudiante en la promoción indicada (la que se ve en la pestaña), que
  // debe ser una de las suyas; las demás promociones del estudiante no se tocan.
  async reemplazar({ params, body }) {
    const beneficios = [...new Map(body.beneficios.map((b) => [`${b.semestre}|${b.tipo}`, b])).values()];
    const repetidas = semestresConVariasBecas(beneficios);
    if (repetidas.length) throw ApiError.badRequest(`Solo puede haber una beca por semestre (semestre ${repetidas.join(', ')})`);
    return db.withTransaction(async (cliente) => {
      const [estudiante] = await repository.estudiantesConBeneficios(body.id_cohorte, params.id, cliente);
      if (!estudiante) throw ApiError.notFound('El estudiante no pertenece a esa promoción');
      await repository.reemplazarBeneficios(cliente, params.id, body.id_cohorte, beneficios, becaPrincipal(beneficios));
      return (await repository.estudiantesConBeneficios(body.id_cohorte, params.id, cliente))[0];
    });
  },
};
