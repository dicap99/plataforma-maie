const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const service = require('./plantillas.service');

// GET /api/v1/admin/plantillas — descarga binaria (no usa el DTO JSON)
const descargar = asyncHandler(async (req, res) => {
  const { nombreArchivo, buffer } = await service.generar(requestContext(req));
  res
    .status(200)
    .set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    })
    .send(Buffer.from(buffer));
});

module.exports = { descargar };
