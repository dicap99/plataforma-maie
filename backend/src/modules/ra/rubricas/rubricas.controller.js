const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./rubricas.service');

// GET /api/v1/ra/rubricas
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// PUT /api/v1/ra/rubricas/:idRa — reemplaza la rúbrica completa del RA
const reemplazar = asyncHandler(async (req, res) => {
  success(res, await service.reemplazar(requestContext(req)));
});

module.exports = { listar, reemplazar };
