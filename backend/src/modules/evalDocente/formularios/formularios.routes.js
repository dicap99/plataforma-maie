const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const controller = require('./formularios.controller');

const router = Router();

// Montado en /api/v1/eval-docente/formularios
router.get('/:tipo', authenticate, controller.obtener);

module.exports = router;
