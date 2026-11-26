const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const service = require('./plantillas.service');

// GET /api/v1/admin/plantillas — descarga binaria (no usa el DTO JSON)
const responderExcel = (fn) => asyncHandler(async (req, res) => {
  const { nombreArchivo, buffer } = await fn(requestContext(req));
  res
    .status(200)
    .set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    })
    .send(Buffer.from(buffer));
});

module.exports = {
  descargar: responderExcel(service.generar),
  exportarRecurso: responderExcel(service.exportarRecurso),
};
