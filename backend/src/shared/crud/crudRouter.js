// Router REST genérico de un recurso: GET / · POST / · GET|PUT|DELETE /:llave1[/:llave2]
const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const requestContext = require('../../utils/requestContext');
const { success } = require('../../utils/apiResponse');
const { validadores } = require('./campos');

const handler = (fn, status) =>
  asyncHandler(async (req, res) => success(res, await fn(requestContext(req)), status));

const crudRouter = (recurso, service) => {
  const router = Router();
  const rutaLlave = `/${recurso.llave.map((k) => `:${k}`).join('/')}`;
  const lectura = [authenticate, authorize(...recurso.rolesLectura)];
  const escritura = [authenticate, authorize(...recurso.rolesEscritura)];

  router.get('/', ...lectura, handler(service.listar));
  router.get(rutaLlave, ...lectura, handler(service.obtener));
  router.post('/', ...escritura, validadores(recurso.campos), validate, handler(service.crear, 201));
  router.put(
    rutaLlave,
    ...escritura,
    // Las columnas reflejadas pueden omitirse: así editar una fila calculada desde Gestión académica
    // no sobrescribe el histórico del libro (el repositorio conserva lo guardado).
    validadores(recurso.campos, { excluir: recurso.llave, omitibles: recurso.omitibles ?? recurso.reflejados ?? [] }),
    validate,
    handler(service.actualizar),
  );
  router.delete(rutaLlave, ...escritura, handler(service.eliminar));

  return router;
};

module.exports = crudRouter;
