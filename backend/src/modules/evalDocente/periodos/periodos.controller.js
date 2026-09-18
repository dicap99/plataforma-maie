const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./periodos.service');

// GET /api/v1/eval-docente/periodos/activo
const obtenerActivo = asyncHandler(async (req, res) => {
  success(res, await service.obtenerActivo(requestContext(req)));
});

// GET /api/v1/eval-docente/periodos
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// POST /api/v1/eval-docente/periodos
const crear = asyncHandler(async (req, res) => {
  success(res, await service.crear(requestContext(req)), 201);
});

// PUT /api/v1/eval-docente/periodos/:id
const actualizar = asyncHandler(async (req, res) => {
  success(res, await service.actualizar(requestContext(req)));
});

// POST /api/v1/eval-docente/periodos/:id/publicar
const publicar = asyncHandler(async (req, res) => {
  success(res, await service.publicar(requestContext(req)));
});

// GET /api/v1/eval-docente/periodos/:id/indicadores
const indicadores = asyncHandler(async (req, res) => {
  success(res, await service.indicadores(requestContext(req)));
});

module.exports = { obtenerActivo, listar, crear, actualizar, publicar, indicadores };
