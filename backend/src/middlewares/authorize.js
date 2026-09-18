const ApiError = require('../utils/ApiError');

// RBAC: permite el paso solo a los roles indicados (matriz del Documento Técnico 2).
// Las reglas de propiedad ("sus cursos", "su propia evaluación") se validan en los servicios.
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.rol)) return next(ApiError.forbidden());
  return next();
};

module.exports = authorize;
