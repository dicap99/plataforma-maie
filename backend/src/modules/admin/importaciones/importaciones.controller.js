const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./importaciones.service');

// POST /api/v1/admin/importaciones
const importar = asyncHandler(async (req, res) => {
  const resultado = await service.importar(requestContext(req));
  success(res, resultado, resultado.simulacion ? 200 : 201);
});

module.exports = { importar };
