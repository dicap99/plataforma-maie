const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./rubricas.service');

// GET /api/v1/ra/rubricas
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// POST /api/v1/ra/rubricas
const crear = asyncHandler(async (req, res) => {
  success(res, await service.crear(requestContext(req)), 201);
});

// PUT /api/v1/ra/rubricas/:id
const actualizar = asyncHandler(async (req, res) => {
  success(res, await service.actualizar(requestContext(req)));
});

// DELETE /api/v1/ra/rubricas/:id
const eliminar = asyncHandler(async (req, res) => {
  success(res, await service.eliminar(requestContext(req)));
});

module.exports = { listar, crear, actualizar, eliminar };
