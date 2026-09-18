const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./estrategias.service');

// GET /api/v1/ra/estrategias
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

module.exports = { listar };
