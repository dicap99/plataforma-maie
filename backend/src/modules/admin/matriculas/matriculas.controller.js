const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./matriculas.service');

// GET /api/v1/admin/cohortes/:id/estudiantes
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// PUT /api/v1/admin/cohortes/:id/estudiantes
const reemplazar = asyncHandler(async (req, res) => {
  success(res, await service.reemplazar(requestContext(req)));
});

module.exports = { listar, reemplazar };
