const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./evaluaciones.service');

// GET /api/v1/ra/evaluaciones?curso= — planilla de la oferta
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// POST /api/v1/ra/evaluaciones — lote de notas por criterio (null borra la nota)
const registrarLote = asyncHandler(async (req, res) => {
  success(res, await service.registrarLote(requestContext(req)), 201);
});

module.exports = { listar, registrarLote };
