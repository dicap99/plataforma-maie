const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./respuestas.service');

// POST /api/v1/eval-docente/respuestas
const registrar = asyncHandler(async (req, res) => {
  success(res, await service.registrar(requestContext(req)), 201);
});

module.exports = { registrar };
