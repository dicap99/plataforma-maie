const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./docentes.service');

const responder = (accion, estado = 200) => asyncHandler(async (req, res) => {
  success(res, await service[accion](requestContext(req)), estado);
});

module.exports = {
  // GET/PUT /api/v1/admin/docentes/me/perfil
  obtenerPerfilPropio: responder('obtenerPerfilPropio'),
  actualizarPerfilPropio: responder('actualizarPerfilPropio'),
  // POST /api/v1/admin/docentes/me/cursos · DELETE /api/v1/admin/docentes/me/cursos/:idCurso
  agregarCursoPropio: responder('agregarCursoPropio', 201),
  quitarCursoPropio: responder('quitarCursoPropio'),
  // GET /api/v1/admin/docentes/:id/perfil · POST/DELETE /api/v1/admin/docentes/:id/cursos (Coordinación)
  obtenerPerfil: responder('obtenerPerfil'),
  agregarCurso: responder('agregarCurso', 201),
  quitarCurso: responder('quitarCurso'),
};
