const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./plantillas.service');

// GET /api/v1/admin/plantillas
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// GET /api/v1/admin/plantillas/:tipo
const descargar = asyncHandler(async (req, res) => {
  success(res, await service.descargar(requestContext(req)));
});

module.exports = { listar, descargar };
