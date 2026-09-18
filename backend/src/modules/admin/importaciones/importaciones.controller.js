const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./importaciones.service');

// POST /api/v1/admin/importaciones
const importar = asyncHandler(async (req, res) => {
  success(res, await service.importar(requestContext(req)), 201);
});

module.exports = { importar };
