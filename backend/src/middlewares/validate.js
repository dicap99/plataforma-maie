const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Uso: router.post('/', [body('x').notEmpty(), validate], controller)
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return next(ApiError.badRequest('Datos de entrada inválidos', errors.array()));
};

module.exports = validate;
