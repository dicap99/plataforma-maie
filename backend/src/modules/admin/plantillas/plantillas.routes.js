const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./plantillas.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin/plantillas  (?datos=true exporta los datos actuales)
router.get('/', authenticate, authorize(COORDINADOR), controller.descargar);

module.exports = router;
