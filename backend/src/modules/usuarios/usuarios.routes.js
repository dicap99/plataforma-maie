const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const { ROLES } = require('../../utils/roles');
const controller = require('./usuarios.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/usuarios
router.get('/', authenticate, authorize(COORDINADOR), controller.listar);
router.get('/:id', authenticate, authorize(COORDINADOR), controller.obtener);
router.post('/', authenticate, authorize(COORDINADOR), controller.crear);
router.put('/:id', authenticate, authorize(COORDINADOR), controller.actualizar);
router.delete('/:id', authenticate, authorize(COORDINADOR), controller.eliminar);

module.exports = router;
