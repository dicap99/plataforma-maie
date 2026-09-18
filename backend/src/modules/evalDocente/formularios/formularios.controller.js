const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./formularios.service');

// GET /api/v1/eval-docente/formularios/:tipo
const obtener = asyncHandler(async (req, res) => {
  success(res, await service.obtener(requestContext(req)));
});

module.exports = { obtener };
