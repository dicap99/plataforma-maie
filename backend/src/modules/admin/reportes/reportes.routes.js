const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./reportes.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin (el informe incluye información financiera: solo Coordinación)
router.get('/reportes/estadisticas', authenticate, authorize(COORDINADOR), controller.estadisticas);
router.get('/presupuesto/resumen', authenticate, authorize(COORDINADOR), controller.resumenPresupuesto);

module.exports = router;
