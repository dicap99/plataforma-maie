const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./reportes.service');

// GET /api/v1/ra/reportes?agrupar=…&filtros
const consolidado = asyncHandler(async (req, res) => {
  success(res, await service.consolidado(requestContext(req)));
});

// GET /api/v1/ra/reportes/exportar — descarga binaria (no usa el DTO JSON)
const exportar = asyncHandler(async (req, res) => {
  const { nombreArchivo, buffer } = await service.exportar(requestContext(req));
  res
    .status(200)
    .set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    })
    .send(Buffer.from(buffer));
});

module.exports = { consolidado, exportar };
