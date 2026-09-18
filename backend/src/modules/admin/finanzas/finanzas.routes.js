const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./finanzas.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin
router.get(
  '/transferencias',
  authenticate,
  authorize(COORDINADOR),
  controller.listarTransferencias,
);
router.post(
  '/transferencias',
  authenticate,
  authorize(COORDINADOR),
  controller.crearTransferencias,
);
router.put(
  '/transferencias/:id',
  authenticate,
  authorize(COORDINADOR),
  controller.actualizarTransferencias,
);
router.delete(
  '/transferencias/:id',
  authenticate,
  authorize(COORDINADOR),
  controller.eliminarTransferencias,
);
router.get('/contratos-ops', authenticate, authorize(COORDINADOR), controller.listarContratosOps);
router.post('/contratos-ops', authenticate, authorize(COORDINADOR), controller.crearContratosOps);
router.put(
  '/contratos-ops/:id',
  authenticate,
  authorize(COORDINADOR),
  controller.actualizarContratosOps,
);
router.delete(
  '/contratos-ops/:id',
  authenticate,
  authorize(COORDINADOR),
  controller.eliminarContratosOps,
);

module.exports = router;
