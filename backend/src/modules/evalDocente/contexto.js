// Arma, desde la BD, el contexto que necesitan las reglas puras de categorizacion.js para un semestre:
// unidades evaluables (docente × promoción) y a quién evalúa cada estudiante.
const repository = require('./evalDocente.repository');
const { unidadesDelPeriodo, asignacionesEstudiantes } = require('./categorizacion');
const { ROLES } = require('../../utils/roles');

// Actor de la petición: rol, cuenta y perfil docente vinculado (si lo tiene).
const actorDe = async (user) => ({
  rol: user.rol,
  id_usuario: user.id,
  id_docente_propio: user.rol === ROLES.ESTUDIANTE ? null : await repository.docentePropio(user.id),
});

// idEstudiante: limita las inscripciones a un estudiante (vista del estudiante).
const contextoPeriodo = async (periodo, config, { idEstudiante = null } = {}) => {
  const [ofertas, posgrado, pregrado] = await Promise.all([
    repository.ofertas(periodo),
    repository.inscripcionesPosgrado(periodo, idEstudiante),
    repository.inscripcionesPregrado(periodo, idEstudiante),
  ]);
  const unidades = unidadesDelPeriodo(ofertas);
  const asignaciones = asignacionesEstudiantes({ ofertas, posgrado, pregrado, incluyePregrado: Boolean(config?.incluye_pregrado) });
  return { ofertas, unidades, asignaciones, posgrado, pregrado };
};

module.exports = { actorDe, contextoPeriodo };
