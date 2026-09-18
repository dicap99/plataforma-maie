const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./finanzas.service');

// GET /api/v1/admin/transferencias
const listarTransferencias = asyncHandler(async (req, res) => {
  success(res, await service.listarTransferencias(requestContext(req)));
});

// POST /api/v1/admin/transferencias
const crearTransferencias = asyncHandler(async (req, res) => {
  success(res, await service.crearTransferencias(requestContext(req)), 201);
});

// PUT /api/v1/admin/transferencias/:id
const actualizarTransferencias = asyncHandler(async (req, res) => {
  success(res, await service.actualizarTransferencias(requestContext(req)));
});

// DELETE /api/v1/admin/transferencias/:id
const eliminarTransferencias = asyncHandler(async (req, res) => {
  success(res, await service.eliminarTransferencias(requestContext(req)));
});

// GET /api/v1/admin/contratos-ops
const listarContratosOps = asyncHandler(async (req, res) => {
  success(res, await service.listarContratosOps(requestContext(req)));
});

// POST /api/v1/admin/contratos-ops
const crearContratosOps = asyncHandler(async (req, res) => {
  success(res, await service.crearContratosOps(requestContext(req)), 201);
});

// PUT /api/v1/admin/contratos-ops/:id
const actualizarContratosOps = asyncHandler(async (req, res) => {
  success(res, await service.actualizarContratosOps(requestContext(req)));
});

// DELETE /api/v1/admin/contratos-ops/:id
const eliminarContratosOps = asyncHandler(async (req, res) => {
  success(res, await service.eliminarContratosOps(requestContext(req)));
});

module.exports = { listarTransferencias, crearTransferencias, actualizarTransferencias, eliminarTransferencias, listarContratosOps, crearContratosOps, actualizarContratosOps, eliminarContratosOps };
