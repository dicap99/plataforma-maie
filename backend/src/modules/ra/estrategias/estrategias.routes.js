const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./estrategias.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/ra/estrategias
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE), controller.listar);

module.exports = router;
