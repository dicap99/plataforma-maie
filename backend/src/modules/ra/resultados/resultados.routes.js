const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./resultados.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/ra/resultados
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE), controller.listar);
router.get('/:id', authenticate, authorize(COORDINADOR, DOCENTE), controller.obtener);

module.exports = router;
