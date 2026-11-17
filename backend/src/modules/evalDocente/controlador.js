// Envolturas de controlador del Módulo 3: traducen entre HTTP y los servicios (que no dependen de Express).
const asyncHandler = require('../../utils/asyncHandler');
const requestContext = require('../../utils/requestContext');
const { success } = require('../../utils/apiResponse');

// Respuesta JSON estándar { status, data }. `estado` puede depender del resultado.
const responder = (fn, estado = 200) => asyncHandler(async (req, res) => {
  const r = await fn(requestContext(req));
  success(res, r, typeof estado === 'function' ? estado(r) : estado);
});

// Descarga binaria: el servicio devuelve { nombreArchivo, tipo, buffer }.
const descargar = (fn) => asyncHandler(async (req, res) => {
  const { nombreArchivo, tipo, buffer } = await fn(requestContext(req));
  res.status(200).set({
    'Content-Type': tipo,
    'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    'Access-Control-Expose-Headers': 'Content-Disposition',
  }).send(Buffer.from(buffer));
});

module.exports = { responder, descargar };
