const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./reportes.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin/reportes
router.get('/estadisticas', authenticate, authorize(COORDINADOR), controller.estadisticas);

module.exports = router;
