const asyncHandler = require('../../../utils/asyncHandler');
const { success } = require('../../../utils/apiResponse');
const service = require('./reportes.service');

// GET /api/v1/admin/reportes/estadisticas
const estadisticas = asyncHandler(async (req, res) => {
  success(res, await service.estadisticas());
});

// GET /api/v1/admin/presupuesto/resumen
const resumenPresupuesto = asyncHandler(async (req, res) => {
  success(res, await service.resumenPresupuesto());
});

module.exports = { estadisticas, resumenPresupuesto };
