const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./investigacion.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin/investigacion
router.get('/productos', authenticate, authorize(COORDINADOR), controller.listarProductos);
router.post('/productos', authenticate, authorize(COORDINADOR), controller.crearProductos);
router.put('/productos/:id', authenticate, authorize(COORDINADOR), controller.actualizarProductos);
router.delete('/productos/:id', authenticate, authorize(COORDINADOR), controller.eliminarProductos);
router.get('/pasantias', authenticate, authorize(COORDINADOR), controller.listarPasantias);
router.post('/pasantias', authenticate, authorize(COORDINADOR), controller.crearPasantias);
router.put('/pasantias/:id', authenticate, authorize(COORDINADOR), controller.actualizarPasantias);
router.delete('/pasantias/:id', authenticate, authorize(COORDINADOR), controller.eliminarPasantias);

module.exports = router;
