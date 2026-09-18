const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./reportes.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/ra/reportes
router.get('/', authenticate, authorize(COORDINADOR), controller.consolidado);

module.exports = router;
