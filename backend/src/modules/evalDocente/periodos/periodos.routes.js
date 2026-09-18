const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./periodos.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/eval-docente/periodos
router.get('/activo', authenticate, controller.obtenerActivo);
router.get('/', authenticate, authorize(COORDINADOR), controller.listar);
router.post('/', authenticate, authorize(COORDINADOR), controller.crear);
router.put('/:id', authenticate, authorize(COORDINADOR), controller.actualizar);
router.post('/:id/publicar', authenticate, authorize(COORDINADOR), controller.publicar);
router.get('/:id/indicadores', authenticate, authorize(COORDINADOR), controller.indicadores);

module.exports = router;
