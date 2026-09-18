// Contexto uniforme que los controladores pasan a los servicios,
// para que la capa de servicio no dependa de Express.
const requestContext = (req) => ({
  params: req.params,
  query: req.query,
  body: req.body,
  user: req.user,
  file: req.file,
});

module.exports = requestContext;
