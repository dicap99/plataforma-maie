const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./plantillas.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin/plantillas
router.get('/', authenticate, authorize(COORDINADOR), controller.listar);
router.get('/:tipo', authenticate, authorize(COORDINADOR), controller.descargar);

module.exports = router;
