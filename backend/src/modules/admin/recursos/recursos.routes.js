// Monta el CRUD de cada recurso del Módulo 1 en /api/v1/admin/<id>
// y expone sus metadatos en GET /api/v1/admin/recursos para construir las tablas del frontend.
const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const { success } = require('../../../utils/apiResponse');
const crudRouter = require('../../../shared/crud/crudRouter');
const crudService = require('../../../shared/crud/crudService');
const { RECURSOS, metadatos } = require('./recursos.definicion');
const repositorios = require('./recursos.repository');

const router = Router();

router.get('/recursos', authenticate, (req, res) => success(res, metadatos(req.user.rol)));

for (const recurso of RECURSOS) {
  router.use(`/${recurso.id}`, crudRouter(recurso, crudService(recurso, repositorios[recurso.id])));
}

module.exports = router;
