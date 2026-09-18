const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./docentes.service');

// GET /api/v1/admin/docentes
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// GET /api/v1/admin/docentes/me/perfil
const obtenerPerfilPropio = asyncHandler(async (req, res) => {
  success(res, await service.obtenerPerfilPropio(requestContext(req)));
});

// PUT /api/v1/admin/docentes/me/perfil
const actualizarPerfilPropio = asyncHandler(async (req, res) => {
  success(res, await service.actualizarPerfilPropio(requestContext(req)));
});

// GET /api/v1/admin/docentes/:id/perfil
const obtenerPerfil = asyncHandler(async (req, res) => {
  success(res, await service.obtenerPerfil(requestContext(req)));
});

// PUT /api/v1/admin/docentes/:id/perfil
const actualizarPerfil = asyncHandler(async (req, res) => {
  success(res, await service.actualizarPerfil(requestContext(req)));
});

module.exports = { listar, obtenerPerfilPropio, actualizarPerfilPropio, obtenerPerfil, actualizarPerfil };
