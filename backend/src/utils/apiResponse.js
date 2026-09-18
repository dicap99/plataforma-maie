// DTO estandarizado definido en el Documento Técnico (Actividad 2).
const success = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ status: 'success', data });

const error = (res, statusCode, message, details) =>
  res.status(statusCode).json({
    status: 'error',
    error: details ? { message, details } : { message },
  });

module.exports = { success, error };
