const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./presupuesto.service');

// GET /api/v1/admin/presupuesto/resumen
const resumen = asyncHandler(async (req, res) => {
  success(res, await service.resumen(requestContext(req)));
});

// GET /api/v1/admin/presupuesto
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// GET /api/v1/admin/presupuesto/:id
const obtener = asyncHandler(async (req, res) => {
  success(res, await service.obtener(requestContext(req)));
});

// POST /api/v1/admin/presupuesto
const crear = asyncHandler(async (req, res) => {
  success(res, await service.crear(requestContext(req)), 201);
});

// PUT /api/v1/admin/presupuesto/:id
const actualizar = asyncHandler(async (req, res) => {
  success(res, await service.actualizar(requestContext(req)));
});

// DELETE /api/v1/admin/presupuesto/:id
const eliminar = asyncHandler(async (req, res) => {
  success(res, await service.eliminar(requestContext(req)));
});

module.exports = { resumen, listar, obtener, crear, actualizar, eliminar };
