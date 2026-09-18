const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./investigacion.service');

// GET /api/v1/admin/investigacion/productos
const listarProductos = asyncHandler(async (req, res) => {
  success(res, await service.listarProductos(requestContext(req)));
});

// POST /api/v1/admin/investigacion/productos
const crearProductos = asyncHandler(async (req, res) => {
  success(res, await service.crearProductos(requestContext(req)), 201);
});

// PUT /api/v1/admin/investigacion/productos/:id
const actualizarProductos = asyncHandler(async (req, res) => {
  success(res, await service.actualizarProductos(requestContext(req)));
});

// DELETE /api/v1/admin/investigacion/productos/:id
const eliminarProductos = asyncHandler(async (req, res) => {
  success(res, await service.eliminarProductos(requestContext(req)));
});

// GET /api/v1/admin/investigacion/pasantias
const listarPasantias = asyncHandler(async (req, res) => {
  success(res, await service.listarPasantias(requestContext(req)));
});

// POST /api/v1/admin/investigacion/pasantias
const crearPasantias = asyncHandler(async (req, res) => {
  success(res, await service.crearPasantias(requestContext(req)), 201);
});

// PUT /api/v1/admin/investigacion/pasantias/:id
const actualizarPasantias = asyncHandler(async (req, res) => {
  success(res, await service.actualizarPasantias(requestContext(req)));
});

// DELETE /api/v1/admin/investigacion/pasantias/:id
const eliminarPasantias = asyncHandler(async (req, res) => {
  success(res, await service.eliminarPasantias(requestContext(req)));
});

module.exports = { listarProductos, crearProductos, actualizarProductos, eliminarProductos, listarPasantias, crearPasantias, actualizarPasantias, eliminarPasantias };
