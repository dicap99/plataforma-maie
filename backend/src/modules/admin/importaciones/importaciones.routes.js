const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const upload = require('../../../middlewares/upload');
const { ROLES } = require('../../../utils/roles');
const controller = require('./importaciones.controller');

const { COORDINADOR } = ROLES;
const router = Router();

// Montado en /api/v1/admin/importaciones
router.post(
  '/',
  authenticate,
  authorize(COORDINADOR),
  upload.single('archivo'),
  controller.importar,
);

module.exports = router;
