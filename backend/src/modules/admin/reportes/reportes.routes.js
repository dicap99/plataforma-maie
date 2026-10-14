const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./reportes.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/admin (el informe incluye información financiera: solo Coordinación)
router.get('/reportes/estadisticas', authenticate, authorize(COORDINADOR), controller.estadisticas);
router.get('/presupuesto/resumen', authenticate, authorize(COORDINADOR), controller.resumenPresupuesto);
// Hojas académicas con el reflejo de Gestión académica (Información académica la ve también el docente).
router.get('/academico/reflejo', authenticate, authorize(COORDINADOR, DOCENTE), controller.reflejoAcademico);

module.exports = router;
