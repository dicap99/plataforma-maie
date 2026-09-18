const ApiError = require('./ApiError');

// Marcador para operaciones de servicio definidas en el diseño pero pendientes (Actividad 3).
// Responde 501 a través del errorHandler.
const pendiente = (nombre) => async () => {
  throw ApiError.notImplemented(`${nombre} pendiente de implementación`);
};

module.exports = pendiente;
