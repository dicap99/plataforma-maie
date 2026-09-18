const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./cohortes.service');

// GET /api/v1/admin/cohortes
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// GET /api/v1/admin/cohortes/:id
const obtener = asyncHandler(async (req, res) => {
  success(res, await service.obtener(requestContext(req)));
});

// POST /api/v1/admin/cohortes
const crear = asyncHandler(async (req, res) => {
  success(res, await service.crear(requestContext(req)), 201);
});

// PUT /api/v1/admin/cohortes/:id
const actualizar = asyncHandler(async (req, res) => {
  success(res, await service.actualizar(requestContext(req)));
});

// DELETE /api/v1/admin/cohortes/:id
const eliminar = asyncHandler(async (req, res) => {
  success(res, await service.eliminar(requestContext(req)));
});

module.exports = { listar, obtener, crear, actualizar, eliminar };
