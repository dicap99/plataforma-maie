const asyncHandler = require('../../../utils/asyncHandler');
const { success } = require('../../../utils/apiResponse');
const service = require('./financiero.service');

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

module.exports = {
  listar: asyncHandler(async (req, res) => {
    success(res, await service.listar(req));
  }),
  guardar: asyncHandler(async (req, res) => {
    success(res, await service.guardar(req));
  }),
  eliminar: asyncHandler(async (req, res) => {
    success(res, await service.eliminar(req));
  }),
  exportar: asyncHandler(async (req, res) => {
    const { nombreArchivo, buffer } = await service.exportar(req);
    res.setHeader('Content-Type', MIME_XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  }),
};
