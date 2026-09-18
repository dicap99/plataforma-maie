const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./reportes.service');

// GET /api/v1/ra/reportes
const consolidado = asyncHandler(async (req, res) => {
  success(res, await service.consolidado(requestContext(req)));
});

module.exports = { consolidado };
