const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./presupuesto.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin/presupuesto
router.get('/resumen', authenticate, authorize(COORDINADOR), controller.resumen);
router.get('/', authenticate, authorize(COORDINADOR), controller.listar);
router.get('/:id', authenticate, authorize(COORDINADOR), controller.obtener);
router.post('/', authenticate, authorize(COORDINADOR), controller.crear);
router.put('/:id', authenticate, authorize(COORDINADOR), controller.actualizar);
router.delete('/:id', authenticate, authorize(COORDINADOR), controller.eliminar);

module.exports = router;
