const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./resultados.service');

// GET /api/v1/ra/resultados
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// GET /api/v1/ra/resultados/:id
const obtener = asyncHandler(async (req, res) => {
  success(res, await service.obtener(requestContext(req)));
});

module.exports = { listar, obtener };
