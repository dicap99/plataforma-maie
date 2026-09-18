const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Verifica el JWT "Authorization: Bearer <token>" y expone req.user = { id, rol }.
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Token no proporcionado'));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, rol: payload.rol };
    return next();
  } catch {
    return next(ApiError.unauthorized('Token inválido o expirado'));
  }
};

module.exports = authenticate;
