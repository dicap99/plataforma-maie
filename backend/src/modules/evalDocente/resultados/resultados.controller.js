const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./resultados.service');

// GET /api/v1/eval-docente/resultados/me
const obtenerPropios = asyncHandler(async (req, res) => {
  success(res, await service.obtenerPropios(requestContext(req)));
});

// GET /api/v1/eval-docente/resultados/:docenteId
const obtenerPorDocente = asyncHandler(async (req, res) => {
  success(res, await service.obtenerPorDocente(requestContext(req)));
});

// GET /api/v1/eval-docente/resultados/:docenteId/informe.pdf
const informePdf = asyncHandler(async (req, res) => {
  success(res, await service.informePdf(requestContext(req)));
});

module.exports = { obtenerPropios, obtenerPorDocente, informePdf };
