const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./cohortes.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/admin/cohortes
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE), controller.listar);
router.get('/:id', authenticate, authorize(COORDINADOR, DOCENTE), controller.obtener);
router.post('/', authenticate, authorize(COORDINADOR), controller.crear);
router.put('/:id', authenticate, authorize(COORDINADOR), controller.actualizar);
router.delete('/:id', authenticate, authorize(COORDINADOR), controller.eliminar);

module.exports = router;
