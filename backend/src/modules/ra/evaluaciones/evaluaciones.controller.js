const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./evaluaciones.service');

// GET /api/v1/ra/evaluaciones
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// POST /api/v1/ra/evaluaciones
const registrarLote = asyncHandler(async (req, res) => {
  success(res, await service.registrarLote(requestContext(req)), 201);
});

// PUT /api/v1/ra/evaluaciones/:id
const actualizar = asyncHandler(async (req, res) => {
  success(res, await service.actualizar(requestContext(req)));
});

module.exports = { listar, registrarLote, actualizar };
