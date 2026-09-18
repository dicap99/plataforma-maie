const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./evaluaciones.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/ra/evaluaciones
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE), controller.listar);
router.post('/', authenticate, authorize(DOCENTE), controller.registrarLote);
router.put('/:id', authenticate, authorize(DOCENTE), controller.actualizar);

module.exports = router;
