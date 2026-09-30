// Regla de propiedad «sus cursos» (Documento Técnico, matriz de acceso): Coordinación ve todas
// las ofertas; un docente solo las que tiene asignadas en curso_docentes.
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../utils/roles');
const cursos = require('../admin/cursos/cursos.repository');

const asegurarAccesoCurso = async (user, idCurso) => {
  if (!(await cursos.existe(idCurso))) throw ApiError.notFound('Curso no encontrado');
  if (user.rol === ROLES.COORDINADOR) return;
  if (user.rol === ROLES.DOCENTE && (await cursos.esDocenteDe(idCurso, user.id))) return;
  throw ApiError.forbidden('Solo puede acceder a los cursos que tiene asignados');
};

// Filtro de docente para listados y reportes: null para Coordinación.
const docenteFiltro = (user) => (user.rol === ROLES.DOCENTE ? user.id : null);

module.exports = { asegurarAccesoCurso, docenteFiltro };
