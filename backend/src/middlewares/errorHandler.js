const ApiError = require('../utils/ApiError');
const { error } = require('../utils/apiResponse');
const env = require('../config/env');

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
  console.error(err);
  const message = env.nodeEnv === 'production' ? 'Error interno del servidor' : err.message;
  return error(res, 500, message);
};

module.exports = { notFoundHandler, errorHandler };
