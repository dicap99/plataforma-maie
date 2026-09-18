const ApiError = require('../utils/ApiError');
const { error } = require('../utils/apiResponse');
const env = require('../config/env');

// Errores de PostgreSQL que se deben a los datos enviados, no al servidor.
const PG_ERRORES = {
  23505: [409, 'Ya existe un registro con esos datos'],
  23503: [409, 'El registro está relacionado con otros datos'],
  23514: [400, 'Algún valor no cumple las reglas de validación'],
  23502: [400, 'Falta un valor obligatorio'],
  '22P02': [400, 'Formato de dato inválido'],
  22003: [400, 'Valor numérico fuera de rango'],
  22001: [400, 'Texto demasiado largo'],
};

const notFoundHandler = (req, res, next) =>
  next(ApiError.notFound(`Ruta ${req.method} ${req.originalUrl} no existe`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return error(res, err.statusCode, err.message, err.details);
  }
  if (err.type === 'entity.parse.failed') {
    return error(res, 400, 'JSON mal formado');
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return error(res, 400, 'El archivo supera el tamaño máximo (10 MB)');
  }
  if (PG_ERRORES[err.code]) {
    const [status, message] = PG_ERRORES[err.code];
    return error(res, status, message, err.detail || err.constraint);
  }
  console.error(err);
  const message = env.nodeEnv === 'production' ? 'Error interno del servidor' : err.message;
  return error(res, 500, message);
};

module.exports = { notFoundHandler, errorHandler };
