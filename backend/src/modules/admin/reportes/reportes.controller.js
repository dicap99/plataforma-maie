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

// GET /api/v1/admin/academico/reflejo
const reflejoAcademico = asyncHandler(async (req, res) => {
  success(res, await service.reflejoAcademico());
});

// GET /api/v1/admin/finanzas/reflejo
const reflejoFinanciero = asyncHandler(async (req, res) => {
  success(res, await service.reflejoFinanciero());
});

module.exports = { estadisticas, resumenPresupuesto, reflejoAcademico, reflejoFinanciero };
