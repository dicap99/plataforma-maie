const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./reportes.service');

// GET /api/v1/admin/reportes/estadisticas
const estadisticas = asyncHandler(async (req, res) => {
  success(res, await service.estadisticas(requestContext(req)));
});

module.exports = { estadisticas };
