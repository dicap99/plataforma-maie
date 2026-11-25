const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Con contraseña temporal (claim `temporal`) solo se puede consultar la sesión y cambiar la contraseña: el resto
// de la API responde 403 hasta que el usuario la cambie (decisión del usuario, 2026-11-25).
const PERMITIDAS_CON_TEMPORAL = new Set(['GET /api/v1/auth/me', 'PUT /api/v1/auth/password']);

// Verifica el JWT "Authorization: Bearer <token>" y expone req.user = { id, rol, temporal }.
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Token no proporcionado'));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, rol: payload.rol, temporal: Boolean(payload.temporal) };
    const ruta = `${req.method} ${(req.baseUrl + req.path).replace(/\/$/, '')}`;
    if (req.user.temporal && !PERMITIDAS_CON_TEMPORAL.has(ruta)) {
      return next(ApiError.forbidden('Debe cambiar su contraseña temporal antes de continuar (Mi cuenta)'));
    }
    return next();
  } catch {
    return next(ApiError.unauthorized('Token inválido o expirado'));
  }
};

module.exports = authenticate;
