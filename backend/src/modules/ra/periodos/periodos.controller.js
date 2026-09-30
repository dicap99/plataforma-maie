const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./periodos.service');

// GET /api/v1/ra/periodos
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// PUT /api/v1/ra/periodos/:periodo — { abierto }
const cambiar = asyncHandler(async (req, res) => {
  success(res, await service.cambiar(requestContext(req)));
});

module.exports = { listar, cambiar };
