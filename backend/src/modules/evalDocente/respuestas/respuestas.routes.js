const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const controller = require('./respuestas.controller');

const router = Router();

// Montado en /api/v1/eval-docente/respuestas
router.post('/', authenticate, controller.registrar);

module.exports = router;
