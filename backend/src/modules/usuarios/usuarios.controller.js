const asyncHandler = require('../../utils/asyncHandler');
const requestContext = require('../../utils/requestContext');
const { success } = require('../../utils/apiResponse');
const service = require('./usuarios.service');

// GET /api/v1/usuarios
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// GET /api/v1/usuarios/:id
const obtener = asyncHandler(async (req, res) => {
  success(res, await service.obtener(requestContext(req)));
});

// POST /api/v1/usuarios
const crear = asyncHandler(async (req, res) => {
  success(res, await service.crear(requestContext(req)), 201);
});

// PUT /api/v1/usuarios/:id
const actualizar = asyncHandler(async (req, res) => {
  success(res, await service.actualizar(requestContext(req)));
});

// DELETE /api/v1/usuarios/:id
const eliminar = asyncHandler(async (req, res) => {
  success(res, await service.eliminar(requestContext(req)));
});

module.exports = { listar, obtener, crear, actualizar, eliminar };
